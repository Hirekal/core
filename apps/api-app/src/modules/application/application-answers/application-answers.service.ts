import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfirmUploadDto } from '../../cloud-storage/dto/confirm-upload.dto';
import { PresignUploadDto } from '../../cloud-storage/dto/presign-upload.dto';
import { R2Service } from '../../cloud-storage/r2.service';
import { ApplicationPublicAccessService } from '../application-public-access.service';
import { ApplicationErrors } from '../constants/application-errors';
import { UpsertAnswerDto } from '../dto/application.dto';
import { ApplicationRepository } from '../repositories/application.repository';
import {
  assertApplicationAnswerMediaKeyScope,
  buildApplicationAnswerMediaKey,
  validateAnswerVideoFile,
} from '../utils/application-media.util';
import { ApplicationAnswerRepository } from './repositories/application-answer.repository';
import {
  canReplaceVideoAnswer,
  getMaxRetakes,
  getRetakesRemaining,
  hasExistingVideoAnswer,
} from '../../job/utils/question-retakes.util';

@Injectable()
export class ApplicationAnswersService {
  private readonly logger = new Logger(ApplicationAnswersService.name);

  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly answerRepository: ApplicationAnswerRepository,
    private readonly r2Service: R2Service,
    private readonly publicAccessService: ApplicationPublicAccessService,
  ) {}

  /**
   * Upserts an answer for a given application and question.
   * @param id - The ID of the application.
   * @param token - The token of the application.
   * @param questionId - The ID of the question.
   * @param dto - The data for the answer.
   * @returns The upserted answer.
   */
  async upsertAnswer(
    id: string,
    token: string,
    questionId: string,
    dto: UpsertAnswerDto,
  ): Promise<Record<string, unknown>> {
    try {
      const application = await this.publicAccessService.assertPublicAccess(
        id,
        token,
      );
      const question = this.publicAccessService.findJobQuestion(
        application.job.questions ?? [],
        questionId,
      );
      if (!question) {
        throw new BadRequestException(ApplicationErrors.INVALID_QUESTION);
      }
      if (this.publicAccessService.isMediaQuestion(question)) {
        throw new BadRequestException(
          'Use the video upload endpoints for media questions',
        );
      }

      await this.answerRepository.upsertText(
        id,
        questionId,
        dto.answerText?.trim() ?? null,
      );
      await this.applicationRepository.update(id, {
        lastActivityAt: new Date(),
      });

      return { questionId, saved: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `upsertAnswer failed id=${id} question=${questionId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        ApplicationErrors.FAILED_TO_SAVE_ANSWER,
      );
    }
  }

  /**
   * Presigns a video upload URL for a given application and question.
   * @param id - The ID of the application.
   * @param token - The token of the application.
   * @param questionId - The ID of the question.
   * @param dto - The data for the video upload.
   * @returns The presigned video upload URL.
   */
  async presignAnswerVideo(
    id: string,
    token: string,
    questionId: string,
    dto: PresignUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
    try {
      const application = await this.publicAccessService.assertPublicAccess(
        id,
        token,
      );
      const question = this.publicAccessService.findJobQuestion(
        application.job.questions ?? [],
        questionId,
      );
      if (!question || !this.publicAccessService.isMediaQuestion(question)) {
        throw new BadRequestException(ApplicationErrors.INVALID_QUESTION);
      }

      const existing = await this.answerRepository.findOne(id, questionId);
      this.assertVideoRetakeAllowed(application.job.questionRetakes, existing);

      validateAnswerVideoFile(dto.contentType, dto.size);
      const storageKey = buildApplicationAnswerMediaKey(
        application.organizationId,
        application.jobId,
        id,
        questionId,
        dto.fileName,
      );
      const uploadUrl = await this.r2Service.getPresignedUploadUrl(
        storageKey,
        dto.contentType,
      );

      return {
        uploadUrl,
        storageKey,
        publicUrl: this.r2Service.getPublicUrl(storageKey),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `presignAnswerVideo failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        ApplicationErrors.FAILED_TO_PRESIGN_VIDEO,
      );
    }
  }

  /**
   * Confirms a video upload for a given application and question.
   * @param id - The ID of the application.
   * @param token - The token of the application.
   * @param questionId - The ID of the question.
   * @param dto - The data for the video upload.
   * @returns The confirmed video upload.
   */
  async confirmAnswerVideo(
    id: string,
    token: string,
    questionId: string,
    dto: ConfirmUploadDto,
  ): Promise<Record<string, unknown>> {
    try {
      const application = await this.publicAccessService.assertPublicAccess(
        id,
        token,
      );
      const question = this.publicAccessService.findJobQuestion(
        application.job.questions ?? [],
        questionId,
      );
      if (!question || !this.publicAccessService.isMediaQuestion(question)) {
        throw new BadRequestException(ApplicationErrors.INVALID_QUESTION);
      }

      assertApplicationAnswerMediaKeyScope(
        dto.storageKey,
        application.organizationId,
        application.jobId,
        id,
        questionId,
      );
      validateAnswerVideoFile(dto.contentType, 1);

      const existing = await this.answerRepository.findOne(id, questionId);
      this.assertVideoRetakeAllowed(application.job.questionRetakes, existing);

      const hadVideo = hasExistingVideoAnswer(existing);
      const nextRetakeCount = hadVideo ? (existing?.retakeCount ?? 0) + 1 : 0;
      const url = this.r2Service.getPublicUrl(dto.storageKey);

      await this.answerRepository.upsertVideo(id, questionId, {
        mediaType: 'video',
        mediaUrl: url,
        mediaStorageKey: dto.storageKey,
        mediaFileName: dto.fileName,
        retakeCount: nextRetakeCount,
      });

      if (
        existing?.mediaStorageKey &&
        existing.mediaStorageKey !== dto.storageKey
      ) {
        await this.r2Service.delete(existing.mediaStorageKey);
      }

      await this.applicationRepository.update(id, {
        lastActivityAt: new Date(),
      });

      const maxRetakes = getMaxRetakes(application.job.questionRetakes);

      return {
        questionId,
        mediaUrl: url,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        retakeCount: nextRetakeCount,
        retakesRemaining: getRetakesRemaining(
          maxRetakes,
          nextRetakeCount,
          true,
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `confirmAnswerVideo failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        ApplicationErrors.FAILED_TO_CONFIRM_VIDEO,
      );
    }
  }

  /**
   * Asserts that a video retake is allowed.
   * @param questionRetakes - The question retakes.
   * @param existing - The existing answer.
   * @returns The assert video retake allowed.
   */
  private assertVideoRetakeAllowed(
    questionRetakes: string | undefined,
    existing: Awaited<ReturnType<ApplicationAnswerRepository['findOne']>>,
  ): void {
    const maxRetakes = getMaxRetakes(questionRetakes);
    const hadVideo = hasExistingVideoAnswer(existing);
    if (
      !canReplaceVideoAnswer(maxRetakes, existing?.retakeCount ?? 0, hadVideo)
    ) {
      throw new BadRequestException(ApplicationErrors.RETAKE_LIMIT_REACHED);
    }
  }
}
