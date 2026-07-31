import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobQuestion } from '../../job/job-questions/entities/job-question.entity';
import { R2Service } from '../../cloud-storage/r2.service';
import { ApplicationAnswerRepository } from '../application-answers/repositories/application-answer.repository';
import { TranscriptionJobStatus } from '../enums/application.enums';
import {
    MediaWorkerCallbackDto,
    MediaWorkerTranscribeResponse,
} from './dto/media-worker.dto';
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
    ) {}

    /**
     * Queues transcription for all video answers on a submitted application.
     * Runs asynchronously — failures are logged and do not affect submit.
     */
    async enqueueAfterSubmit(params: EnqueueTranscriptionParams): Promise<void> {
        if (!params.aiTranscripts) {
            return;
        }

        const mediaWorkerUrl = this.getMediaWorkerUrl();
        if (!mediaWorkerUrl) {
            this.logger.warn(
                'MEDIA_WORKER_URL is not configured; skipping transcription',
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
    }

    /**
     * Handles a media worker callback.
     * @param payload - The payload of the callback.
     * @returns The void.
     */
    async handleWorkerCallback(
        payload: MediaWorkerCallbackDto,
    ): Promise<{ success: true }> {
        await this.applyWorkerResult(payload.job_id, payload, { ...payload });
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
        return this.transcriptionJobRepository.findByApplicationId(
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
            return;
        }

        await this.transcriptionJobRepository.update(transcriptionJob.id, {
            status: TranscriptionJobStatus.SENT,
            sentAt: new Date(),
        });

        try {
            const response = await this.callMediaWorker(
                mediaWorkerUrl,
                transcriptionJob.id,
                videoUrl,
                language,
            );
            await this.applyWorkerResult(
                transcriptionJob.id,
                response,
                { ...response },
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Transcription failed jobId=${transcriptionJob.id}: ${message}`,
            );
            await this.transcriptionJobRepository.update(transcriptionJob.id, {
                status: TranscriptionJobStatus.FAILED,
                errorMessage: message,
            });
        }
    }

    /**
     * Applies a worker result to a transcription job.
     * @param transcriptionJobId - The ID of the transcription job.
     * @param result - The result of the worker.
     * @param callbackPayload - The callback payload.
     * @returns The void.
     */
    private async applyWorkerResult(
        transcriptionJobId: string,
        result: MediaWorkerTranscribeResponse | MediaWorkerCallbackDto,
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

        if (existing.status === TranscriptionJobStatus.COMPLETED) {
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
    }
    /**
     * Calls the media worker.
     * @param baseUrl - The base URL of the media worker.
     * @param jobId - The ID of the job.
     * @param videoUrl - The URL of the video.
     * @param language - The language of the video.
     * @returns The result of the media worker.
     */
    private async callMediaWorker(
        baseUrl: string,
        jobId: string,
        videoUrl: string,
        language: string,
    ): Promise<MediaWorkerTranscribeResponse> {
        const url = `${baseUrl.replace(/\/$/, '')}/transcribe`;
        const timeoutMs = this.getTranscriptionTimeoutMs();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    job_id: jobId,
                    video: { url: videoUrl },
                    language,
                }),
                signal: controller.signal,
            });

            const body = (await response.json().catch(() => null)) as
                | MediaWorkerTranscribeResponse
                | { detail?: string }
                | null;

            if (!response.ok) {
                const detail =
                    body && typeof body === 'object' && 'detail' in body
                        ? String(body.detail)
                        : `Media worker returned ${response.status}`;
                throw new Error(detail);
            }

            if (!body || typeof body !== 'object' || !('job_id' in body)) {
                throw new Error('Invalid media worker response');
            }

            return body as MediaWorkerTranscribeResponse;
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
     * Gets the transcription timeout in milliseconds.
     * @returns The transcription timeout in milliseconds.
     */
    private getTranscriptionTimeoutMs(): number {
        const minutes = Number(
            this.configService.get<string>('MEDIA_WORKER_TIMEOUT_MINUTES') ?? '15',
        );
        return Number.isFinite(minutes) && minutes > 0
            ? minutes * 60_000
            : 15 * 60_000;
    }
}
