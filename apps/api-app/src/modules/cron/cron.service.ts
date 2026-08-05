import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { WebhookDeliveryService } from '../application/webhook-delivery/webhook-delivery.service';
import { CronJobName } from './enums/cron-job-name.enum';

const WEBHOOK_BATCH_SIZE = 20;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private isProcessingWebhooks = false;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WebhookDeliveryService))
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  /**
   * Enables or stops registered cron jobs based on IS_CRON_SERVER.
   * Call from bootstrap after app.init() so jobs are already registered.
   */
  applyCronServerGate(): void {
    const isCronServer = this.isCronServerEnabled();
    this.logger.log(`IS_CRON_SERVER=${isCronServer}`);

    try {
      const jobs = this.schedulerRegistry.getCronJobs();

      jobs.forEach((job: CronJob, key: string) => {
        if (isCronServer) {
          void job.start();
          this.logger.log(`Cron job enabled: ${key}`);
        } else {
          void job.stop();
          this.logger.log(`Cron job skipped (not cron server): ${key}`);
        }
      });
    } catch (error) {
      this.logger.error(
        `applyCronServerGate failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sends READY_TO_SEND webhook queue rows every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: CronJobName.WEBHOOK_DELIVERY })
  async processWebhookDeliveryQueue(): Promise<void> {
    if (!this.isCronServerEnabled()) {
      return;
    }

    if (this.isProcessingWebhooks) {
      this.logger.warn(
        'Previous webhook delivery batch still processing, skipping this run',
      );
      return;
    }

    try {
      this.isProcessingWebhooks = true;
      const processed =
        await this.webhookDeliveryService.processReadyQueue(WEBHOOK_BATCH_SIZE);
      this.logger.log(`Webhook delivery cron ran processed=${processed}`);
    } catch (error) {
      this.logger.error(
        `Webhook delivery cron failed: ${(error as Error).message}`,
      );
    } finally {
      this.isProcessingWebhooks = false;
    }
  }

  /**
   * Whether this process should run scheduled cron jobs.
   * Defaults to true when IS_CRON_SERVER is unset.
   * @returns True when cron should run.
   */
  private isCronServerEnabled(): boolean {
    try {
      const value = this.configService.get<string>('IS_CRON_SERVER');
      if (value == null || value === '') {
        return true;
      }
      return value === 'true';
    } catch (error) {
      this.logger.error(
        `isCronServerEnabled failed: ${(error as Error).message}`,
      );
      return true;
    }
  }
}
