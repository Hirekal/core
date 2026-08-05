/**
 * @fileoverview Main payments orchestration service.
 */
import {
  BadRequestException,
  ForbiddenException,
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
import { PaymentsRecordService } from './payments-record/payments-record.service';
import { StripeProvider } from './providers/stripe/stripe.provider';
import {
  LOG_MESSAGES,
  ERROR_MESSAGES,
} from './common/messages/payment.messages';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { PaymentProviderCode, PaymentStatus } from './common/enums/payment.enums';
import { StripeService } from './providers/stripe/stripe.service';
import type { Subscription } from './subscriptions/entities/subscription.entity';
import { SyncCheckoutSubscriptionDto } from './common/dto/sync-checkout-subscription.dto';
import { resolveStripeResourceId } from './common/utils/payment-mapper.util';

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
    private readonly paymentsRecordService: PaymentsRecordService,
    private readonly stripeProvider: StripeProvider,
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

      const session = await client.createCheckoutSession({
        providerCustomerId: customer.providerCustomerId,
        providerPriceId: price.providerPriceId,
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
   * Persists the subscription locally after custom checkout payment succeeds.
   */
  async syncCheckoutSubscription(
    userId: string,
    dto: SyncCheckoutSubscriptionDto,
  ) {
    const providerSubscriptionId = dto.providerSubscriptionId;
    try {
      const stripe = this.stripeService.getClient();
      let stripeSubscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
      );

      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (
          stripeSubscription.status === 'active' ||
          stripeSubscription.status === 'trialing' ||
          stripeSubscription.status === 'past_due'
        ) {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        stripeSubscription = await stripe.subscriptions.retrieve(
          providerSubscriptionId,
        );
      }

      const metadata = stripeSubscription.metadata ?? {};
      const metadataUserId = metadata.userId;

      if (metadataUserId && metadataUserId !== userId) {
        throw new ForbiddenException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      const providerCustomerId = resolveStripeResourceId(
        stripeSubscription.customer,
      );

      const subscription = await this.subscriptionsService.syncFromStripeCheckout(
        {
          userId,
          providerCode: PaymentProviderCode.STRIPE,
          providerCustomerId,
          providerSubscriptionId,
          priceId: metadata.priceId,
          metadata: metadata as Record<string, unknown>,
        },
      );

      if (!subscription) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      try {
        await this.listPaymentMethods(userId, subscription.paymentProviderId);
      } catch (paymentMethodError) {
        this.logger.warn(
          `Payment method sync skipped after checkout for user ${userId}`,
          paymentMethodError,
        );
      }

      await this.syncCheckoutPaymentRecord(
        userId,
        subscription,
        providerCustomerId,
        providerSubscriptionId,
        dto.providerPaymentId,
      );

      return subscription;
    } catch (error) {
      this.logger.error(
        `syncCheckoutSubscription failed for user ${userId}, subscription ${providerSubscriptionId}`,
        error,
      );
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
   * Lists invoices for the authenticated user using the default provider.
   */
  async listInvoicesForUser(userId: string) {
    const provider = await this.paymentProvidersService.findByCode(
      this.options.defaultProviderCode,
    );
    return this.listInvoices(userId, provider.id);
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

  /*
   * Persists the checkout payment with a guaranteed subscription link.
   */
  private async syncCheckoutPaymentRecord(
    userId: string,
    subscription: Subscription,
    providerCustomerId: string,
    providerSubscriptionId: string,
    providerPaymentId?: string,
  ): Promise<void> {
    const stripe = this.stripeService.getClient();
    let resolvedPaymentId = providerPaymentId ?? null;

    if (!resolvedPaymentId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
        { expand: ['latest_invoice'] },
      );
      const latestInvoice = stripeSubscription.latest_invoice;
      if (latestInvoice && typeof latestInvoice !== 'string') {
        resolvedPaymentId =
          await this.stripeProvider.retrieveInvoicePaymentIntentId(
            latestInvoice.id,
          );
      }
    }

    if (!resolvedPaymentId) {
      throw new Error(ERROR_MESSAGES.PAYMENT.CHECKOUT_PAYMENT_INTENT_NOT_FOUND);
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      resolvedPaymentId,
    );

    await this.paymentsRecordService.upsertAfterCheckout({
      userId,
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      paymentProviderId: subscription.paymentProviderId,
      providerPaymentId: resolvedPaymentId,
      providerCustomerId,
      providerSubscriptionId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      paidAt:
        paymentIntent.status === 'succeeded' ? new Date() : null,
      paymentStatus:
        paymentIntent.status === 'succeeded'
          ? PaymentStatus.SUCCESS
          : PaymentStatus.PENDING,
    });
  }
}
