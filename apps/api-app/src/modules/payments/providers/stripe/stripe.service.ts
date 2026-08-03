/**
 * @fileoverview Stripe SDK wrapper for low-level API access.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createStripeClient, type Stripe } from '../../common/utils/stripe-sdk.util';
import {
  PAYMENTS_MODULE_OPTIONS,
  type PaymentsModuleOptions,
} from '../../common/interfaces/payments-module-options.interface';
import { PaymentProviderCode } from '../../common/enums/payment.enums';
import { ERROR_MESSAGES } from '../../common/messages/payment.messages';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    @Inject(PAYMENTS_MODULE_OPTIONS)
    private readonly options: PaymentsModuleOptions,
  ) {}

  /**
   * Returns the configured Stripe publishable key when available.
   */
  getPublishableKey(): string {
    return (
      this.options.stripe?.publishableKey?.trim() ||
      process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
      ''
    );
  }

  /**
   * Returns the configured Stripe checkout cancel URL.
   */
  getCancelUrl(): string {
    return (
      this.options.stripe?.cancelUrl ??
      process.env.STRIPE_CHECKOUT_CANCEL_URL ??
      'http://localhost:5173/billing/cancel'
    );
  }

  /**
   * Returns a configured Stripe client instance.
   */
  getClient(): Stripe {
    try {
      if (!this.options.stripe?.secretKey) {
        throw new Error(
          ERROR_MESSAGES.PAYMENT_PROVIDER.NOT_CONFIGURED(
            PaymentProviderCode.STRIPE,
          ),
        );
      }

      if (!this.stripe) {
        this.stripe = createStripeClient(this.options.stripe.secretKey);
      }

      return this.stripe;
    } catch (error) {
      this.logger.error('Failed to initialize Stripe client', error);
      throw error;
    }
  }

  /**
   * Returns the configured Stripe webhook secret.
   */
  getWebhookSecret(): string {
    try {
      if (!this.options.stripe?.webhookSecret) {
        throw new Error(
          ERROR_MESSAGES.PAYMENT_PROVIDER.NOT_CONFIGURED(
            PaymentProviderCode.STRIPE,
          ),
        );
      }
      return this.options.stripe.webhookSecret;
    } catch (error) {
      this.logger.error('Failed to resolve Stripe webhook secret', error);
      throw error;
    }
  }
}
