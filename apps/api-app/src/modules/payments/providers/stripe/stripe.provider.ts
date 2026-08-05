/**
 * @fileoverview Stripe payment provider implementation.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  PaymentProvider,
  ProviderBillingPortalSessionInput,
  ProviderBillingPortalSessionResult,
  ProviderChangeSubscriptionPlanInput,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionResult,
  ProviderUpgradeCheckoutSessionInput,
  ProviderUpgradeCheckoutSessionResult,
  ProviderCustomerInput,
  ProviderCustomerResult,
  ProviderInvoiceResult,
  ProviderPaymentMethodResult,
  ProviderPaymentResult,
  ProviderPlanChangePreviewInput,
  ProviderPlanChangePreviewResult,
  ProviderPriceInput,
  ProviderPriceResult,
  ProviderProductInput,
  ProviderProductResult,
  ProviderSubscriptionInput,
  ProviderSubscriptionResult,
  ProviderWebhookEvent,
} from '../payment-provider.interface';
import { PaymentProviderCode } from '../../common/enums/payment.enums';
import { StripeService } from './stripe.service';
import {
  mapStripeInvoiceStatus,
  mapStripePaymentMethodType,
  mapStripePaymentStatus,
  mapStripeSubscriptionStatus,
  toDateFromUnix,
  resolveStripeResourceId,
} from '../../common/utils/payment-mapper.util';
import {
  toMajorAmount,
  toProviderMinorAmount,
} from '../../common/utils/currency-amount.util';
import { rethrowStripeError } from '../../common/utils/stripe-error.util';
import { ERROR_MESSAGES } from '../../common/messages/payment.messages';
import { now, toDate } from '../../common/utils/date.util';

/*
 * Immediately invoices proration adjustments during upgrades so they are not
 * collected again on the next billing cycle invoice.
 */
const UPGRADE_PRORATION_BEHAVIOR = 'always_invoice' as const;

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly code = PaymentProviderCode.STRIPE;

  constructor(private readonly stripeService: StripeService) {}

  /*
   * Creates a Stripe customer and maps the response to provider types.
   */
  async createCustomer(
    input: ProviderCustomerInput,
  ): Promise<ProviderCustomerResult> {
    try {
      const customer = await this.stripeService.getClient().customers.create({
        email: input.email,
        name: input.name,
        metadata: input.metadata,
      });
      return { providerCustomerId: customer.id };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Updates Stripe customer email, name, and metadata.
   */
  async updateCustomer(
    providerCustomerId: string,
    input: Partial<ProviderCustomerInput>,
  ): Promise<ProviderCustomerResult> {
    try {
      const customer = await this.stripeService
        .getClient()
        .customers.update(providerCustomerId, {
          email: input.email,
          name: input.name,
          metadata: input.metadata,
        });
      return { providerCustomerId: customer.id };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a Stripe product for catalog sync.
   */
  async createProduct(
    input: ProviderProductInput,
  ): Promise<ProviderProductResult> {
    try {
      const product = await this.stripeService.getClient().products.create({
        name: input.name,
        description: input.description,
        metadata: input.metadata,
      });
      return { providerProductId: product.id };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a Stripe price linked to a product.
   */
  async createPrice(input: ProviderPriceInput): Promise<ProviderPriceResult> {
    try {
      const price = await this.stripeService.getClient().prices.create({
        product: input.providerProductId,
        currency: input.currency.toLowerCase(),
        unit_amount: toProviderMinorAmount(input.amount, input.currency),
        recurring: input.interval
          ? {
              interval:
                input.interval.toLowerCase() as Stripe.PriceCreateParams.Recurring.Interval,
              interval_count: input.intervalCount ?? 1,
            }
          : undefined,
        metadata: input.metadata,
      });
      return { providerPriceId: price.id };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a Stripe subscription with error-if-incomplete payment behavior.
   */
  async createSubscription(
    input: ProviderSubscriptionInput,
  ): Promise<ProviderSubscriptionResult> {
    try {
      await this.validateCustomerPaymentMethod(input.providerCustomerId);
      const subscription = await this.stripeService
        .getClient()
        .subscriptions.create({
          customer: input.providerCustomerId,
          items: [{ price: input.providerPriceId }],
          metadata: input.metadata,
        });
      return this.mapSubscription(subscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Cancels a Stripe subscription immediately or at period end.
   */
  async cancelSubscription(
    providerSubscriptionId: string,
    cancelAtPeriodEnd = true,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const stripe = this.stripeService.getClient();
      await this.releaseSubscriptionSchedule(providerSubscriptionId);

      const subscription = cancelAtPeriodEnd
        ? await stripe.subscriptions.update(providerSubscriptionId, {
            cancel_at_period_end: true,
          })
        : await stripe.subscriptions.cancel(providerSubscriptionId);
      return this.mapSubscription(subscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Removes cancel-at-period-end from a Stripe subscription.
   */
  async resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const stripe = this.stripeService.getClient();
      await this.releaseSubscriptionSchedule(providerSubscriptionId);
      const subscription = await stripe.subscriptions.update(
        providerSubscriptionId,
        {
          cancel_at_period_end: false,
        },
      );
      return this.mapSubscription(subscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Routes plan changes to immediate upgrade or scheduled downgrade logic.
   */
  async changeSubscriptionPlan(
    input: ProviderChangeSubscriptionPlanInput,
  ): Promise<ProviderSubscriptionResult> {
    try {
      if (input.isUpgrade) {
        return this.applyImmediatePlanChange(input);
      }
      return this.scheduleDowngradeSubscriptionPlan(
        input.providerSubscriptionId,
        input.providerPriceId,
      );
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Calls Stripe invoice preview for proration estimates.
   */
  async previewSubscriptionPlanChange(
    input: ProviderPlanChangePreviewInput,
  ): Promise<ProviderPlanChangePreviewResult> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        input.providerSubscriptionId,
      );
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      const periodStart =
        subscriptionItem.current_period_start ?? subscription.start_date;
      const periodEnd =
        subscriptionItem.current_period_end ??
        periodStart ??
        subscription.start_date;

      const currentProviderPriceId = resolveStripeResourceId(subscriptionItem.price);
      const intervalChange = await this.isBillingIntervalChange(
        currentProviderPriceId,
        input.providerPriceId,
      );

      const subscriptionDetails: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails =
        {
          items: [{ id: subscriptionItem.id, price: input.providerPriceId }],
          proration_behavior: 'create_prorations',
          ...(intervalChange ? { billing_cycle_anchor: 'now' } : {}),
        };

      const invoicePreview = await stripe.invoices.createPreview({
        customer: input.providerCustomerId,
        subscription: input.providerSubscriptionId,
        subscription_details: subscriptionDetails,
      });

      const currency = invoicePreview.currency.toUpperCase();
      let prorationCredit = 0;
      let prorationCharge = 0;

      for (const invoiceLine of invoicePreview.lines.data) {
        const amount = toMajorAmount(invoiceLine.amount, currency);
        const isProrationLine = Boolean(
          invoiceLine.parent?.invoice_item_details?.proration ||
          invoiceLine.parent?.subscription_item_details?.proration,
        );
        if (amount < 0) {
          prorationCredit += Math.abs(amount);
        } else if (isProrationLine) {
          prorationCharge += amount;
        }
      }

      const netProrationAmount = Math.max(prorationCharge - prorationCredit, 0);
      const estimatedAmountPayable = netProrationAmount;

      return {
        currency,
        currentProviderPriceId: resolveStripeResourceId(subscriptionItem.price),
        newProviderPriceId: input.providerPriceId,
        currentPeriodStart:
          toDateFromUnix(periodStart) ?? toDate(subscription.start_date * 1000),
        currentPeriodEnd:
          toDateFromUnix(periodEnd) ?? toDate(subscription.start_date * 1000),
        prorationCredit,
        prorationCharge,
        netProrationAmount,
        estimatedAmountPayable,
        invoiceTotal: toMajorAmount(invoicePreview.total, currency),
        remainingPeriodSeconds: Math.max(
          (periodEnd ?? subscription.start_date) - now().unix(),
          0,
        ),
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Releases the subscription schedule and restores the base subscription.
   */
  async cancelScheduledPlanChange(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      await this.releaseSubscriptionSchedule(providerSubscriptionId);
      const subscription = await this.stripeService
        .getClient()
        .subscriptions.retrieve(providerSubscriptionId);
      return this.mapSubscription(subscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Verifies the Stripe customer has a default payment method.
   */
  async validateCustomerPaymentMethod(
    providerCustomerId: string,
  ): Promise<void> {
    try {
      const customer = await this.stripeService
        .getClient()
        .customers.retrieve(providerCustomerId);

      if (customer.deleted) {
        throw new BadRequestException(ERROR_MESSAGES.STRIPE.INVALID_CUSTOMER);
      }

      const defaultPaymentMethod = resolveStripeResourceId(
        customer.invoice_settings?.default_payment_method,
      );

      if (defaultPaymentMethod) {
        return;
      }

      const listedPaymentMethods = await this.stripeService
        .getClient()
        .paymentMethods.list({
          customer: providerCustomerId,
          type: 'card',
          limit: 1,
        });

      if (listedPaymentMethods.data.length === 0) {
        throw new BadRequestException(
          ERROR_MESSAGES.SUBSCRIPTION.MISSING_PAYMENT_METHOD,
        );
      }
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Updates invoice_settings.default_payment_method on the customer.
   */
  async setDefaultPaymentMethod(
    providerCustomerId: string,
    providerPaymentMethodId: string,
  ): Promise<void> {
    try {
      await this.stripeService
        .getClient()
        .customers.update(providerCustomerId, {
          invoice_settings: {
            default_payment_method: providerPaymentMethodId,
          },
        });
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Applies an immediate subscription item change with proration.
   */
  private async applyImmediatePlanChange(
    input: ProviderChangeSubscriptionPlanInput,
  ): Promise<ProviderSubscriptionResult> {
    try {
      await this.validateCustomerPaymentMethod(input.providerCustomerId);

      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        input.providerSubscriptionId,
      );
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      await this.releaseSubscriptionSchedule(input.providerSubscriptionId);

      const currentProviderPriceId = resolveStripeResourceId(subscriptionItem.price);
      const intervalChange = await this.isBillingIntervalChange(
        currentProviderPriceId,
        input.providerPriceId,
      );

      const updatedSubscription = await stripe.subscriptions.update(
        input.providerSubscriptionId,
        {
          items: [{ id: subscriptionItem.id, price: input.providerPriceId }],
          proration_behavior: UPGRADE_PRORATION_BEHAVIOR,
          payment_behavior: 'error_if_incomplete',
          billing_cycle_anchor: intervalChange ? 'now' : 'unchanged',
        },
      );

      await this.assertUpgradeInvoiceSettled(updatedSubscription);

      const refreshedSubscription = await stripe.subscriptions.retrieve(
        input.providerSubscriptionId,
        { expand: ['items.data.price'] },
      );

      if (
        resolveStripeResourceId(refreshedSubscription.items.data[0]?.price) !==
        input.providerPriceId
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.SUBSCRIPTION.PAYMENT_FAILED,
        );
      }

      return this.mapSubscription(refreshedSubscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a two-phase subscription schedule for a deferred downgrade.
   */
  private async scheduleDowngradeSubscriptionPlan(
    providerSubscriptionId: string,
    providerPriceId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
      );
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      const currentProviderPriceId = resolveStripeResourceId(
        subscriptionItem.price,
      );
      const periodStart = subscriptionItem.current_period_start;
      const periodEnd = subscriptionItem.current_period_end;
      const existingScheduleId = resolveStripeResourceId(subscription.schedule);

      const phases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = [
        {
          items: [{ price: currentProviderPriceId, quantity: 1 }],
          start_date: periodStart,
          end_date: periodEnd,
        },
        {
          items: [{ price: providerPriceId, quantity: 1 }],
        },
      ];

      let scheduleId = existingScheduleId;
      if (existingScheduleId) {
        await stripe.subscriptionSchedules.update(existingScheduleId, {
          end_behavior: 'release',
          phases,
        });
      } else {
        const subscriptionSchedule = await stripe.subscriptionSchedules.create({
          from_subscription: providerSubscriptionId,
        });
        scheduleId = subscriptionSchedule.id;
        await stripe.subscriptionSchedules.update(subscriptionSchedule.id, {
          end_behavior: 'release',
          phases,
        });
      }

      const updatedSubscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
      );
      const providerSubscriptionResult =
        this.mapSubscription(updatedSubscription);
      providerSubscriptionResult.scheduledChange = {
        providerScheduleId: scheduleId,
        pendingProviderPriceId: providerPriceId,
        effectiveAt: toDateFromUnix(periodEnd)!,
      };
      return providerSubscriptionResult;
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Returns true when a plan change switches billing interval or cadence.
   */
  private async isBillingIntervalChange(
    currentProviderPriceId: string,
    newProviderPriceId: string,
  ): Promise<boolean> {
    try {
      const stripe = this.stripeService.getClient();
      const [currentPrice, newPrice] = await Promise.all([
        stripe.prices.retrieve(currentProviderPriceId),
        stripe.prices.retrieve(newProviderPriceId),
      ]);

      return (
        currentPrice.recurring?.interval !== newPrice.recurring?.interval ||
        (currentPrice.recurring?.interval_count ?? 1) !==
          (newPrice.recurring?.interval_count ?? 1)
      );
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Ensures the proration invoice is paid before completing an upgrade.
   */
  private async assertUpgradeInvoiceSettled(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const latestInvoiceId = resolveStripeResourceId(
        subscription.latest_invoice,
      );
      if (!latestInvoiceId) {
        return;
      }

      const invoice = await this.stripeService
        .getClient()
        .invoices.retrieve(latestInvoiceId);
      const amountDue = toMajorAmount(invoice.amount_due, invoice.currency);

      if (amountDue <= 0 || invoice.status === 'paid') {
        return;
      }

      if (invoice.status === 'open') {
        throw new BadRequestException(
          ERROR_MESSAGES.SUBSCRIPTION.PAYMENT_REQUIRED,
        );
      }

      throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.PAYMENT_FAILED);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Releases an active schedule and returns the underlying subscription.
   */
  private async releaseSubscriptionSchedule(
    providerSubscriptionId: string,
  ): Promise<void> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
      );
      const scheduleId = resolveStripeResourceId(subscription.schedule);
      if (!scheduleId) {
        return;
      }
      await stripe.subscriptionSchedules.release(scheduleId);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Fetches the latest Stripe subscription by ID.
   */
  async retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const subscription = await this.stripeService
        .getClient()
        .subscriptions.retrieve(providerSubscriptionId, {
          expand: ['items.data.price'],
        });
      return this.mapSubscription(subscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates an incomplete subscription and returns the first invoice payment secret.
   */
  async createCheckoutSession(
    input: ProviderCheckoutSessionInput,
  ): Promise<ProviderCheckoutSessionResult> {
    try {
      const subscription = await this.stripeService
        .getClient()
        .subscriptions.create({
          customer: input.providerCustomerId,
          items: [{ price: input.providerPriceId, quantity: 1 }],
          payment_behavior: 'default_incomplete',
          payment_settings: {
            save_default_payment_method: 'on_subscription',
          },
          expand: ['latest_invoice.confirmation_secret'],
          metadata: input.metadata,
        });

      const latestInvoice = subscription.latest_invoice;
      if (!latestInvoice || typeof latestInvoice === 'string') {
        throw new BadRequestException(
          ERROR_MESSAGES.CHECKOUT.SESSION_CREATE_FAILED,
        );
      }

      const clientSecret = latestInvoice.confirmation_secret?.client_secret;
      if (!clientSecret) {
        throw new BadRequestException(
          ERROR_MESSAGES.CHECKOUT.SESSION_CREATE_FAILED,
        );
      }

      return {
        clientSecret,
        sessionId: subscription.id,
        providerSubscriptionId: subscription.id,
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Applies an upgrade with incomplete payment and returns the proration invoice secret.
   */
  async createUpgradeCheckoutSession(
    input: ProviderUpgradeCheckoutSessionInput,
  ): Promise<ProviderUpgradeCheckoutSessionResult> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        input.providerSubscriptionId,
      );
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      await this.releaseSubscriptionSchedule(input.providerSubscriptionId);

      const currentProviderPriceId = resolveStripeResourceId(subscriptionItem.price);
      const intervalChange = await this.isBillingIntervalChange(
        currentProviderPriceId,
        input.providerPriceId,
      );

      const updatedSubscription = await stripe.subscriptions.update(
        input.providerSubscriptionId,
        {
          items: [{ id: subscriptionItem.id, price: input.providerPriceId }],
          proration_behavior: UPGRADE_PRORATION_BEHAVIOR,
          payment_behavior: 'default_incomplete',
          billing_cycle_anchor: intervalChange ? 'now' : 'unchanged',
          expand: ['latest_invoice.confirmation_secret'],
          metadata: {
            ...(subscription.metadata ?? {}),
            ...(input.metadata ?? {}),
          },
        },
      );

      const latestInvoice = updatedSubscription.latest_invoice;
      if (!latestInvoice || typeof latestInvoice === 'string') {
        throw new BadRequestException(
          ERROR_MESSAGES.CHECKOUT.SESSION_CREATE_FAILED,
        );
      }

      const clientSecret = latestInvoice.confirmation_secret?.client_secret;
      if (!clientSecret) {
        throw new BadRequestException(
          ERROR_MESSAGES.CHECKOUT.SESSION_CREATE_FAILED,
        );
      }

      const currency = latestInvoice.currency.toUpperCase();

      return {
        clientSecret,
        sessionId: updatedSubscription.id,
        providerSubscriptionId: updatedSubscription.id,
        amountDue: toMajorAmount(latestInvoice.amount_due, currency),
        currency,
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Retrieves a Stripe Checkout session by ID.
   */
  async retrieveCheckoutSession(sessionId: string): Promise<{
    status: string | null;
    providerSubscriptionId: string | null;
    providerCustomerId: string | null;
    metadata: Record<string, string>;
    customerEmail: string | null;
    customerName: string | null;
  }> {
    try {
      const checkoutSession = await this.stripeService
        .getClient()
        .checkout.sessions.retrieve(sessionId);

      const providerSubscriptionId = resolveStripeResourceId(
        checkoutSession.subscription,
      );

      return {
        status: checkoutSession.status,
        providerSubscriptionId,
        providerCustomerId: resolveStripeResourceId(checkoutSession.customer),
        metadata: checkoutSession.metadata ?? {},
        customerEmail: checkoutSession.customer_details?.email ?? null,
        customerName: checkoutSession.customer_details?.name ?? null,
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a Stripe Billing Portal session for self-service management.
   */
  async createBillingPortalSession(
    input: ProviderBillingPortalSessionInput,
  ): Promise<ProviderBillingPortalSessionResult> {
    try {
      const billingPortalSession = await this.stripeService
        .getClient()
        .billingPortal.sessions.create({
          customer: input.providerCustomerId,
          return_url: input.returnUrl,
        });
      return { url: billingPortalSession.url };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Retrieves a Stripe payment method by ID.
   */
  async retrievePaymentMethod(
    providerPaymentMethodId: string,
  ): Promise<ProviderPaymentMethodResult> {
    try {
      const stripePaymentMethod = await this.stripeService
        .getClient()
        .paymentMethods.retrieve(providerPaymentMethodId);
      return this.mapPaymentMethod(stripePaymentMethod);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Lists card payment methods attached to a Stripe customer.
   */
  async listPaymentMethods(
    providerCustomerId: string,
  ): Promise<ProviderPaymentMethodResult[]> {
    try {
      const customer = await this.stripeService
        .getClient()
        .customers.retrieve(providerCustomerId);
      const defaultPaymentMethodId = customer.deleted
        ? ''
        : resolveStripeResourceId(
            customer.invoice_settings?.default_payment_method,
          );

      const listedPaymentMethods = await this.stripeService
        .getClient()
        .paymentMethods.list({
          customer: providerCustomerId,
          type: 'card',
        });
      return listedPaymentMethods.data.map(
        (stripePaymentMethod: Stripe.PaymentMethod) =>
          this.mapPaymentMethod(stripePaymentMethod, defaultPaymentMethodId),
      );
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Attaches a payment method and sets it as the customer default.
   */
  async attachPaymentMethod(
    providerCustomerId: string,
    providerPaymentMethodId: string,
  ): Promise<ProviderPaymentMethodResult> {
    try {
      const stripePaymentMethod = await this.stripeService
        .getClient()
        .paymentMethods.attach(providerPaymentMethodId, {
          customer: providerCustomerId,
        });
      await this.setDefaultPaymentMethod(
        providerCustomerId,
        providerPaymentMethodId,
      );
      return this.mapPaymentMethod(
        stripePaymentMethod,
        providerPaymentMethodId,
      );
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Lists Stripe invoices for a customer.
   */
  async listInvoices(
    providerCustomerId: string,
  ): Promise<ProviderInvoiceResult[]> {
    try {
      const invoices = await this.stripeService.getClient().invoices.list({
        customer: providerCustomerId,
        limit: 100,
        expand: [
          'data.lines.data.price',
          'data.lines.data.pricing.price_details.price',
        ],
      });

      return invoices.data.map((invoice: Stripe.Invoice) =>
        this.mapInvoice(invoice),
      );
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Verifies the Stripe signature and constructs the event object.
   */
  async constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Promise<ProviderWebhookEvent> {
    try {
      const stripeWebhookEvent = await Promise.resolve(
        this.stripeService
          .getClient()
          .webhooks.constructEvent(
            payload,
            signature,
            this.stripeService.getWebhookSecret(),
          ),
      );
      return {
        providerEventId: stripeWebhookEvent.id,
        eventType: stripeWebhookEvent.type,
        payload: stripeWebhookEvent as unknown as Record<string, unknown>,
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Maps a Stripe subscription object into provider-neutral subscription result.
   */
  mapSubscription(
    subscription: Stripe.Subscription,
  ): ProviderSubscriptionResult {
    const subscriptionItem = subscription.items.data[0];
    const periodStart =
      subscriptionItem?.current_period_start ?? subscription.start_date;
    const periodEnd =
      subscriptionItem?.current_period_end ??
      periodStart ??
      subscription.start_date;

    return {
      providerSubscriptionId: subscription.id,
      providerCustomerId: resolveStripeResourceId(subscription.customer),
      providerPriceId: resolveStripeResourceId(subscriptionItem?.price),
      subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
      currentPeriodStart:
        toDateFromUnix(periodStart) ?? toDate(subscription.start_date * 1000),
      currentPeriodEnd:
        toDateFromUnix(periodEnd) ?? toDate(subscription.start_date * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: toDateFromUnix(subscription.canceled_at),
      trialStart: toDateFromUnix(subscription.trial_start),
      trialEnd: toDateFromUnix(subscription.trial_end),
      scheduledChange: null,
    };
  }

  /*
   * Maps a Stripe invoice object into provider-neutral invoice result.
   */
  mapInvoice(invoice: Stripe.Invoice): ProviderInvoiceResult {
    const subscriptionRef =
      invoice.parent?.subscription_details?.subscription ??
      (
        invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        }
      ).subscription ??
      null;
    const providerSubscriptionId =
      resolveStripeResourceId(subscriptionRef) || null;
    const subscriptionLine = this.resolveInvoiceSubscriptionLine(invoice);

    return {
      providerInvoiceId: invoice.id,
      providerSubscriptionId,
      providerPaymentId: null,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      invoiceStatus: mapStripeInvoiceStatus(invoice.status ?? 'draft'),
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      paidAt: toDateFromUnix(invoice.status_transitions.paid_at),
      providerPriceId: subscriptionLine?.priceId ?? null,
      planName: subscriptionLine
        ? this.formatStripePlanLabel(
            subscriptionLine.productName,
            subscriptionLine.price,
          )
        : this.resolveInvoicePlanNameFallback(invoice),
      receiptUrl: this.resolveInvoiceReceiptUrl(invoice),
      invoiceNumber: invoice.number ?? null,
    };
  }

  /*
   * Picks the primary subscription charge line, skipping proration credits.
   */
  private resolveInvoiceSubscriptionLine(
    invoice: Stripe.Invoice,
  ): {
    productName: string | null;
    price: Stripe.Price | null;
    priceId: string;
  } | null {
    type Candidate = {
      productName: string | null;
      price: Stripe.Price | null;
      priceId: string;
      amount: number;
    };

    const candidates: Candidate[] = [];

    for (const line of invoice.lines?.data ?? []) {
      const lineItem = line as Stripe.InvoiceLineItem & {
        price?: Stripe.Price | string | null;
        pricing?: {
          type?: string;
          price_details?: {
            price?: Stripe.Price | string | null;
          } | null;
        } | null;
      };

      const isProration = Boolean(
        lineItem.parent?.invoice_item_details?.proration ||
          lineItem.parent?.subscription_item_details?.proration,
      );
      if (isProration) {
        continue;
      }

      const price = this.resolveInvoiceLinePrice(lineItem);
      const priceId = this.resolveInvoiceLinePriceId(lineItem);
      if (!priceId) {
        continue;
      }
      if (price && !price.recurring) {
        continue;
      }

      const product =
        price?.product && typeof price.product === 'object'
          ? price.product
          : null;
      let productName =
        product &&
        'name' in product &&
        typeof product.name === 'string' &&
        product.name.length > 0
          ? product.name
          : null;

      if (!productName && line.description?.trim()) {
        productName =
          line.description.replace(/^\d+\s×\s/, '').split('(')[0]?.trim() ||
          line.description;
      }

      candidates.push({
        productName,
        price,
        priceId,
        amount: line.amount ?? 0,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => right.amount - left.amount);
    return candidates[0];
  }

  /*
   * Reads an expanded Stripe Price object from legacy or pricing-based line items.
   */
  private resolveInvoiceLinePrice(
    line: Stripe.InvoiceLineItem & {
      price?: Stripe.Price | string | null;
      pricing?: {
        price_details?: {
          price?: Stripe.Price | string | null;
        } | null;
      } | null;
    },
  ): Stripe.Price | null {
    if (line.price && typeof line.price === 'object') {
      return line.price;
    }

    const pricingPrice = line.pricing?.price_details?.price;
    if (pricingPrice && typeof pricingPrice === 'object') {
      return pricingPrice;
    }

    return null;
  }

  /*
   * Reads a Stripe price ID from legacy or pricing-based line items.
   */
  private resolveInvoiceLinePriceId(
    line: Stripe.InvoiceLineItem & {
      price?: Stripe.Price | string | null;
      pricing?: {
        price_details?: {
          price?: Stripe.Price | string | null;
        } | null;
      } | null;
    },
  ): string | null {
    const price = this.resolveInvoiceLinePrice(line);
    if (price?.id) {
      return price.id;
    }

    const pricingPrice = line.pricing?.price_details?.price;
    if (typeof pricingPrice === 'string' && pricingPrice.length > 0) {
      return pricingPrice;
    }

    if (typeof line.price === 'string' && line.price.length > 0) {
      return line.price;
    }

    return null;
  }

  /*
   * Formats a Stripe recurring price into a customer-facing plan label.
   */
  private formatStripePlanLabel(
    productName: string | null,
    price: Stripe.Price | null,
  ): string | null {
    const name = productName?.trim();
    if (!name || !price?.recurring) {
      return null;
    }

    const interval = price.recurring.interval;
    const intervalCount = price.recurring.interval_count ?? 1;

    if (interval === 'month' && intervalCount === 3) {
      return `${name} · Quarterly`;
    }
    if (interval === 'month' && intervalCount === 1) {
      return `${name} · Monthly`;
    }
    if (interval === 'year' && intervalCount === 1) {
      return `${name} · Yearly`;
    }

    return name;
  }

  /*
   * Fallback plan label resolver when no subscription line item is found.
   */
  private resolveInvoicePlanNameFallback(
    invoice: Stripe.Invoice,
  ): string | null {
    for (const line of invoice.lines?.data ?? []) {
      const lineItem = line as Stripe.InvoiceLineItem & {
        price?: Stripe.Price | string | null;
        pricing?: {
          price_details?: {
            price?: Stripe.Price | string | null;
          } | null;
        } | null;
      };
      const price = this.resolveInvoiceLinePrice(lineItem);
      const product =
        price?.product && typeof price.product === 'object'
          ? price.product
          : null;

      if (
        product &&
        'name' in product &&
        typeof product.name === 'string' &&
        product.name.length > 0
      ) {
        return product.name;
      }

      if (line.description?.trim()) {
        return (
          line.description.replace(/^\d+\s×\s/, '').split('(')[0]?.trim() ||
          line.description
        );
      }
    }

    return invoice.description ?? null;
  }

  /*
   * Resolves the Stripe payment receipt URL when a charge exists.
   */
  private resolveInvoiceReceiptUrl(invoice: Stripe.Invoice): string | null {
    const invoiceWithCharges = invoice as Stripe.Invoice & {
      latest_charge?: string | Stripe.Charge | null;
      charge?: string | Stripe.Charge | null;
    };

    for (const chargeRef of [
      invoiceWithCharges.latest_charge,
      invoiceWithCharges.charge,
    ]) {
      if (chargeRef && typeof chargeRef === 'object' && chargeRef.receipt_url) {
        return chargeRef.receipt_url;
      }
    }

    if (invoice.status === 'paid') {
      return invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null;
    }

    return null;
  }

  /*
   * Maps a Stripe payment intent into provider-neutral payment result.
   */
  mapPaymentIntent(paymentIntent: Stripe.PaymentIntent): ProviderPaymentResult {
    return {
      providerPaymentId: paymentIntent.id,
      providerCustomerId:
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : (paymentIntent.customer?.id ?? ''),
      providerSubscriptionId: null,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      paymentMethod: paymentIntent.payment_method_types[0]
        ? mapStripePaymentMethodType(paymentIntent.payment_method_types[0])
        : null,
      paymentStatus: mapStripePaymentStatus(paymentIntent.status),
      paidAt: paymentIntent.status === 'succeeded' ? toDate() : null,
    };
  }

  /*
   * Maps a Stripe payment method into provider-neutral payment method result.
   */
  private mapPaymentMethod(
    stripePaymentMethod: Stripe.PaymentMethod,
    defaultPaymentMethodId = '',
  ): ProviderPaymentMethodResult {
    return {
      providerPaymentMethodId: stripePaymentMethod.id,
      type: mapStripePaymentMethodType(stripePaymentMethod.type),
      brand: stripePaymentMethod.card?.brand ?? null,
      last4: stripePaymentMethod.card?.last4 ?? null,
      expMonth: stripePaymentMethod.card?.exp_month ?? null,
      expYear: stripePaymentMethod.card?.exp_year ?? null,
      isDefault: stripePaymentMethod.id === defaultPaymentMethodId,
    };
  }
}
