import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_WEBHOOK_SETTINGS } from '../../job/constants/job-defaults';
import { JobRepository } from '../../job/repositories/job.repository';
import { JobSettingsRepository } from '../../job/job-settings/repositories/job-settings.repository';
import { WebhookSettings } from '../../job/job-settings/entities/job-settings.entity';
import { ApplicationRepository } from '../repositories/application.repository';
import { TranscriptionJobsService } from '../transcription-jobs/transcription-jobs.service';
import {
  WebhookDeliveryStatus,
  WebhookEvent,
} from '../enums/application.enums';
import { WebhookDeliveryLogRepository } from './repositories/webhook-delivery-log.repository';
import { buildWebhookPayload, truncateResponseBody } from './webhook.mapper';

const WEBHOOK_TIMEOUT_MS = 15_000;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly settingsRepository: JobSettingsRepository,
    private readonly jobRepository: JobRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly logRepository: WebhookDeliveryLogRepository,
    private readonly transcriptionJobsService: TranscriptionJobsService,
  ) {}

  /**
   * Dispatches a new application webhook.
   * @param jobId - The ID of the job.
   * @param applicationId - The ID of the application.
   * @returns The dispatched new application webhook.
   */
  dispatchNewApplication(jobId: string, applicationId: string): void {
    void this.dispatch(
      jobId,
      applicationId,
      WebhookEvent.NEW_APPLICATION,
    ).catch((error) => {
      this.logger.error(
        `Webhook dispatch failed event=${WebhookEvent.NEW_APPLICATION} applicationId=${applicationId}: ${(error as Error).message}`,
      );
    });
  }

  /**
   * Dispatches a stage change webhook.
   * @param jobId - The ID of the job.
   * @param applicationId - The ID of the application.
   * @param fromStageId - The ID of the from stage.
   * @param toStageId - The ID of the to stage.
   * @returns The dispatched stage change webhook.
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

    void this.dispatch(jobId, applicationId, WebhookEvent.STAGE_CHANGE, {
      fromStageId,
      toStageId,
    }).catch((error) => {
      this.logger.error(
        `Webhook dispatch failed event=${WebhookEvent.STAGE_CHANGE} applicationId=${applicationId}: ${(error as Error).message}`,
      );
    });
  }

  /**
   * Dispatches a webhook.
   * @param jobId - The ID of the job.
   * @param applicationId - The ID of the application.
   * @param event - The type of event.
   * @param stageChange - The stage change.
   * @returns The dispatched webhook.
   */
  private async dispatch(
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

  /**
   * Delivers a webhook to a URL.
   * @param params - The parameters for the delivery.
   * @returns The delivered webhook.
   */
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
      const response = await this.postJson(url, payload);
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

  /**
   * Posts a JSON payload to a URL.
   * @param url - The URL to post to.
   * @param payload - The payload to post.
   * @returns The response from the URL.
   */
  private async postJson(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Hirekal-Webhook/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolves the webhook settings for a job.
   * @param jobId - The ID of the job.
   * @returns The resolved webhook settings.
   */
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

  /**
   * Determines if a webhook should be dispatched.
   * @param settings - The webhook settings.
   * @param event - The type of event.
   * @returns Whether the webhook should be dispatched.
   */
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

  /**
   * Determines if a webhook URL is valid.
   * @param url - The URL to check.
   * @returns Whether the webhook URL is valid.
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
