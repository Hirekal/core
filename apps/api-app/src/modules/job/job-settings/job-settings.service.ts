import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SettingsErrors } from '../constants/settings-errors';
import { IntroMediaType } from '../enums/job.enums';
import { R2Service } from '../../cloud-storage/r2.service';
import { PresignUploadDto } from '../../cloud-storage/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../../cloud-storage/dto/confirm-upload.dto';
import {
  buildMediaKey,
  assertMediaKeyScope,
  validateMediaFile,
} from '../utils/media.util';
import { JobService } from '../job.service';
import {
  PatchEmailAutomationDto,
  PatchGeneralSettingsDto,
  PatchThankYouPageDto,
  PatchWebhookSettingsDto,
} from './dto/update-job-settings.dto';
import { JobSettings } from './entities/job-settings.entity';
import { JobSettingsRepository } from './repositories/job-settings.repository';
import { WebhookDeliveryLog } from '../../application/webhook-delivery-logs/entities/webhook-delivery-log.entity';
import { toWebhookLogResponse } from '../../application/webhook-delivery/webhook.mapper';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class JobSettingsService {
  private readonly logger = new Logger(JobSettingsService.name);

  constructor(
    private readonly settingsRepository: JobSettingsRepository,
    private readonly jobService: JobService,
    private readonly r2Service: R2Service,
    @InjectRepository(WebhookDeliveryLog)
    private readonly webhookLogRepository: Repository<WebhookDeliveryLog>,
  ) {}

  /**
   * Get full settings row for a job.
   * @param jobId
   * @param organizationId
   * @returns
   */
  async getSettings(
    jobId: string,
    organizationId: string,
  ): Promise<JobSettings & { webhookLogs: Record<string, unknown>[] }> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }

      const webhookLogs = await this.fetchWebhookLogs(jobId);

      return Object.assign(settings, { webhookLogs });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `getSettings failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(SettingsErrors.FAILED_TO_GET);
    }
  }

  /**
   * Merge-patch the general settings JSON column.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  async patchGeneral(
    jobId: string,
    organizationId: string,
    dto: PatchGeneralSettingsDto,
  ): Promise<JobSettings> {
    return this.patchSection(
      jobId,
      organizationId,
      'general',
      dto as Record<string, unknown>,
    );
  }

  /**
   * Merge-patch the thank-you page settings JSON column.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  async patchThankYou(
    jobId: string,
    organizationId: string,
    dto: PatchThankYouPageDto,
  ): Promise<JobSettings> {
    return this.patchSection(
      jobId,
      organizationId,
      'thankYouPage',
      dto as Record<string, unknown>,
    );
  }

  /**
   * Merge-patch the email automation settings JSON column.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  async patchEmailAutomation(
    jobId: string,
    organizationId: string,
    dto: PatchEmailAutomationDto,
  ): Promise<JobSettings> {
    return this.patchSection(
      jobId,
      organizationId,
      'emailAutomation',
      dto as Record<string, unknown>,
    );
  }

  /**
   * Merge-patch the webhook settings JSON column.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  async patchWebhook(
    jobId: string,
    organizationId: string,
    dto: PatchWebhookSettingsDto,
  ): Promise<JobSettings> {
    return this.patchSection(
      jobId,
      organizationId,
      'webhook',
      dto as Record<string, unknown>,
    );
  }

  /**
   * Finds recent webhook delivery attempts for a job.
   * @param jobId - The ID of the job.
   * @param organizationId - The ID of the organization.
   * @returns The webhook delivery logs.
   */
  async getWebhookLogs(
    jobId: string,
    organizationId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      return this.fetchWebhookLogs(jobId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `getWebhookLogs failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(SettingsErrors.FAILED_TO_GET);
    }
  }

  /**
   * Finds recent webhook delivery attempts for a job.
   * @param jobId - The ID of the job.
   * @returns The webhook delivery logs.
   */
  private async fetchWebhookLogs(
    jobId: string,
  ): Promise<Record<string, unknown>[]> {
    const logs = await this.webhookLogRepository.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return logs.map(toWebhookLogResponse);
  }

  /**
   * Presigns a URL for direct browser upload of thank-you page media.
   * @param jobId - The ID of the job.
   * @param organizationId - The ID of the organization.
   * @param dto - The data for the presign upload.
   * @returns The presigned URL.
   */
  async presignThankYouMediaUpload(
    jobId: string,
    organizationId: string,
    dto: PresignUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }
      validateMediaFile(dto.contentType, dto.size, true);
      const storageKey = buildMediaKey(
        organizationId,
        jobId,
        'thank-you',
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
        `presignThankYouMediaUpload failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        SettingsErrors.FAILED_TO_UPLOAD_THANK_YOU_MEDIA,
      );
    }
  }

  /**
   * Confirms thank-you media after direct R2 upload.
   */
  async confirmThankYouMediaUpload(
    jobId: string,
    organizationId: string,
    dto: ConfirmUploadDto,
  ): Promise<Record<string, unknown>> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }

      assertMediaKeyScope(dto.storageKey, organizationId, jobId, 'thank-you');
      const mediaType = validateMediaFile(dto.contentType, 1, true);
      const previousKey = settings.thankYouPage?.storageKey;
      const url = this.r2Service.getPublicUrl(dto.storageKey);
      const thankYouPage = {
        ...settings.thankYouPage,
        mediaType: mediaType === IntroMediaType.VIDEO ? 'video' : 'image',
        mediaUrl: url,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
      };

      await this.settingsRepository.update(settings.id, {
        thankYouPage,
        updatedAt: new Date(),
      });

      if (previousKey && previousKey !== dto.storageKey) {
        await this.r2Service.delete(previousKey);
      }

      return {
        mediaType: thankYouPage.mediaType,
        mediaUrl: url,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `confirmThankYouMediaUpload failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        SettingsErrors.FAILED_TO_UPLOAD_THANK_YOU_MEDIA,
      );
    }
  }

  /**
   * Clear thank-you media columns, then best-effort delete the R2 object.
   * @param jobId
   * @param organizationId
   * @returns
   */
  async deleteThankYouMedia(
    jobId: string,
    organizationId: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }

      const previousKey = settings.thankYouPage?.storageKey;

      await this.settingsRepository.update(settings.id, {
        thankYouPage: {
          ...settings.thankYouPage,
          mediaType: null,
          mediaUrl: '',
          storageKey: '',
          fileName: '',
        },
        updatedAt: new Date(),
      });

      if (previousKey) {
        try {
          await this.r2Service.delete(previousKey);
        } catch (r2Error) {
          this.logger.warn(
            `Failed to delete thank-you media key=${previousKey} jobId=${jobId}: ${(r2Error as Error).message}`,
          );
        }
      }

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `deleteThankYouMedia failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        SettingsErrors.FAILED_TO_DELETE_THANK_YOU_MEDIA,
      );
    }
  }

  /**
   * Presigned URL for direct browser upload of social preview image.
   */
  async presignSocialPreviewUpload(
    jobId: string,
    organizationId: string,
    dto: PresignUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }
      validateMediaFile(dto.contentType, dto.size, false);
      const storageKey = buildMediaKey(
        organizationId,
        jobId,
        'social-preview',
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
        `presignSocialPreviewUpload failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        SettingsErrors.FAILED_TO_UPLOAD_SOCIAL_PREVIEW,
      );
    }
  }

  /**
   * Confirms social preview image after direct R2 upload.
   */
  async confirmSocialPreviewUpload(
    jobId: string,
    organizationId: string,
    dto: ConfirmUploadDto,
  ): Promise<Record<string, unknown>> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }

      assertMediaKeyScope(
        dto.storageKey,
        organizationId,
        jobId,
        'social-preview',
      );
      validateMediaFile(dto.contentType, 1, false);
      const previousKey =
        settings.general?.socialPreview?.previewImage?.storageKey;
      const url = this.r2Service.getPublicUrl(dto.storageKey);
      const general = {
        ...settings.general,
        socialPreview: {
          ...settings.general.socialPreview,
          previewImage: {
            type: 'image',
            url,
            storageKey: dto.storageKey,
            fileName: dto.fileName,
          },
        },
      };

      await this.settingsRepository.update(settings.id, {
        general,
        updatedAt: new Date(),
      });

      if (previousKey && previousKey !== dto.storageKey) {
        await this.r2Service.delete(previousKey);
      }

      return {
        type: 'image',
        url,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `confirmSocialPreviewUpload failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        SettingsErrors.FAILED_TO_UPLOAD_SOCIAL_PREVIEW,
      );
    }
  }

  /**
   * Merge-patch a section of the settings JSON column.
   * @param jobId
   * @param organizationId
   * @param section
   * @param dto
   * @returns
   */
  private async patchSection(
    jobId: string,
    organizationId: string,
    section: 'general' | 'thankYouPage' | 'emailAutomation' | 'webhook',
    dto: Record<string, unknown>,
  ): Promise<JobSettings> {
    try {
      await this.jobService.assertJobAccess(jobId, organizationId);
      const settings = await this.settingsRepository.findByJobId(jobId);
      if (!settings) {
        throw new NotFoundException(SettingsErrors.NOT_FOUND(jobId));
      }

      const current = settings[section] as unknown as Record<string, unknown>;
      const merged = this.deepMerge(current, dto);

      await this.settingsRepository.update(settings.id, {
        [section]: merged,
        updatedAt: new Date(),
      });

      const updated = await this.settingsRepository.findByJobId(jobId);
      return updated!;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `patchSection failed jobId=${jobId} section=${section}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(SettingsErrors.FAILED_TO_UPDATE);
    }
  }

  /**
   * Deep merge two objects.
   * @param target
   * @param source
   * @returns
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object' &&
        !Array.isArray(targetVal)
      ) {
        result[key] = this.deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
        );
      } else if (sourceVal !== undefined) {
        result[key] = sourceVal;
      }
    }
    return result;
  }
}
