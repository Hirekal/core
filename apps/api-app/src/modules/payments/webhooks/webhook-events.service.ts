/**
 * @fileoverview Webhook event persistence service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { WebhookProcessingStatus } from '../common/enums/payment.enums';
import { LOG_MESSAGES } from '../common/messages/payment.messages';
import { toDate } from '../common/utils/date.util';

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly paymentProvidersService: PaymentProvidersService,
  ) {}

  /*
   * Persist.
   */
  async persist(input: {
    providerCode: string;
    providerEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookEvent> {
    try {
      const provider = await this.paymentProvidersService.findByCode(
        input.providerCode,
      );

      const existingWebhookEvent = await this.webhookEventsRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerEventId: input.providerEventId,
        },
      });
      if (existingWebhookEvent) {
        return existingWebhookEvent;
      }

      const webhookEvent = this.webhookEventsRepository.create({
        paymentProviderId: provider.id,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        payload: input.payload,
        processingStatus: WebhookProcessingStatus.PENDING,
      });
      return this.webhookEventsRepository.save(webhookEvent);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.WEBHOOK.RECEIVE_FAILED(input.providerCode),
        error,
      );
      throw error;
    }
  }

  /*
   * Marks a webhook event as successfully processed.
   */
  async markProcessed(webhookEvent: WebhookEvent): Promise<WebhookEvent> {
    try {
      webhookEvent.processingStatus = WebhookProcessingStatus.PROCESSED;
      webhookEvent.processedAt = toDate();
      webhookEvent.errorMessage = null;
      return this.webhookEventsRepository.save(webhookEvent);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.WEBHOOK.PROCESS_FAILED(webhookEvent.providerEventId),
        error,
      );
      throw error;
    }
  }

  /*
   * Marks a webhook event as failed with an error message.
   */
  async markFailed(
    webhookEvent: WebhookEvent,
    errorMessage: string,
  ): Promise<WebhookEvent> {
    try {
      webhookEvent.processingStatus = WebhookProcessingStatus.FAILED;
      webhookEvent.errorMessage = errorMessage;
      webhookEvent.processedAt = toDate();
      return this.webhookEventsRepository.save(webhookEvent);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.WEBHOOK.PROCESS_FAILED(webhookEvent.providerEventId),
        error,
      );
      throw error;
    }
  }
}
