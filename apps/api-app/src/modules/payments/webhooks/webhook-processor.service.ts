/**
 * @fileoverview Webhook processing orchestration service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { WebhookEventsService } from './webhook-events.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { StripeWebhookHandler } from '../providers/stripe/stripe.webhook';
import { PaymentProviderCode } from '../common/enums/payment.enums';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { WebhookProcessingStatus } from '../common/enums/payment.enums';

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    private readonly webhookEventsService: WebhookEventsService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly stripeWebhookHandler: StripeWebhookHandler,
  ) {}

  /*
   * Routes an incoming webhook payload to the correct provider handler.
   */
  async process(
    providerCode: string,
    payload: Buffer | string,
    signature: string,
  ) {
    const normalizedCode = providerCode.toUpperCase();
    let webhookEvent: Awaited<
      ReturnType<WebhookEventsService['persist']>
    > | null = null;

    try {
      const provider = this.paymentProviderRegistry.resolve(normalizedCode);
      const providerWebhookEvent = await provider.constructWebhookEvent(
        payload,
        signature,
      );

      webhookEvent = await this.webhookEventsService.persist({
        providerCode: normalizedCode,
        providerEventId: providerWebhookEvent.providerEventId,
        eventType: providerWebhookEvent.eventType,
        payload: providerWebhookEvent.payload,
      });

      if (webhookEvent.processingStatus === WebhookProcessingStatus.PROCESSED) {
        return webhookEvent;
      }

      await this.dispatch(
        normalizedCode,
        providerWebhookEvent.eventType,
        providerWebhookEvent.payload,
      );
      return this.webhookEventsService.markProcessed(webhookEvent);
    } catch (error) {
      if (webhookEvent) {
        await this.webhookEventsService.markFailed(
          webhookEvent,
          error instanceof Error ? error.message : 'Webhook processing failed',
        );
      }
      this.logger.error(
        LOG_MESSAGES.WEBHOOK.RECEIVE_FAILED(normalizedCode),
        error,
      );
      throw error;
    }
  }

  /*
   * Dispatch.
   */
  private async dispatch(
    providerCode: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const normalizedCode = providerCode.toUpperCase();

      if (normalizedCode === (PaymentProviderCode.STRIPE as string)) {
        await this.stripeWebhookHandler.handle(eventType, payload);
        return;
      }

      throw new Error(
        ERROR_MESSAGES.PAYMENT_PROVIDER.UNSUPPORTED(providerCode),
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.WEBHOOK.PROCESS_FAILED(eventType), error);
      throw error;
    }
  }
}
