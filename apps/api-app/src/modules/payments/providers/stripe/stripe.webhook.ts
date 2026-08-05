/**
 * @fileoverview Stripe-specific webhook event handlers.
 */
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeProvider } from './stripe.provider';
import { PaymentCustomersService } from '../../payment-customers/payment-customers.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { PaymentsRecordService } from '../../payments-record/payments-record.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { PaymentMethodsService } from '../../payment-methods/payment-methods.service';
import { PricesService } from '../../prices/prices.service';
import { PaymentProviderCode } from '../../common/enums/payment.enums';
import { STRIPE_WEBHOOK_EVENTS } from '../../common/constants/payment.constants';
import { resolveStripeResourceId } from '../../common/utils/payment-mapper.util';
import { LOG_MESSAGES } from '../../common/messages/payment.messages';

@Injectable()
export class StripeWebhookHandler {
  private readonly logger = new Logger(StripeWebhookHandler.name);

  constructor(
    private readonly stripeProvider: StripeProvider,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly paymentsRecordService: PaymentsRecordService,
    private readonly invoicesService: InvoicesService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly pricesService: PricesService,
  ) {}

  /*
   * Verifies and routes incoming Stripe webhook events.
   */
  async handle(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      switch (eventType) {
        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_CREATED:
        case STRIPE_WEBHOOK_EVENTS.CUSTOMER_UPDATED:
          await this.handleCustomer(payload);
          break;
        case STRIPE_WEBHOOK_EVENTS.CHECKOUT_SESSION_COMPLETED:
          await this.handleCheckoutCompleted(payload);
          break;
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED:
          await this.handleSubscription(payload);
          break;
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_UPDATED:
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_COMPLETED:
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_RELEASED:
        case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_CANCELED:
          await this.handleSubscriptionSchedule(payload);
          break;
        case STRIPE_WEBHOOK_EVENTS.INVOICE_CREATED:
        case STRIPE_WEBHOOK_EVENTS.INVOICE_UPDATED:
        case STRIPE_WEBHOOK_EVENTS.INVOICE_FINALIZED:
        case STRIPE_WEBHOOK_EVENTS.INVOICE_PAID:
        case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
          await this.handleInvoice(payload);
          break;
        case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        case STRIPE_WEBHOOK_EVENTS.PAYMENT_INTENT_FAILED:
          await this.handlePaymentIntent(payload);
          break;
        default:
          break;
      }
    } catch (error) {
      const eventId = typeof payload.id === 'string' ? payload.id : eventType;
      this.logger.error(LOG_MESSAGES.WEBHOOK.PROCESS_FAILED(eventId), error);
      throw error;
    }
  }

  private getObject<T>(payload: Record<string, unknown>): T {
    const stripeEventData = payload.data as { object: T };
    return stripeEventData.object;
  }

  /*
   * Handle Customer.
   */
  private async handleCustomer(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const customer = this.getObject<Stripe.Customer>(payload);
    const userId = customer.metadata?.userId;
    if (!userId) {
      return;
    }

    await this.paymentCustomersService.upsertFromProvider({
      userId,
      providerCode: PaymentProviderCode.STRIPE,
      providerCustomerId: customer.id,
      email: customer.email ?? '',
      name: customer.name,
      metadata: customer.metadata,
    });
  }

  /*
   * Handle Checkout Completed.
   */
  private async handleCheckoutCompleted(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const checkoutSession = this.getObject<Stripe.Checkout.Session>(payload);
    const userId = checkoutSession.metadata?.userId;
    const priceId = checkoutSession.metadata?.priceId;
    const providerCustomerId = resolveStripeResourceId(
      checkoutSession.customer,
    );
    const providerSubscriptionId = resolveStripeResourceId(
      checkoutSession.subscription,
    );

    if (!userId || !providerSubscriptionId) {
      this.logger.warn(
        `checkout.session.completed missing userId or subscription: session=${checkoutSession.id}`,
      );
      return;
    }

    const subscription = await this.subscriptionsService.syncFromStripeCheckout(
      {
        userId,
        providerCode: PaymentProviderCode.STRIPE,
        providerCustomerId,
        providerSubscriptionId,
        priceId,
        email: checkoutSession.customer_details?.email ?? undefined,
        name: checkoutSession.customer_details?.name ?? null,
        metadata: checkoutSession.metadata as Record<string, unknown>,
      },
    );

    if (!subscription) {
      this.logger.warn(
        `checkout.session.completed did not persist subscription: session=${checkoutSession.id}`,
      );
    }
  }

  /*
   * Syncs local subscription state from Stripe subscription events.
   * Price changes apply only when the active Stripe price differs from
   * pending downgrade metadata rules handled by SubscriptionsService.
   */
  private async handleSubscription(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscription = this.getObject<Stripe.Subscription>(payload);
    const existingSubscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        subscription.id,
        PaymentProviderCode.STRIPE,
      );

    const providerResult = this.stripeProvider.mapSubscription(subscription);

    if (existingSubscription) {
      const price = await this.pricesService.findByProviderPriceId(
        providerResult.providerPriceId,
        PaymentProviderCode.STRIPE,
      );
      const priceUpdate = this.subscriptionsService.resolveWebhookPriceUpdate(
        existingSubscription,
        providerResult.providerPriceId,
        price,
        providerResult.subscriptionStatus,
        subscription.metadata ?? undefined,
      );

      await this.subscriptionsService.syncFromProviderResult(
        existingSubscription,
        providerResult,
        priceUpdate.metadata ?? existingSubscription.metadata,
        priceUpdate.priceId,
      );
      return;
    }

    const customer =
      await this.paymentCustomersService.findByProviderCustomerId(
        resolveStripeResourceId(subscription.customer),
        PaymentProviderCode.STRIPE,
      );
    if (!customer) {
      const metadataUserId = subscription.metadata?.userId;
      if (!metadataUserId) {
        this.logger.warn(
          `customer.subscription event missing local customer: subscription=${subscription.id}`,
        );
        return;
      }

      const syncedSubscription =
        await this.subscriptionsService.syncFromStripeCheckout({
          userId: metadataUserId,
          providerCode: PaymentProviderCode.STRIPE,
          providerCustomerId: resolveStripeResourceId(subscription.customer),
          providerSubscriptionId: subscription.id,
          priceId: subscription.metadata?.priceId,
          metadata: subscription.metadata,
        });

      if (!syncedSubscription) {
        this.logger.warn(
          `customer.subscription event did not persist subscription: subscription=${subscription.id}`,
        );
      }
      return;
    }

    const price = await this.pricesService.findByProviderPriceId(
      providerResult.providerPriceId,
      PaymentProviderCode.STRIPE,
    );
    if (!price) {
      this.logger.warn(
        `customer.subscription event missing local price: subscription=${subscription.id}, price=${providerResult.providerPriceId}`,
      );
      return;
    }

    await this.subscriptionsService.saveFromProviderResult({
      userId: customer.userId,
      customerId: customer.id,
      priceId: price.id,
      paymentProviderId: customer.paymentProviderId,
      providerResult,
    });
  }

  /*
   * Applies subscription schedule lifecycle events, including clearing
   * pending downgrades when a schedule is released or canceled.
   */
  private async handleSubscriptionSchedule(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionSchedule =
      this.getObject<Stripe.SubscriptionSchedule>(payload);
    const providerSubscriptionId = resolveStripeResourceId(
      subscriptionSchedule.subscription,
    );
    if (!providerSubscriptionId) {
      return;
    }

    const existingSubscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        providerSubscriptionId,
        PaymentProviderCode.STRIPE,
      );
    if (!existingSubscription) {
      return;
    }

    if (
      payload.type === STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_RELEASED ||
      payload.type === STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_SCHEDULE_CANCELED
    ) {
      const providerSubscription =
        await this.stripeProvider.retrieveSubscription(providerSubscriptionId);
      await this.subscriptionsService.syncFromProviderResult(
        existingSubscription,
        providerSubscription,
        this.subscriptionsService.clearScheduledChangeMetadata(
          existingSubscription.metadata,
        ),
      );
      return;
    }

    const providerSubscription = await this.stripeProvider.retrieveSubscription(
      providerSubscriptionId,
    );
    const price = await this.pricesService.findByProviderPriceId(
      providerSubscription.providerPriceId,
      PaymentProviderCode.STRIPE,
    );
    const priceUpdate = this.subscriptionsService.resolveWebhookPriceUpdate(
      existingSubscription,
      providerSubscription.providerPriceId,
      price,
      providerSubscription.subscriptionStatus,
    );

    await this.subscriptionsService.syncFromProviderResult(
      existingSubscription,
      providerSubscription,
      priceUpdate.metadata ?? existingSubscription.metadata,
      priceUpdate.priceId,
    );
  }

  /*
   * Handle Invoice.
   */
  private async handleInvoice(payload: Record<string, unknown>): Promise<void> {
    const invoice = this.getObject<Stripe.Invoice>(payload);
    const customer =
      await this.paymentCustomersService.findByProviderCustomerId(
        resolveStripeResourceId(invoice.customer),
        PaymentProviderCode.STRIPE,
      );
    if (!customer) {
      return;
    }

    const mappedInvoice = await this.stripeProvider.retrieveInvoiceForSync(
      invoice.id,
    );
    await this.invoicesService.syncFromProviderResult(
      customer.paymentProviderId,
      customer.userId,
      mappedInvoice,
    );

    const providerSubscriptionId = mappedInvoice.providerSubscriptionId;
    if (!providerSubscriptionId) {
      return;
    }

    const existingSubscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        providerSubscriptionId,
        PaymentProviderCode.STRIPE,
      );
    if (!existingSubscription) {
      return;
    }

    const providerSubscription = await this.stripeProvider.retrieveSubscription(
      providerSubscriptionId,
    );
    await this.subscriptionsService.syncFromProviderResult(
      existingSubscription,
      providerSubscription,
    );
  }

  /*
   * Handle Payment Intent.
   */
  private async handlePaymentIntent(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const paymentIntent = this.getObject<Stripe.PaymentIntent>(payload);
    const customerId =
      typeof paymentIntent.customer === 'string'
        ? paymentIntent.customer
        : paymentIntent.customer?.id;

    if (!customerId) {
      return;
    }

    const customer =
      await this.paymentCustomersService.findByProviderCustomerId(
        customerId,
        PaymentProviderCode.STRIPE,
      );
    if (!customer) {
      return;
    }

    await this.paymentsRecordService.syncFromProviderResult(
      PaymentProviderCode.STRIPE,
      await this.stripeProvider.mapPaymentIntentFromWebhook(paymentIntent),
      customer.userId,
    );

    if (typeof paymentIntent.payment_method === 'string') {
      const paymentMethod = await this.stripeProvider.retrievePaymentMethod(
        paymentIntent.payment_method,
      );
      await this.paymentMethodsService.syncFromProviderResult(
        customer.paymentProviderId,
        customer.id,
        customer.userId,
        paymentMethod,
      );
    }
  }
}
