import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { JobQuestion } from '../../job/job-questions/entities/job-question.entity';
import { R2Service } from '../../cloud-storage/r2.service';
import { ApplicationAnswerRepository } from '../application-answers/repositories/application-answer.repository';
import { ApplicationErrors } from '../constants/application-errors';
import {
  MediaWorkerPayloadStatus,
  TranscriptionJobStatus,
} from '../enums/application.enums';
import { WebhookDeliveryService } from '../webhook-delivery/webhook-delivery.service';
import {
  MediaWorkerAssessmentDto,
  MediaWorkerCallbackDto,
  MediaWorkerSpeechMetricsDto,
  MediaWorkerTranscriptSegmentDto,
} from './dto/media-worker.dto';
import { TranscriptionJob } from './entities/transcription-job.entity';
import { TranscriptionJobRepository } from './repositories/transcription-job.repository';
import {
  AssessmentInput,
  buildCommunicationMetrics,
  SpeechMetricsInput,
} from './utils/communication-metrics.util';
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
   * Path B: API only waits for worker 202 accept; transcript arrives via callback.
   * @param params - Application, job, org, transcript settings, and questions.
   * @returns void
   */
  async enqueueAfterSubmit(params: EnqueueTranscriptionParams): Promise<void> {
    try {
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

      const answers =
        await this.applicationAnswerRepository.findByApplicationId(
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
          await this.transcriptionJobRepository.hasActiveJobForAnswer(
            answer.id,
          );
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
    } catch (error) {
      this.logger.error(
        `enqueueAfterSubmit failed applicationId=${params.applicationId}: ${(error as Error).message}`,
      );
      try {
        await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
          params.applicationId,
          params.jobId,
        );
      } catch (settleError) {
        this.logger.error(
          `markNewApplicationReadyIfSettled failed applicationId=${params.applicationId}: ${(settleError as Error).message}`,
        );
      }
    }
  }

  /**
   * Handles a media worker callback (Path B — only way results are stored).
   * Success payloads mark COMPLETED; status=failed marks FAILED.
   * @param payload - Callback body from the media worker.
   * @returns success acknowledgement for the worker.
   */
  async handleWorkerCallback(
    payload: MediaWorkerCallbackDto,
  ): Promise<{ success: true }> {
    try {
      const callbackPayload = this.stripBulkyAssessmentDetails(
        this.toPlainCallbackPayload(payload),
      );

      this.logger.log(
        `Media worker callback received job_id=${payload.job_id} status=${payload.status ?? 'success'} ` +
          `hasTranscript=${Boolean(payload.transcript) || payload.text != null} ` +
          `hasSpeech=${Boolean(payload.speech)} hasAssessment=${Boolean(payload.assessment)} ` +
          `payloadBytes≈${Buffer.byteLength(JSON.stringify(callbackPayload), 'utf8')}`,
      );

      if (payload.status === MediaWorkerPayloadStatus.FAILED) {
        await this.applyWorkerFailure(
          payload.job_id,
          payload.error ?? ApplicationErrors.TRANSCRIPTION_FAILED,
          callbackPayload,
        );
        return { success: true };
      }

      const transcript = this.resolveTranscriptResult(payload);
      if (!transcript) {
        throw new BadRequestException(
          ApplicationErrors.INVALID_MEDIA_WORKER_CALLBACK,
        );
      }

      await this.applyWorkerResult(
        payload.job_id,
        transcript,
        payload.speech ?? null,
        payload.assessment ?? null,
        callbackPayload,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `handleWorkerCallback failed job_id=${payload.job_id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Finds one transcription job by id (reusable).
   * @param id - transcriptionJobs.id
   * @returns The job or null when not found.
   */
  async findOne(id: string): Promise<TranscriptionJob | null> {
    try {
      return await this.transcriptionJobRepository.findOne({ id });
    } catch (error) {
      this.logger.error(
        `findOne failed jobId=${id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Finds many transcription jobs for an application (reusable).
   * @param applicationId - The ID of the application.
   * @returns Transcription jobs for the application (newest first).
   */
  async findMany(applicationId: string): Promise<TranscriptionJob[]> {
    try {
      return await this.transcriptionJobRepository.findMany(
        { applicationId },
        { createdAt: 'DESC' },
      );
    } catch (error) {
      this.logger.error(
        `findMany failed applicationId=${applicationId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Finds transcription jobs by application ID.
   * @param applicationId - The ID of the application.
   * @returns The transcription jobs for the given application ID.
   */
  async findByApplicationId(
    applicationId: string,
  ): Promise<TranscriptionJob[]> {
    return this.findMany(applicationId);
  }

  /**
   * True when any transcription job for the application is still in flight.
   * @param applicationId - The ID of the application.
   * @returns True if PENDING or SENT jobs exist.
   */
  async hasActiveJobsForApplication(applicationId: string): Promise<boolean> {
    try {
      return await this.transcriptionJobRepository.hasActiveJobsForApplication(
        applicationId,
      );
    } catch (error) {
      this.logger.error(
        `hasActiveJobsForApplication failed applicationId=${applicationId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Resolves the video URL, marks the job SENT, and asks the media worker to accept it.
   * @param transcriptionJob - The transcription job to dispatch.
   * @param storageKey - The storage key of the video.
   * @param mediaUrl - The media URL of the video.
   * @param language - The language of the video.
   * @param mediaWorkerUrl - The media worker base URL.
   * @returns void
   */
  private async dispatchTranscription(
    transcriptionJob: TranscriptionJob,
    storageKey: string | null,
    mediaUrl: string | null,
    language: string,
    mediaWorkerUrl: string,
  ): Promise<void> {
    try {
      const videoUrl = await this.resolveVideoUrl(storageKey, mediaUrl);
      if (!videoUrl) {
        await this.transcriptionJobRepository.update(transcriptionJob.id, {
          status: TranscriptionJobStatus.FAILED,
          errorMessage: ApplicationErrors.NO_VIDEO_URL_FOR_TRANSCRIPTION,
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
        const message = this.toSafeTranscriptionErrorMessage(error);
        this.logger.error(
          `Transcription dispatch failed jobId=${transcriptionJob.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
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
    } catch (error) {
      this.logger.error(
        `dispatchTranscription failed jobId=${transcriptionJob.id}: ${(error as Error).message}`,
      );
      try {
        await this.transcriptionJobRepository.update(transcriptionJob.id, {
          status: TranscriptionJobStatus.FAILED,
          errorMessage: this.toSafeTranscriptionErrorMessage(error),
        });
        await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
          transcriptionJob.applicationId,
          transcriptionJob.jobId,
        );
      } catch (innerError) {
        this.logger.error(
          `dispatchTranscription cleanup failed jobId=${transcriptionJob.id}: ${(innerError as Error).message}`,
        );
      }
    }
  }

  /**
   * Applies a successful worker transcript to the transcription job row.
   * @param transcriptionJobId - The transcriptionJobs.id (worker job_id).
   * @param result - Transcript language, duration, text, and segments.
   * @param speech - Optional SpeechBrain metrics from the worker.
   * @param assessment - Optional pronunciation assessment from the worker.
   * @param callbackPayload - Raw callback payload for audit storage.
   * @returns void
   */
  private async applyWorkerResult(
    transcriptionJobId: string,
    result: {
      language: string;
      duration: number;
      text: string;
      segments: MediaWorkerTranscriptSegmentDto[];
    },
    speech: MediaWorkerSpeechMetricsDto | null,
    assessment: MediaWorkerAssessmentDto | null,
    callbackPayload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const existing = await this.findOne(transcriptionJobId);
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

      const speechMetrics = speech
        ? (this.toPlainCallbackPayload(speech) as SpeechMetricsInput &
            Record<string, unknown>)
        : null;
      const assessmentPayload = assessment
        ? this.stripBulkyAssessmentDetails(
            this.toPlainCallbackPayload(assessment),
          )
        : null;
      const communicationMetrics = buildCommunicationMetrics(
        speechMetrics,
        assessmentPayload as AssessmentInput | null,
      );

      this.logger.log(
        `Storing media worker result job_id=${transcriptionJobId} ` +
          `language=${result.language} duration=${result.duration} ` +
          `textLength=${result.text?.length ?? 0} segments=${result.segments?.length ?? 0} ` +
          `speechKeys=${speechMetrics ? Object.keys(speechMetrics).join(',') : 'none'} ` +
          `hasAssessment=${Boolean(assessmentPayload)} ` +
          `communicationScore=${communicationMetrics?.communicationScore?.score ?? 'n/a'} ` +
          `speechClarity=${communicationMetrics?.speechClarity?.score ?? 'n/a'} ` +
          `speakingPace=${communicationMetrics?.speakingPace?.wpm ?? 'n/a'} ` +
          `fluency=${communicationMetrics?.fluency?.score ?? 'n/a'}`,
      );

      await this.transcriptionJobRepository.update(transcriptionJobId, {
        status: TranscriptionJobStatus.COMPLETED,
        completedAt: new Date(),
        transcriptText: result.text,
        transcriptLanguage: result.language,
        transcriptDuration: result.duration,
        transcriptSegments: result.segments,
        callbackPayload,
        speechMetrics,
        assessment: assessmentPayload,
        communicationMetrics,
        communicationScore:
          communicationMetrics?.communicationScore?.score ?? null,
        speechClarity: communicationMetrics?.speechClarity?.score ?? null,
        speakingPaceWpm: communicationMetrics?.speakingPace?.wpm ?? null,
        fluencyScore: communicationMetrics?.fluency?.score ?? null,
        errorMessage: null,
      });

      await this.webhookDeliveryService.markNewApplicationReadyIfSettled(
        existing.applicationId,
        existing.jobId,
      );
    } catch (error) {
      this.logger.error(
        `applyWorkerResult failed jobId=${transcriptionJobId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Resolves nested or legacy-flat transcript fields from a success callback.
   */
  private resolveTranscriptResult(payload: MediaWorkerCallbackDto): {
    language: string;
    duration: number;
    text: string;
    segments: MediaWorkerTranscriptSegmentDto[];
  } | null {
    if (payload.transcript) {
      return {
        language: payload.transcript.language,
        duration: payload.transcript.duration,
        text: payload.transcript.text,
        segments: payload.transcript.segments,
      };
    }

    if (
      payload.language == null ||
      payload.duration == null ||
      payload.text == null ||
      payload.segments == null
    ) {
      return null;
    }

    return {
      language: payload.language,
      duration: payload.duration,
      text: payload.text,
      segments: payload.segments,
    };
  }

  /**
   * Converts a class-validator DTO instance into a plain JSON-safe object.
   */
  private toPlainCallbackPayload(value: unknown): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  /**
   * Removes bulky phoneme/word arrays from assessment payloads before DB storage.
   * Score fields (pronunciation, fluency, prosody, etc.) are kept.
   */
  private stripBulkyAssessmentDetails(
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const cloned = { ...value };

    if (
      cloned.assessment &&
      typeof cloned.assessment === 'object' &&
      !Array.isArray(cloned.assessment)
    ) {
      const assessment = {
        ...(cloned.assessment as Record<string, unknown>),
      };
      delete assessment.phonemes;
      delete assessment.words;
      cloned.assessment = assessment;
    }

    // When the assessment object itself is passed (not the full callback).
    delete cloned.phonemes;
    delete cloned.words;

    return cloned;
  }

  /**
   * Marks a transcription job FAILED from a worker failure callback.
   * @param transcriptionJobId - The transcriptionJobs.id (worker job_id).
   * @param errorMessage - Failure reason from the worker.
   * @param callbackPayload - Raw callback payload for audit storage.
   * @returns void
   */
  private async applyWorkerFailure(
    transcriptionJobId: string,
    errorMessage: string,
    callbackPayload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const existing = await this.findOne(transcriptionJobId);
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
    } catch (error) {
      this.logger.error(
        `applyWorkerFailure failed jobId=${transcriptionJobId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Dispatches work to the media worker and waits only for accept (202).
   * Does not wait for or apply the transcript — that comes via callback.
   * Uses axios timeout (no manual setTimeout/AbortController).
   * @param baseUrl - Media worker base URL (MEDIA_WORKER_URL).
   * @param jobId - transcriptionJobs.id sent as job_id.
   * @param videoUrl - Signed or public video URL.
   * @param language - Transcription language code.
   * @returns void
   */
  private async dispatchToMediaWorker(
    baseUrl: string,
    jobId: string,
    videoUrl: string,
    language: string,
  ): Promise<void> {
    const url = `${baseUrl.replace(/\/$/, '')}/transcribe`;
    const timeoutMs = this.getDispatchTimeoutMs();

    try {
      const response = await axios.post<{
        job_id?: string;
        status?: MediaWorkerPayloadStatus;
        detail?: string;
      }>(
        url,
        {
          job_id: jobId,
          video: { url: videoUrl },
          language,
        },
        {
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          validateStatus: (status) => status < 500,
        },
      );

      const body = response.data;

      if (response.status >= 400) {
        const detail =
          body && typeof body === 'object' && 'detail' in body
            ? String(body.detail)
            : ApplicationErrors.MEDIA_WORKER_RETURNED(response.status);
        throw new Error(detail);
      }

      // Axios status is a number; use 202 (HttpStatus.ACCEPTED) to satisfy enum lint.
      if (
        response.status !== 202 &&
        body?.status !== MediaWorkerPayloadStatus.ACCEPTED
      ) {
        this.logger.warn(
          `Media worker returned ${response.status} for jobId=${jobId}; expecting 202 ${MediaWorkerPayloadStatus.ACCEPTED} (Path B). Ignoring body.`,
        );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail =
          error.response?.data &&
          typeof error.response.data === 'object' &&
          'detail' in error.response.data
            ? String((error.response.data as { detail?: unknown }).detail)
            : error.message;
        this.logger.error(
          `dispatchToMediaWorker failed jobId=${jobId}: ${detail}`,
        );
        throw new Error(this.toSafeTranscriptionErrorMessage(error));
      }

      this.logger.error(
        `dispatchToMediaWorker failed jobId=${jobId}: ${(error as Error).message}`,
      );
      throw new Error(this.toSafeTranscriptionErrorMessage(error));
    }
  }

  /**
   * Maps media-worker / network failures to a safe UI-facing error string.
   */
  private toSafeTranscriptionErrorMessage(error: unknown): string {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
    const normalized = raw.toLowerCase();

    if (
      normalized.includes('econnrefused') ||
      normalized.includes('enotfound') ||
      normalized.includes('econnreset') ||
      normalized.includes('etimedout') ||
      normalized.includes('timeout') ||
      normalized.includes('network') ||
      normalized.includes('socket hang up') ||
      (axios.isAxiosError(error) && !error.response)
    ) {
      return ApplicationErrors.MEDIA_WORKER_UNAVAILABLE;
    }

    if (raw && raw.length <= 180 && !normalized.includes('exception')) {
      return raw;
    }

    return ApplicationErrors.TRANSCRIPTION_FAILED;
  }

  /**
   * Resolves a playable HTTPS video URL for the media worker.
   * Prefers a signed R2 URL, then an existing HTTPS mediaUrl, then public R2 URL.
   * @param storageKey - The storage key of the video.
   * @param mediaUrl - The media URL of the video.
   * @returns The resolved video URL, or null if none is available.
   */
  private async resolveVideoUrl(
    storageKey: string | null,
    mediaUrl: string | null,
  ): Promise<string | null> {
    try {
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
        } catch (error) {
          this.logger.warn(
            `Public URL failed for key=${storageKey}: ${(error as Error).message}`,
          );
          return null;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`resolveVideoUrl failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Reads MEDIA_WORKER_URL from config.
   * @returns Trimmed worker base URL, or null if unset.
   */
  private getMediaWorkerUrl(): string | null {
    try {
      const url = this.configService.get<string>('MEDIA_WORKER_URL')?.trim();
      return url || null;
    } catch (error) {
      this.logger.error(
        `getMediaWorkerUrl failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Timeout for the quick accept round-trip only (not full transcription).
   * @returns Timeout in milliseconds (default 30s).
   */
  private getDispatchTimeoutMs(): number {
    try {
      const seconds = Number(
        this.configService.get<string>(
          'MEDIA_WORKER_DISPATCH_TIMEOUT_SECONDS',
        ) ?? '30',
      );
      return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 30_000;
    } catch (error) {
      this.logger.error(
        `getDispatchTimeoutMs failed: ${(error as Error).message}`,
      );
      return 30_000;
    }
  }
}
