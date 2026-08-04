/**
 * @fileoverview Main payments orchestration service.
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  PAYMENTS_MODULE_OPTIONS,
  type PaymentsModuleOptions,
} from './common/interfaces/payments-module-options.interface';
import { PaymentCustomersService } from './payment-customers/payment-customers.service';
import { PaymentProvidersService } from './payment-providers/payment-providers.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { CreatePaymentCustomerDto } from './payment-customers/dto/create-payment-customer.dto';
import { CreateCheckoutSessionDto } from './common/dto/create-checkout-session.dto';
import { CreateBillingPortalSessionDto } from './common/dto/create-billing-portal-session.dto';
import { AttachPaymentMethodDto } from './common/dto/attach-payment-method.dto';
import { PricesService } from './prices/prices.service';
import { PaymentMethodsService } from './payment-methods/payment-methods.service';
import { InvoicesService } from './invoices/invoices.service';
import {
  LOG_MESSAGES,
  ERROR_MESSAGES,
} from './common/messages/payment.messages';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { PaymentProviderCode } from './common/enums/payment.enums';
import { StripeService } from './providers/stripe/stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENTS_MODULE_OPTIONS)
    private readonly options: PaymentsModuleOptions,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly pricesService: PricesService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly invoicesService: InvoicesService,
    private readonly stripeService: StripeService,
  ) {}

  /*
   * Resolves the payment provider client for a provider ID.
   */
  private async resolveProviderClient(paymentProviderId: string): Promise<{
    provider: Awaited<ReturnType<PaymentProvidersService['findById']>>;
    client: PaymentProvider;
  }> {
    try {
      const provider =
        await this.paymentProvidersService.findById(paymentProviderId);
      return {
        provider,
        client: this.paymentProviderRegistry.resolve(provider.code),
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_PROVIDER.FIND_FAILED(paymentProviderId),
        error,
      );
      throw error;
    }
  }

  /*
   * Creates a customer in the payment provider and returns mapped result.
   */
  async createCustomer(userId: string, dto: CreatePaymentCustomerDto) {
    try {
      return this.paymentCustomersService.create(userId, dto);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.CREATE_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /*
   * Returns Stripe publishable key required for embedded checkout.
   */
  getCheckoutConfig() {
    try {
      const publishableKey = this.stripeService.getPublishableKey();
      if (!publishableKey) {
        throw new BadRequestException(  
          ERROR_MESSAGES.CHECKOUT.MISSING_PUBLISHABLE_KEY,
        );
      }

      return { publishableKey };
    } catch (error) {
      this.logger.error('Failed to resolve checkout config', error);
      throw error;
    }
  }

  /*
   * Creates an embedded checkout session with client secret for in-app payment.
   */
  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    try {
      const publishableKey = this.stripeService.getPublishableKey();
      if (!publishableKey) {
        throw new BadRequestException(
          ERROR_MESSAGES.CHECKOUT.MISSING_PUBLISHABLE_KEY,
        );
      }

      const price = await this.pricesService.findOne(dto.priceId);
      const { client } = await this.resolveProviderClient(
        price.paymentProviderId,
      );
      let customer =
        await this.paymentCustomersService.findByUserAndPaymentProviderId(
          userId,
          price.paymentProviderId,
        );

      if (!customer) {
        customer = await this.paymentCustomersService.create(userId, {
          paymentProviderId: price.paymentProviderId,
          email: dto.email,
          name: dto.name,
          metadata: { userId },
        });
      }

      const returnUrl =
        dto.returnUrl ??
        `${this.options.stripe?.successUrl ?? 'http://localhost:5173/billing/success'}?session_id={CHECKOUT_SESSION_ID}`;

      const session = await client.createCheckoutSession({
        providerCustomerId: customer.providerCustomerId,
        providerPriceId: price.providerPriceId,
        returnUrl,
        metadata: { userId, priceId: price.id },
      });

      return {
        ...session,
        publishableKey,
      };
    } catch (error) {
      this.logger.error(LOG_MESSAGES.CHECKOUT.CREATE_FAILED(userId), error);
      throw error;
    }
  }

  /*
   * Resolves checkout completion status and linked subscription when available.
   */
  async getCheckoutSessionStatus(userId: string, sessionId: string) {
    try {
      const client = this.paymentProviderRegistry.resolve(
        PaymentProviderCode.STRIPE,
      );
      const checkoutSession = await client.retrieveCheckoutSession(sessionId);

      let subscription = null;
      if (checkoutSession.providerSubscriptionId) {
        subscription =
          await this.subscriptionsService.findByProviderSubscriptionId(
            checkoutSession.providerSubscriptionId,
            PaymentProviderCode.STRIPE,
          );
      }

      if (
        !subscription &&
        checkoutSession.status === 'complete' &&
        checkoutSession.providerSubscriptionId
      ) {
        const sessionUserId = checkoutSession.metadata?.userId ?? userId;
        if (sessionUserId === userId) {
          subscription = await this.subscriptionsService.syncFromStripeCheckout(
            {
              userId,
              providerCode: PaymentProviderCode.STRIPE,
              providerCustomerId: checkoutSession.providerCustomerId || '',
              providerSubscriptionId: checkoutSession.providerSubscriptionId,
              priceId: checkoutSession.metadata?.priceId,
              email: checkoutSession.customerEmail ?? undefined,
              name: checkoutSession.customerName,
              metadata: checkoutSession.metadata,
            },
          );
        }
      }

      if (subscription && subscription.userId !== userId) {
        subscription = null;
      }

      return {
        sessionId,
        status: checkoutSession.status,
        subscription,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.CHECKOUT.CREATE_FAILED(`${userId}:${sessionId}`),
        error,
      );
      throw error;
    }
  }

  /*
   * Creates a hosted billing portal session URL.
   */
  async createBillingPortalSession(
    userId: string,
    dto: CreateBillingPortalSessionDto,
  ) {
    try {
      const { client } = await this.resolveProviderClient(
        dto.paymentProviderId,
      );
      const customer =
        await this.paymentCustomersService.findByUserAndPaymentProviderId(
          userId,
          dto.paymentProviderId,
        );
      if (!customer) {
        throw new Error('Payment customer not found');
      }

      return client.createBillingPortalSession({
        providerCustomerId: customer.providerCustomerId,
        returnUrl: dto.returnUrl,
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.BILLING_PORTAL.CREATE_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /*
   * Cancels a subscription on the provider immediately or at period end.
   */
  async cancelSubscription(id: string, cancelAtPeriodEnd = true) {
    try {
      return this.subscriptionsService.cancel(id, cancelAtPeriodEnd);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.CANCEL_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Resumes a subscription that was set to cancel at period end.
   */
  async resumeSubscription(id: string) {
    try {
      return this.subscriptionsService.resume(id);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.RESUME_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Attaches a payment method to a customer and sets it as default.
   */
  async attachPaymentMethod(userId: string, dto: AttachPaymentMethodDto) {
    try {
      const { client } = await this.resolveProviderClient(
        dto.paymentProviderId,
      );
      const customer =
        await this.paymentCustomersService.findByUserAndPaymentProviderId(
          userId,
          dto.paymentProviderId,
        );
      if (!customer) {
        throw new Error('Payment customer not found');
      }

      const providerMethod = await client.attachPaymentMethod(
        customer.providerCustomerId,
        dto.providerPaymentMethodId,
      );

      return this.paymentMethodsService.syncFromProviderResult(
        dto.paymentProviderId,
        customer.id,
        userId,
        providerMethod,
      );
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(dto.providerPaymentMethodId),
        error,
      );
      throw error;
    }
  }

  /*
   * Lists payment methods for a provider customer.
   */
  async listPaymentMethods(userId: string, paymentProviderId: string) {
    try {
      const { client } = await this.resolveProviderClient(paymentProviderId);
      const customer =
        await this.paymentCustomersService.findByUserAndPaymentProviderId(
          userId,
          paymentProviderId,
        );
      if (!customer) {
        return [];
      }

      const providerPaymentMethods = await client.listPaymentMethods(
        customer.providerCustomerId,
      );

      const syncedPaymentMethods = [];
      for (const providerPaymentMethod of providerPaymentMethods) {
        syncedPaymentMethods.push(
          await this.paymentMethodsService.syncFromProviderResult(
            paymentProviderId,
            customer.id,
            userId,
            providerPaymentMethod,
          ),
        );
      }
      return syncedPaymentMethods;
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(
          `${userId}:${paymentProviderId}`,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Lists invoices for a provider customer.
   */
  async listInvoices(userId: string, paymentProviderId: string) {
    try {
      const customer =
        await this.paymentCustomersService.findByUserAndPaymentProviderId(
          userId,
          paymentProviderId,
        );
      if (!customer) {
        return [];
      }
      return this.invoicesService.listByCustomer(
        customer.id,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.INVOICE.LIST_FAILED(`${userId}:${paymentProviderId}`),
        error,
      );
      throw error;
    }
  }
}
