/**
 * @fileoverview Resolves payment providers dynamically by provider code.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';
import { StripeProvider } from './stripe/stripe.provider';
import { ERROR_MESSAGES } from '../common/messages/payment.messages';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(private readonly stripeProvider: StripeProvider) {
    this.registerProvider(this.stripeProvider);
  }

  /**
   * Registers a payment provider implementation.
   */
  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.code, provider);
  }

  /**
   * Resolves a provider implementation by code.
   */
  resolve(code: string): PaymentProvider {
    const provider = this.providers.get(code.toUpperCase());
    if (!provider) {
      throw new BadRequestException(
        ERROR_MESSAGES.PAYMENT_PROVIDER.UNSUPPORTED(code),
      );
    }
    return provider;
  }
}
