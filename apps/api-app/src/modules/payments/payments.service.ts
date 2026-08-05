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
import { CouponsService } from './coupons/coupons.service';

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
    private readonly couponsService: CouponsService,
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
  async createCustomer(organizationId: string, dto: CreatePaymentCustomerDto) {
    try {
      return this.paymentCustomersService.create(organizationId, dto);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.CREATE_FAILED(organizationId),
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
  async createCheckoutSession(
    organizationId: string,
    dto: CreateCheckoutSessionDto,
  ) {
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
      let customer = await this.paymentCustomersService.ensureActiveForCheckout(
        organizationId,
        {
          paymentProviderId: price.paymentProviderId,
          email: dto.email,
          name: dto.name,
          metadata: { organizationId },
        },
      );

      const stripeDiscount =
        await this.couponsService.resolveStripeDiscountRef(dto.couponCode);

      const session = await client.createCheckoutSession({
        providerCustomerId: customer.providerCustomerId,
        providerPriceId: price.providerPriceId,
        metadata: {
          organizationId,
          priceId: price.id,
          ...(dto.couponCode
            ? { couponCode: dto.couponCode.trim().toUpperCase() }
            : {}),
        },
        providerCouponId: stripeDiscount?.id ?? null,
      });

      return {
        ...session,
        publishableKey,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.CHECKOUT.CREATE_FAILED(organizationId),
        error,
      );
      throw error;
    }
  }

  /*
   * Persists the subscription locally after custom checkout payment succeeds.
   */
  async syncCheckoutSubscription(
    organizationId: string,
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
      const metadataOrganizationId =
        await this.paymentCustomersService.resolveOrganizationIdFromMetadata(
          metadata,
        );

      if (
        metadataOrganizationId &&
        metadataOrganizationId !== organizationId
      ) {
        throw new ForbiddenException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      const providerCustomerId = resolveStripeResourceId(
        stripeSubscription.customer,
      );

      const subscription = await this.subscriptionsService.syncFromStripeCheckout(
        {
          organizationId,
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
        await this.listPaymentMethods(
          organizationId,
          subscription.paymentProviderId,
        );
      } catch (paymentMethodError) {
        this.logger.warn(
          `Payment method sync skipped after checkout for organization ${organizationId}`,
          paymentMethodError,
        );
      }

      await this.syncCheckoutPaymentRecord(
        organizationId,
        subscription,
        providerCustomerId,
        providerSubscriptionId,
        dto.providerPaymentId,
      );

      const couponCode =
        typeof metadata.couponCode === 'string' ? metadata.couponCode : null;
      const latestInvoiceId = resolveStripeResourceId(
        stripeSubscription.latest_invoice,
      );
      if (couponCode && latestInvoiceId) {
        await this.couponsService.recordSuccessfulRedemption({
          promotionCode: couponCode,
          organizationId,
          providerInvoiceId: latestInvoiceId,
          providerSubscriptionId,
        });
      }

      return subscription;
    } catch (error) {
      this.logger.error(
        `syncCheckoutSubscription failed for organization ${organizationId}, subscription ${providerSubscriptionId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Resolves checkout completion status and linked subscription when available.
   */
  async getCheckoutSessionStatus(organizationId: string, sessionId: string) {
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
        const sessionOrganizationId =
          (await this.paymentCustomersService.resolveOrganizationIdFromMetadata(
            checkoutSession.metadata,
          )) ?? organizationId;
        if (sessionOrganizationId === organizationId) {
          subscription = await this.subscriptionsService.syncFromStripeCheckout(
            {
              organizationId,
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

      if (subscription && subscription.organizationId !== organizationId) {
        subscription = null;
      }

      return {
        sessionId,
        status: checkoutSession.status,
        subscription,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.CHECKOUT.CREATE_FAILED(`${organizationId}:${sessionId}`),
        error,
      );
      throw error;
    }
  }

  /*
   * Creates a hosted billing portal session URL.
   */
  async createBillingPortalSession(
    organizationId: string,
    dto: CreateBillingPortalSessionDto,
  ) {
    try {
      const { client } = await this.resolveProviderClient(
        dto.paymentProviderId,
      );
      const customer =
        await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
          organizationId,
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
        LOG_MESSAGES.BILLING_PORTAL.CREATE_FAILED(organizationId),
        error,
      );
      throw error;
    }
  }

  /*
   * Cancels a subscription on the provider immediately or at period end.
   */
  async cancelSubscription(
    id: string,
    cancelAtPeriodEnd = true,
    organizationId?: string,
  ) {
    try {
      return this.subscriptionsService.cancel(
        id,
        cancelAtPeriodEnd,
        organizationId,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.CANCEL_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Resumes a subscription that was set to cancel at period end.
   */
  async resumeSubscription(id: string, organizationId?: string) {
    try {
      return this.subscriptionsService.resume(id, organizationId);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.RESUME_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Attaches a payment method to a customer and sets it as default.
   */
  async attachPaymentMethod(
    organizationId: string,
    dto: AttachPaymentMethodDto,
  ) {
    try {
      const { client } = await this.resolveProviderClient(
        dto.paymentProviderId,
      );
      const customer =
        await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
          organizationId,
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
        organizationId,
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
  async listPaymentMethods(organizationId: string, paymentProviderId: string) {
    try {
      const { client } = await this.resolveProviderClient(paymentProviderId);
      const customer =
        await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
          organizationId,
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
            organizationId,
            providerPaymentMethod,
          ),
        );
      }
      return syncedPaymentMethods;
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(
          `${organizationId}:${paymentProviderId}`,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Lists invoices for the authenticated organization using the default provider.
   */
  async listInvoicesForOrganization(organizationId: string) {
    const provider = await this.paymentProvidersService.findByCode(
      this.options.defaultProviderCode,
    );
    return this.listInvoices(organizationId, provider.id);
  }

  /*
   * Lists invoices for a provider customer.
   */
  async listInvoices(organizationId: string, paymentProviderId: string) {
    try {
      const customer =
        await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
          organizationId,
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
        LOG_MESSAGES.INVOICE.LIST_FAILED(`${organizationId}:${paymentProviderId}`),
        error,
      );
      throw error;
    }
  }

  /*
   * Persists the checkout payment with a guaranteed subscription link.
   */
  private async syncCheckoutPaymentRecord(
    organizationId: string,
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
      organizationId,
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
