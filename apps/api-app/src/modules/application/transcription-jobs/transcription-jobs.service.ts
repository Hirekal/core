import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobQuestion } from '../../job/job-questions/entities/job-question.entity';
import { R2Service } from '../../cloud-storage/r2.service';
import { ApplicationAnswerRepository } from '../application-answers/repositories/application-answer.repository';
import { TranscriptionJobStatus } from '../enums/application.enums';
import { WebhookDeliveryService } from '../webhook-delivery/webhook-delivery.service';
import { MediaWorkerCallbackDto } from './dto/media-worker.dto';
import { TranscriptionJob } from './entities/transcription-job.entity';
import { TranscriptionJobRepository } from './repositories/transcription-job.repository';
import { mapTranscriptionLanguage } from './utils/transcription-language.util';
import { isMediaQuestion } from './utils/media-question.util';

export interface EnqueueTranscriptionParams {
  applicationId: string;
  jobId: string;
  organizationId: string;
  aiTranscripts: boolean;
  transcriptionLanguage: string;
  questions: JobQuestion[];
}

@Injectable()
export class TranscriptionJobsService {
  private readonly logger = new Logger(TranscriptionJobsService.name);

  constructor(
    private readonly transcriptionJobRepository: TranscriptionJobRepository,
    private readonly applicationAnswerRepository: ApplicationAnswerRepository,
    private readonly r2Service: R2Service,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WebhookDeliveryService))
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Queues transcription for all video answers on a submitted application.
   * Runs asynchronously — failures are logged and do not affect submit.
   */
  async enqueueAfterSubmit(params: EnqueueTranscriptionParams): Promise<void> {
    if (!params.aiTranscripts) {
      await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
        params.applicationId,
        params.jobId,
      );
      return;
    }

    const mediaWorkerUrl = this.getMediaWorkerUrl();
    if (!mediaWorkerUrl) {
      this.logger.warn(
        'MEDIA_WORKER_URL is not configured; skipping transcription',
      );
      await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
        params.applicationId,
        params.jobId,
      );
      return;
    }

    const answers = await this.applicationAnswerRepository.findByApplicationId(
      params.applicationId,
    );
    const language = mapTranscriptionLanguage(params.transcriptionLanguage);

    for (const question of params.questions) {
      if (!isMediaQuestion(question)) {
        continue;
      }

      const answer = answers.find((item) => item.questionId === question.id);
      if (!answer?.mediaStorageKey && !answer?.mediaUrl) {
        continue;
      }

      const hasActiveJob =
        await this.transcriptionJobRepository.hasActiveJobForAnswer(answer.id);
      if (hasActiveJob) {
        continue;
      }

      const transcriptionJob = await this.transcriptionJobRepository.create({
        applicationId: params.applicationId,
        applicationAnswerId: answer.id,
        jobId: params.jobId,
        organizationId: params.organizationId,
        status: TranscriptionJobStatus.PENDING,
        videoStorageKey: answer.mediaStorageKey,
        language,
      });

      await this.dispatchTranscription(
        transcriptionJob,
        answer.mediaStorageKey,
        answer.mediaUrl,
        language,
        mediaWorkerUrl,
      );
    }

    await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
      params.applicationId,
      params.jobId,
    );
  }

  /**
   * Handles a media worker callback (Path B — only way results are stored).
   */
  async handleWorkerCallback(
    payload: MediaWorkerCallbackDto,
  ): Promise<{ success: true }> {
    if (payload.status === 'failed') {
      await this.applyWorkerFailure(
        payload.job_id,
        payload.error ?? 'Transcription failed',
        { ...payload },
      );
      return { success: true };
    }

    if (
      payload.language == null ||
      payload.duration == null ||
      payload.text == null ||
      payload.segments == null
    ) {
      throw new BadRequestException(
        'Invalid media worker success callback payload',
      );    }

    await this.applyWorkerResult(
      payload.job_id,
      {
        language: payload.language,
        duration: payload.duration,
        text: payload.text,
        segments: payload.segments,
      },
      { ...payload },
    );
    return { success: true };
  }

  /**
   * Finds transcription jobs by application ID.
   * @param applicationId - The ID of the application.
   * @returns The transcription jobs for the given application ID.
   */
  async findByApplicationId(
    applicationId: string,
  ): Promise<TranscriptionJob[]> {
    return this.transcriptionJobRepository.findByApplicationId(applicationId);
  }

  /**
   * True when any transcription job for the application is still in flight.
   */
  async hasActiveJobsForApplication(applicationId: string): Promise<boolean> {
    return this.transcriptionJobRepository.hasActiveJobsForApplication(
      applicationId,
    );
  }

  /**
   * Dispatches a transcription job.
   * @param transcriptionJob - The transcription job to dispatch.
   * @param storageKey - The storage key of the video.
   * @param mediaUrl - The media URL of the video.
   * @param language - The language of the video.
   * @param mediaWorkerUrl - The media worker URL.
   * @returns The void.
   */
  private async dispatchTranscription(
    transcriptionJob: TranscriptionJob,
    storageKey: string | null,
    mediaUrl: string | null,
    language: string,
    mediaWorkerUrl: string,
  ): Promise<void> {
    const videoUrl = await this.resolveVideoUrl(storageKey, mediaUrl);
    if (!videoUrl) {
      await this.transcriptionJobRepository.update(transcriptionJob.id, {
        status: TranscriptionJobStatus.FAILED,
        errorMessage: 'No accessible video URL for transcription',
      });
      await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
        transcriptionJob.applicationId,
        transcriptionJob.jobId,
      );
      return;
    }

    await this.transcriptionJobRepository.update(transcriptionJob.id, {
      status: TranscriptionJobStatus.SENT,
      sentAt: new Date(),
    });

    try {
      // Path B only: wait for quick accept (202), not the transcript body.
      // Result is stored only when the worker POSTs /media-worker-response.
      await this.dispatchToMediaWorker(
        mediaWorkerUrl,
        transcriptionJob.id,
        videoUrl,
        language,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Transcription dispatch failed jobId=${transcriptionJob.id}: ${message}`,
      );
      await this.transcriptionJobRepository.update(transcriptionJob.id, {
        status: TranscriptionJobStatus.FAILED,
        errorMessage: message,
      });
      await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
        transcriptionJob.applicationId,
        transcriptionJob.jobId,
      );
    }
  }

  private async applyWorkerResult(
    transcriptionJobId: string,
    result: {
      language: string;
      duration: number;
      text: string;
      segments: MediaWorkerCallbackDto['segments'];
    },
    callbackPayload: Record<string, unknown>,
  ): Promise<void> {
    const existing =
      await this.transcriptionJobRepository.findById(transcriptionJobId);
    if (!existing) {
      this.logger.warn(
        `Transcription callback for unknown job_id=${transcriptionJobId}`,
      );
      return;
    }

    if (
      existing.status === TranscriptionJobStatus.COMPLETED ||
      existing.status === TranscriptionJobStatus.FAILED
    ) {
      return;
    }

    await this.transcriptionJobRepository.update(transcriptionJobId, {
      status: TranscriptionJobStatus.COMPLETED,
      completedAt: new Date(),
      transcriptText: result.text,
      transcriptLanguage: result.language,
      transcriptDuration: result.duration,
      transcriptSegments: result.segments,
      callbackPayload,
      errorMessage: null,
    });

    await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
      existing.applicationId,
      existing.jobId,
    );
  }

  private async applyWorkerFailure(
    transcriptionJobId: string,
    errorMessage: string,
    callbackPayload: Record<string, unknown>,
  ): Promise<void> {
    const existing =
      await this.transcriptionJobRepository.findById(transcriptionJobId);
    if (!existing) {
      this.logger.warn(
        `Transcription failure callback for unknown job_id=${transcriptionJobId}`,
      );
      return;
    }

    if (
      existing.status === TranscriptionJobStatus.COMPLETED ||
      existing.status === TranscriptionJobStatus.FAILED
    ) {
      return;
    }

    await this.transcriptionJobRepository.update(transcriptionJobId, {
      status: TranscriptionJobStatus.FAILED,
      completedAt: new Date(),
      errorMessage,
      callbackPayload,
    });

    await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
      existing.applicationId,
      existing.jobId,
    );
  }

  /**
   * Dispatches work to the media worker and waits only for accept (202).
   * Does not wait for or apply the transcript — that comes via callback.
   */
  private async dispatchToMediaWorker(
    baseUrl: string,
    jobId: string,
    videoUrl: string,
    language: string,
  ): Promise<void> {
    const url = `${baseUrl.replace(/\/$/, '')}/transcribe`;
    const timeoutMs = this.getDispatchTimeoutMs();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
          video: { url: videoUrl },
          language,
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as
        | { job_id?: string; status?: string; detail?: string }
        | null;

      if (!response.ok) {
        const detail =
          body && typeof body === 'object' && 'detail' in body
            ? String(body.detail)
            : `Media worker returned ${response.status}`;
        throw new Error(detail);
      }

      if (response.status !== 202 && body?.status !== 'accepted') {
        this.logger.warn(
          `Media worker returned ${response.status} for jobId=${jobId}; expecting 202 accepted (Path B). Ignoring body.`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolves a video URL.
   * @param storageKey - The storage key of the video.
   * @param mediaUrl - The media URL of the video.
   * @returns The resolved video URL.
   */
  private async resolveVideoUrl(
    storageKey: string | null,
    mediaUrl: string | null,
  ): Promise<string | null> {
    if (storageKey) {
      try {
        return await this.r2Service.getSignedUrl(storageKey, 3600);
      } catch (error) {
        this.logger.warn(
          `Signed URL failed for key=${storageKey}: ${(error as Error).message}`,
        );
      }
    }

    if (mediaUrl?.startsWith('https://')) {
      return mediaUrl;
    }

    if (storageKey) {
      try {
        return this.r2Service.getPublicUrl(storageKey);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Gets the media worker URL.
   * @returns The media worker URL.
   */
  private getMediaWorkerUrl(): string | null {
    const url = this.configService.get<string>('MEDIA_WORKER_URL')?.trim();
    return url || null;
  }

  /**
   * Timeout for the quick accept round-trip only (not full transcription).
   */
  private getDispatchTimeoutMs(): number {
    const seconds = Number(
      this.configService.get<string>('MEDIA_WORKER_DISPATCH_TIMEOUT_SECONDS') ??
        '30',
    );
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 30_000;
  }
}
