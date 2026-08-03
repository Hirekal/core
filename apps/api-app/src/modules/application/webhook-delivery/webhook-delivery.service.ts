import { createHmac } from 'crypto';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DEFAULT_WEBHOOK_SETTINGS } from '../../job/constants/job-defaults';
import { JobRepository } from '../../job/repositories/job.repository';
import { JobSettingsRepository } from '../../job/job-settings/repositories/job-settings.repository';
import { WebhookSettings } from '../../job/job-settings/entities/job-settings.entity';
import { ApplicationRepository } from '../repositories/application.repository';
import { TranscriptionJobsService } from '../transcription-jobs/transcription-jobs.service';
import {
    WebhookDeliveryStatus,
    WebhookEvent,
    WebhookQueueStatus,
} from '../enums/application.enums';
import { WebhookDeliveryQueue } from '../webhook-delivery-queue/entities/webhook-delivery-queue.entity';
import { WebhookDeliveryLogRepository } from './repositories/webhook-delivery-log.repository';
import { WebhookDeliveryQueueRepository } from './repositories/webhook-delivery-queue.repository';
import { buildWebhookPayload, truncateResponseBody } from './webhook.mapper';

const WEBHOOK_TIMEOUT_MS = 15_000;
const DEFAULT_QUEUE_BATCH_SIZE = 20;

@Injectable()
export class WebhookDeliveryService {
    private readonly logger = new Logger(WebhookDeliveryService.name);

    constructor(
        private readonly settingsRepository: JobSettingsRepository,
        private readonly jobRepository: JobRepository,
        private readonly applicationRepository: ApplicationRepository,
        private readonly logRepository: WebhookDeliveryLogRepository,
        private readonly queueRepository: WebhookDeliveryQueueRepository,
        @Inject(forwardRef(() => TranscriptionJobsService))
        private readonly transcriptionJobsService: TranscriptionJobsService,
    ) { }

    /**
     * Enqueues a new-application webhook.
     * Waits for transcripts when includeAiTranscripts + job.aiTranscripts are on.
     */
    dispatchNewApplication(jobId: string, applicationId: string): void {
        void this.enqueueNewApplication(jobId, applicationId).catch((error) => {
            this.logger.error(
                `Webhook enqueue failed event=${WebhookEvent.NEW_APPLICATION} applicationId=${applicationId}: ${(error as Error).message}`,
            );
        });
    }

    /**
     * Sends a stage-change webhook immediately (no transcript wait).
     */
    dispatchStageChange(
        jobId: string,
        applicationId: string,
        fromStageId: string | null,
        toStageId: string | null,
    ): void {
        if (fromStageId === toStageId) {
            return;
        }

        void this.dispatchImmediate(jobId, applicationId, WebhookEvent.STAGE_CHANGE, {
            fromStageId,
            toStageId,
        }).catch((error) => {
            this.logger.error(
                `Webhook dispatch failed event=${WebhookEvent.STAGE_CHANGE} applicationId=${applicationId}: ${(error as Error).message}`,
            );
        });
    }

    /**
     * Promotes PENDING new-application queue rows to READY_TO_SEND when
     * all transcription jobs for the application are settled (or none exist).
     */
    async markNewApplicationReadyIfSettled(
        applicationId: string,
        jobId: string,
    ): Promise<void> {
        const pending = await this.queueRepository.findPendingNewApplication(
            applicationId,
            jobId,
        );
        if (!pending.length) {
            return;
        }

        const hasActive =
            await this.transcriptionJobsService.hasActiveJobsForApplication(
                applicationId,
            );
        if (hasActive) {
            return;
        }

        const updated = await this.queueRepository.markPendingNewApplicationReady(
            applicationId,
            jobId,
        );
        if (updated > 0) {
            this.logger.log(
                `Webhook queue READY_TO_SEND applicationId=${applicationId} jobId=${jobId} count=${updated}`,
            );
        }
    }

    /**
     * Cron entry: claim READY_TO_SEND rows and deliver them.
     */
    async processReadyQueue(
        batchSize = DEFAULT_QUEUE_BATCH_SIZE,
    ): Promise<number> {
        const claimed = await this.queueRepository.claimReadyToSend(batchSize);
        if (!claimed.length) {
            return 0;
        }

        let processed = 0;
        for (const row of claimed) {
            try {
                await this.deliverQueuedRow(row);
                processed += 1;
            } catch (error) {
                this.logger.error(
                    `Webhook queue send failed id=${row.id}: ${(error as Error).message}`,
                );
                await this.queueRepository.update(row.id, {
                    status: WebhookQueueStatus.READY_TO_SEND,
                    lastError: (error as Error).message,
                    attemptCount: (row.attemptCount ?? 0) + 1,
                    updatedAt: new Date(),
                });
            }
        }

        return processed;
    }

    private async enqueueNewApplication(
        jobId: string,
        applicationId: string,
    ): Promise<void> {
        const settings = await this.resolveWebhookSettings(jobId);
        if (!this.shouldDispatch(settings, WebhookEvent.NEW_APPLICATION)) {
            return;
        }

        const url = settings.url.trim();
        if (!this.isValidWebhookUrl(url)) {
            this.logger.warn(
                `Skipping webhook enqueue for jobId=${jobId}: invalid or missing URL`,
            );
            return;
        }

        const application =
            await this.applicationRepository.findByIdWithWebhookRelations(
                applicationId,
            );
        if (!application) {
            return;
        }

        const job = await this.jobRepository.findByIdForOrg(
            jobId,
            application.organizationId,
        );
        if (!job) {
            return;
        }

        const waitForTranscripts =
            settings.includeAiTranscripts === true && job.aiTranscripts === true;

        await this.queueRepository.create({
            jobId,
            applicationId,
            event: WebhookEvent.NEW_APPLICATION,
            status: waitForTranscripts
                ? WebhookQueueStatus.PENDING
                : WebhookQueueStatus.READY_TO_SEND,
            requestUrl: url,
            fromStageId: null,
            toStageId: null,
            attemptCount: 0,
            lastError: null,
        });

        if (waitForTranscripts) {
            // Transcription may already be done / skipped — promote if settled.
            await this.markNewApplicationReadyIfSettled(applicationId, jobId);
        }
    }

    private async dispatchImmediate(
        jobId: string,
        applicationId: string,
        event: WebhookEvent,
        stageChange?: {
            fromStageId: string | null;
            toStageId: string | null;
        },
    ): Promise<void> {
        const settings = await this.resolveWebhookSettings(jobId);
        if (!this.shouldDispatch(settings, event)) {
            return;
        }

        const url = settings.url.trim();
        if (!this.isValidWebhookUrl(url)) {
            this.logger.warn(
                `Skipping webhook for jobId=${jobId}: invalid or missing URL`,
            );
            return;
        }

        const application =
            await this.applicationRepository.findByIdWithWebhookRelations(
                applicationId,
            );
        if (!application) {
            return;
        }

        const job = await this.jobRepository.findByIdForOrg(
            jobId,
            application.organizationId,
        );
        if (!job) {
            return;
        }

        await this.deliverToUrl({
            url,
            event,
            jobId,
            applicationId,
            settings,
            job,
            application,
            stageChange,
        });
    }

    private async deliverQueuedRow(row: WebhookDeliveryQueue): Promise<void> {
        const settings = await this.resolveWebhookSettings(row.jobId);
        const application =
            await this.applicationRepository.findByIdWithWebhookRelations(
                row.applicationId,
            );
        if (!application) {
            await this.queueRepository.markSent(row.id, 'Application not found');
            return;
        }

        const job = await this.jobRepository.findByIdForOrg(
            row.jobId,
            application.organizationId,
        );
        if (!job) {
            await this.queueRepository.markSent(row.id, 'Job not found');
            return;
        }

        const url = row.requestUrl || settings.url.trim();
        await this.deliverToUrl({
            url,
            event: row.event,
            jobId: row.jobId,
            applicationId: row.applicationId,
            settings,
            job,
            application,
            stageChange:
                row.fromStageId || row.toStageId
                    ? {
                        fromStageId: row.fromStageId,
                        toStageId: row.toStageId,
                    }
                    : undefined,
        });

        await this.queueRepository.markSent(row.id);
    }

    private async deliverToUrl(params: {
        url: string;
        event: WebhookEvent;
        jobId: string;
        applicationId: string;
        settings: WebhookSettings;
        job: NonNullable<Awaited<ReturnType<JobRepository['findByIdForOrg']>>>;
        application: NonNullable<
            Awaited<ReturnType<ApplicationRepository['findByIdWithWebhookRelations']>>
        >;
        stageChange?: {
            fromStageId: string | null;
            toStageId: string | null;
        };
    }): Promise<void> {
        const {
            url,
            event,
            jobId,
            applicationId,
            settings,
            job,
            application,
            stageChange,
        } = params;

        const transcriptionByAnswerId = settings.includeAiTranscripts
            ? new Map(
                (
                    await this.transcriptionJobsService.findByApplicationId(
                        applicationId,
                    )
                ).map((item) => [item.applicationAnswerId, item]),
            )
            : new Map();

        const payload = buildWebhookPayload({
            event,
            jobId,
            application,
            settings,
            questions: job.questions ?? [],
            applicationFields: job.applicationFields ?? [],
            stages: job.pipelineStages ?? [],
            transcriptionByAnswerId,
            stageChange,
        });

        const log = await this.logRepository.create({
            jobId,
            applicationId,
            status: WebhookDeliveryStatus.PENDING,
            event,
            requestUrl: url,
            responseStatus: null,
            responseBody: null,
            errorMessage: null,
        });

        try {
            const response = await this.postJson(url, payload, settings.secret);
            const responseBody = truncateResponseBody(
                await response.text().catch(() => null),
            );

            if (response.ok) {
                await this.logRepository.update(log.id, {
                    status: WebhookDeliveryStatus.SUCCESS,
                    responseStatus: response.status,
                    responseBody,
                    errorMessage: null,
                });
                return;
            }

            await this.logRepository.update(log.id, {
                status: WebhookDeliveryStatus.FAILED,
                responseStatus: response.status,
                responseBody,
                errorMessage: `Webhook returned HTTP ${response.status}`,
            });
        } catch (error) {
            await this.logRepository.update(log.id, {
                status: WebhookDeliveryStatus.FAILED,
                responseStatus: null,
                responseBody: null,
                errorMessage: (error as Error).message,
            });
        }
    }

    private async postJson(
        url: string,
        payload: Record<string, unknown>,
        secret?: string,
    ): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Hirekal-Webhook/1.0',
        };

        const trimmedSecret = secret?.trim();
        if (trimmedSecret) {
            const signature = createHmac('sha256', trimmedSecret)
                .update(body, 'utf8')
                .digest('hex');
            headers['X-Hirekal-Signature'] = `sha256=${signature}`;
        }

        try {
            return await fetch(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    private async resolveWebhookSettings(
        jobId: string,
    ): Promise<WebhookSettings> {
        const row = await this.settingsRepository.findByJobId(jobId);
        const stored = row?.webhook ?? ({} as WebhookSettings);

        return {
            ...DEFAULT_WEBHOOK_SETTINGS,
            ...stored,
            triggers: {
                ...DEFAULT_WEBHOOK_SETTINGS.triggers,
                ...(stored.triggers ?? {}),
            },
        };
    }

    private shouldDispatch(
        settings: WebhookSettings,
        event: WebhookEvent,
    ): boolean {
        if (!settings.url?.trim()) {
            return false;
        }

        if (event === WebhookEvent.NEW_APPLICATION) {
            return settings.triggers.newApplication === true;
        }

        if (event === WebhookEvent.STAGE_CHANGE) {
            return settings.triggers.stageChange === true;
        }

        return false;
    }

    private isValidWebhookUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }
}
