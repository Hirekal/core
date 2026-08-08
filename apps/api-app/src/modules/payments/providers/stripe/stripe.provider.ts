/**
 * @fileoverview Stripe payment provider implementation.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { SUBSCRIPTION_METADATA_KEYS, UPGRADE_COUPON_CREDIT_METADATA_KEY } from '../../common/constants/subscription.constants';

const UPGRADE_PRORATION_BEHAVIOR = 'always_invoice' as const;

function buildStripeDiscounts(input: {
  providerCouponId?: string | null;
}): Stripe.SubscriptionCreateParams.Discount[] | undefined {
  // Use coupon IDs during incomplete checkout so promotion-code redemption
  // counters are not consumed before payment succeeds.
  if (input.providerCouponId) {
    return [{ coupon: input.providerCouponId }];
  }
  return undefined;
}

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly code = PaymentProviderCode.STRIPE;
  private readonly logger = new Logger(StripeProvider.name);

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
   * Returns false when the Stripe customer was deleted or cannot be retrieved.
   */
  async isProviderCustomerActive(
    providerCustomerId: string,
  ): Promise<boolean> {
    try {
      const customer = await this.stripeService
        .getClient()
        .customers.retrieve(providerCustomerId);
      return !('deleted' in customer && customer.deleted);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'resource_missing'
      ) {
        return false;
      }
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
   * Creates a Stripe coupon. Do not set max_redemptions on the coupon —
   * incomplete checkouts attach the coupon ID and would burn limited
   * counters. Global / per-customer caps live on the promotion code and
   * are enforced locally after successful paid invoices.
   */
  async createCoupon(
    params: Stripe.CouponCreateParams,
  ): Promise<Stripe.Coupon> {
    try {
      return await this.stripeService.getClient().coupons.create(params);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Creates a customer-facing Stripe promotion code for a coupon.
   * Callers should set max_redemptions for the global redemption cap.
   * Per-customer limits are enforced in CouponsService (Stripe API no longer
   * exposes restrictions.maximum_redemptions_per_customer).
   */
  async createPromotionCode(
    params: Stripe.PromotionCodeCreateParams,
  ): Promise<Stripe.PromotionCode> {
    try {
      return await this.stripeService
        .getClient()
        .promotionCodes.create(params);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Deletes a Stripe coupon (best-effort cleanup after failed sync).
   */
  async deleteCoupon(providerCouponId: string): Promise<void> {
    try {
      await this.stripeService.getClient().coupons.del(providerCouponId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete Stripe coupon ${providerCouponId} during cleanup`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /*
   * Deactivates a Stripe promotion code (promotion codes cannot be deleted).
   */
  async deactivatePromotionCode(providerPromotionCodeId: string): Promise<void> {
    try {
      await this.stripeService
        .getClient()
        .promotionCodes.update(providerPromotionCodeId, { active: false });
    } catch (error) {
      this.logger.warn(
        `Failed to deactivate Stripe promotion code ${providerPromotionCodeId} during cleanup`,
        error instanceof Error ? error.message : error,
      );
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
   * Coupons are applied to today's payable (proration), not the catalog plan price —
   * invoice-level Stripe discounts do not reduce non-discountable proration lines.
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
      const intervalChange =
        typeof input.resetBillingCycle === 'boolean'
          ? input.resetBillingCycle
          : await this.isBillingIntervalChange(
              currentProviderPriceId,
              input.providerPriceId,
            );

      const subscriptionDetails: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails =
        {
          items: [{ id: subscriptionItem.id, price: input.providerPriceId }],
          proration_behavior: 'create_prorations',
          ...(intervalChange ? { billing_cycle_anchor: 'now' } : {}),
        };

      // Do not pass invoice-level discounts: proration lines are not discountable.
      // Coupon savings are applied to the computed payable below.
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
        if (amount < 0) {
          prorationCredit += Math.abs(amount);
          continue;
        }
        if (amount <= 0) {
          continue;
        }

        const isProrationLine = this.isInvoiceLineProration(invoiceLine);
        // Same-interval upgrades: only proration deltas are due today.
        // Interval reset (billing_cycle_anchor=now): the new period charge is
        // also due immediately and is often not flagged as a proration line.
        if (isProrationLine || intervalChange) {
          prorationCharge += amount;
        }
      }

      const netProrationAmount = Math.max(prorationCharge - prorationCredit, 0);

      // When the billing cycle resets, Stripe's amount_due is the charge today
      // (new period minus unused-time credit). Prefer it.
      // Same-interval upgrades must not use amount_due — it can include the
      // next full period in addition to prorations.
      const amountDueToday = Math.max(
        toMajorAmount(invoicePreview.amount_due ?? 0, currency),
        0,
      );

      let basePayable = netProrationAmount;
      if (intervalChange && amountDueToday > 0) {
        basePayable = amountDueToday;
      }

      let discountAmount = 0;
      let discountLabel: string | null = null;
      let estimatedAmountPayable = basePayable;

      if (input.providerCouponId && basePayable > 0) {
        const stripeCoupon = await stripe.coupons.retrieve(
          input.providerCouponId,
        );
        const applied = this.applyCouponToPayableMajor(
          basePayable,
          stripeCoupon,
          currency,
        );
        discountAmount = applied.discountMajor;
        estimatedAmountPayable = applied.payableMajor;
        discountLabel = stripeCoupon.name ?? stripeCoupon.id;
      }

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
        invoiceTotal: estimatedAmountPayable,
        remainingPeriodSeconds: Math.max(
          (periodEnd ?? subscription.start_date) - now().unix(),
          0,
        ),
        discountAmount,
        discountLabel,
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
      const discounts = buildStripeDiscounts(input);
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
          ...(discounts ? { discounts } : {}),
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

      const currency = latestInvoice.currency.toUpperCase();

      return {
        clientSecret,
        sessionId: subscription.id,
        providerSubscriptionId: subscription.id,
        amountDue: toMajorAmount(latestInvoice.amount_due, currency),
        currency,
      };
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Applies an upgrade with incomplete payment and returns the proration invoice secret.
   * Coupons discount today's payable amount via a pending invoice credit (proration
   * lines are not discountable by Stripe invoice/subscription coupons).
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
      await this.clearPendingUpgradeCouponCredits(input.providerCustomerId);

      const currentProviderPriceId = resolveStripeResourceId(subscriptionItem.price);
      const intervalChange =
        typeof input.resetBillingCycle === 'boolean'
          ? input.resetBillingCycle
          : await this.isBillingIntervalChange(
              currentProviderPriceId,
              input.providerPriceId,
            );

      let couponCreditItemId: string | null = null;
      if (input.providerCouponId) {
        const basePreview = await this.previewSubscriptionPlanChange({
          providerCustomerId: input.providerCustomerId,
          providerSubscriptionId: input.providerSubscriptionId,
          providerPriceId: input.providerPriceId,
          providerCouponId: null,
          resetBillingCycle: intervalChange,
        });
        const stripeCoupon = await stripe.coupons.retrieve(
          input.providerCouponId,
        );
        const { discountMajor } = this.applyCouponToPayableMajor(
          basePreview.estimatedAmountPayable,
          stripeCoupon,
          basePreview.currency,
        );
        const discountMinor = toProviderMinorAmount(
          discountMajor,
          basePreview.currency,
        );
        if (discountMinor > 0) {
          const creditItem = await stripe.invoiceItems.create({
            customer: input.providerCustomerId,
            amount: -discountMinor,
            currency: basePreview.currency.toLowerCase(),
            description: stripeCoupon.name
              ? `Coupon (${stripeCoupon.name})`
              : 'Coupon discount',
            metadata: {
              [UPGRADE_COUPON_CREDIT_METADATA_KEY]: 'true',
              providerCouponId: input.providerCouponId,
            },
          });
          couponCreditItemId = creditItem.id;
        }
      }

      try {
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
        if (couponCreditItemId) {
          try {
            await stripe.invoiceItems.del(couponCreditItemId);
          } catch (cleanupError) {
            this.logger.warn(
              `Failed to delete upgrade coupon credit ${couponCreditItemId}`,
              cleanupError instanceof Error
                ? cleanupError.message
                : cleanupError,
            );
          }
        }
        throw error;
      }
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Reverts an unpaid upgrade checkout by restoring the previous plan on Stripe.
   */
  async revertPendingUpgradeCheckout(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
        { expand: ['latest_invoice'] },
      );

      const previousProviderPriceId =
        subscription.metadata?.[
          SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PROVIDER_PRICE_ID
        ];
      const pendingUpgradeProviderPriceId =
        subscription.metadata?.[
          SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PROVIDER_PRICE_ID
        ];

      if (!previousProviderPriceId && !pendingUpgradeProviderPriceId) {
        return this.mapSubscription(subscription);
      }

      const latestInvoice = subscription.latest_invoice;
      const latestInvoiceStatus =
        latestInvoice && typeof latestInvoice === 'object'
          ? latestInvoice.status
          : null;

      // Paid upgrade still carrying checkout metadata — finalize, don't revert.
      if (latestInvoiceStatus === 'paid') {
        return this.finalizePendingUpgradeCheckout(providerSubscriptionId);
      }

      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }

      const currentProviderPriceId = resolveStripeResourceId(
        subscriptionItem.price,
      );

      if (latestInvoice && typeof latestInvoice === 'object') {
        if (latestInvoice.status === 'open') {
          try {
            await stripe.invoices.voidInvoice(latestInvoice.id);
          } catch (voidError) {
            this.logger.warn(
              `Failed to void open invoice ${latestInvoice.id} while reverting upgrade`,
              voidError,
            );
          }
        } else if (latestInvoice.status === 'draft') {
          try {
            await stripe.invoices.del(latestInvoice.id);
          } catch (deleteError) {
            this.logger.warn(
              `Failed to delete draft invoice ${latestInvoice.id} while reverting upgrade`,
              deleteError,
            );
          }
        }
      }

      await this.clearPendingUpgradeCouponCredits(
        resolveStripeResourceId(subscription.customer) ?? '',
      );

      const clearedMetadata = { ...(subscription.metadata ?? {}) };
      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PRICE_ID
      ];
      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PROVIDER_PRICE_ID
      ];
      delete clearedMetadata[SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PRICE_ID];
      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PROVIDER_PRICE_ID
      ];

      const shouldRestorePreviousPrice =
        Boolean(previousProviderPriceId) &&
        currentProviderPriceId !== previousProviderPriceId;

      const revertedSubscription = await stripe.subscriptions.update(
        providerSubscriptionId,
        {
          ...(shouldRestorePreviousPrice
            ? {
                items: [
                  {
                    id: subscriptionItem.id,
                    price: previousProviderPriceId,
                  },
                ],
                proration_behavior: 'none',
              }
            : {}),
          metadata: clearedMetadata,
        },
      );

      return this.mapSubscription(revertedSubscription);
    } catch (error) {
      rethrowStripeError(error);
    }
  }

  /*
   * Clears unpaid-upgrade metadata after a successful upgrade payment.
   */
  async finalizePendingUpgradeCheckout(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult> {
    try {
      const stripe = this.stripeService.getClient();
      const subscription = await stripe.subscriptions.retrieve(
        providerSubscriptionId,
      );

      const clearedMetadata = { ...(subscription.metadata ?? {}) };
      const hadPendingUpgrade =
        Boolean(
          clearedMetadata[
            SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PROVIDER_PRICE_ID
          ],
        ) ||
        Boolean(
          clearedMetadata[SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PROVIDER_PRICE_ID],
        );

      if (!hadPendingUpgrade) {
        return this.mapSubscription(subscription);
      }

      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PRICE_ID
      ];
      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PENDING_UPGRADE_PROVIDER_PRICE_ID
      ];
      delete clearedMetadata[SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PRICE_ID];
      delete clearedMetadata[
        SUBSCRIPTION_METADATA_KEYS.PREVIOUS_PROVIDER_PRICE_ID
      ];

      const updatedSubscription = await stripe.subscriptions.update(
        providerSubscriptionId,
        { metadata: clearedMetadata },
      );

      return this.mapSubscription(updatedSubscription);
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
      // Stripe allows at most 4 expand levels on list responses, so
      // data.lines.data.price.product (5) is rejected. Product names are
      // resolved from line descriptions / local catalog via price IDs.
      // Charge receipt URLs are not available on list expands — fetched
      // per paid invoice via charges.retrieve (see fetchChargeReceiptUrl).
      const invoices = await this.stripeService.getClient().invoices.list({
        customer: providerCustomerId,
        limit: 100,
        expand: ['data.lines.data.price'],
      });

      return Promise.all(
        invoices.data.map(async (invoice: Stripe.Invoice) => {
          const mapped = this.mapInvoice(invoice);
          if (invoice.status === 'paid' && invoice.amount_paid > 0) {
            mapped.receiptUrl = await this.fetchChargeReceiptUrl(invoice.id);
          } else {
            mapped.receiptUrl = null;
          }
          return mapped;
        }),
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
    const providerSubscriptionId = this.resolveInvoiceProviderSubscriptionId(invoice);
    const subscriptionLine = this.resolveInvoiceSubscriptionLine(invoice);
    const currency = invoice.currency.toUpperCase();
    const discount = this.resolveInvoiceDiscount(invoice, currency);

    return {
      providerInvoiceId: invoice.id,
      providerSubscriptionId,
      providerPaymentId: this.resolveInvoicePaymentId(invoice),
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency,
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
      discountAmount: discount.amount,
      discountLabel: discount.label,
    };
  }

  /*
   * Extracts coupon discount totals and a display label from a Stripe invoice.
   */
  private resolveInvoiceDiscount(
    invoice: Stripe.Invoice,
    currency: string,
  ): {
    amount: number;
    label: string | null;
    percentOff: number | null;
    amountOff: number | null;
  } {
    const totalDiscountAmounts = (
      invoice as Stripe.Invoice & {
        total_discount_amounts?: Array<{ amount?: number | null }> | null;
      }
    ).total_discount_amounts;

    const discountMinor = (totalDiscountAmounts ?? []).reduce(
      (sum, entry) => sum + (entry.amount ?? 0),
      0,
    );

    const discounts = (
      invoice as Stripe.Invoice & {
        discounts?: Array<
          | string
          | {
              coupon?: {
                name?: string | null;
                percent_off?: number | null;
                amount_off?: number | null;
              } | null;
              promotion_code?: string | { code?: string | null } | null;
            }
          | null
        > | null;
      }
    ).discounts;

    let label: string | null = null;
    let percentOff: number | null = null;
    let amountOff: number | null = null;
    for (const entry of discounts ?? []) {
      if (!entry || typeof entry === 'string') {
        continue;
      }

      const promotionCode =
        typeof entry.promotion_code === 'object'
          ? entry.promotion_code?.code
          : null;
      const couponName = entry.coupon?.name ?? null;
      label = promotionCode || couponName || label;
      if (typeof entry.coupon?.percent_off === 'number') {
        percentOff = entry.coupon.percent_off;
      }
      if (typeof entry.coupon?.amount_off === 'number') {
        amountOff = toMajorAmount(entry.coupon.amount_off, currency);
      }
      if (label && (percentOff != null || amountOff != null)) {
        break;
      }
    }

    return {
      amount: toMajorAmount(discountMinor, currency),
      label,
      percentOff,
      amountOff,
    };
  }

  /*
   * Applies a Stripe coupon to an upgrade payable amount (proration due today).
   */
  private applyCouponToPayableMajor(
    payableMajor: number,
    coupon: Stripe.Coupon,
    currency: string,
  ): { payableMajor: number; discountMajor: number } {
    if (payableMajor <= 0) {
      return { payableMajor: 0, discountMajor: 0 };
    }

    let discountMajor = 0;
    if (typeof coupon.percent_off === 'number' && coupon.percent_off > 0) {
      discountMajor = Number(
        ((payableMajor * coupon.percent_off) / 100).toFixed(2),
      );
    } else if (
      typeof coupon.amount_off === 'number' &&
      coupon.amount_off > 0
    ) {
      discountMajor = Math.min(
        toMajorAmount(coupon.amount_off, currency),
        payableMajor,
      );
    }

    return {
      discountMajor,
      payableMajor: Math.max(Number((payableMajor - discountMajor).toFixed(2)), 0),
    };
  }

  /*
   * Removes unattached upgrade coupon credit invoice items for a customer.
   */
  private async clearPendingUpgradeCouponCredits(
    providerCustomerId: string,
  ): Promise<void> {
    if (!providerCustomerId) {
      return;
    }

    const stripe = this.stripeService.getClient();
    try {
      const pendingItems = await stripe.invoiceItems.list({
        customer: providerCustomerId,
        pending: true,
        limit: 100,
      });
      for (const item of pendingItems.data) {
        if (item.metadata?.[UPGRADE_COUPON_CREDIT_METADATA_KEY] !== 'true') {
          continue;
        }
        try {
          await stripe.invoiceItems.del(item.id);
        } catch (error) {
          this.logger.warn(
            `Failed to clear pending upgrade coupon credit ${item.id}`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to list pending upgrade coupon credits for ${providerCustomerId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /*
   * Detects proration lines across Stripe invoice line shapes.
   */
  private isInvoiceLineProration(invoiceLine: Stripe.InvoiceLineItem): boolean {
    const line = invoiceLine as Stripe.InvoiceLineItem & {
      proration?: boolean | null;
    };

    return Boolean(
      line.proration ||
        line.parent?.invoice_item_details?.proration ||
        line.parent?.subscription_item_details?.proration,
    );
  }

  /*
   * Resolves the Stripe payment intent ID linked to an invoice.
   */
  private resolveInvoicePaymentId(invoice: Stripe.Invoice): string | null {
    const invoiceWithLegacy = invoice as Stripe.Invoice & {
      payment_intent?: string | Stripe.PaymentIntent | null;
    };

    const fromLegacy = resolveStripeResourceId(invoiceWithLegacy.payment_intent);
    if (fromLegacy) {
      return fromLegacy;
    }

    const payments = (
      invoice as Stripe.Invoice & {
        payments?: {
          data?: Array<{
            payment?: {
              payment_intent?: string | Stripe.PaymentIntent | null;
            } | null;
          }>;
        } | null;
      }
    ).payments?.data;

    for (const entry of payments ?? []) {
      const paymentIntentId = resolveStripeResourceId(
        entry.payment?.payment_intent,
      );
      if (paymentIntentId) {
        return paymentIntentId;
      }
    }

    const invoiceWithCharge = invoice as Stripe.Invoice & {
      latest_charge?: string | Stripe.Charge | null;
    };
    const charge = invoiceWithCharge.latest_charge;
    if (charge && typeof charge === 'object') {
      const fromCharge = resolveStripeResourceId(charge.payment_intent);
      if (fromCharge) {
        return fromCharge;
      }
    }

    return null;
  }

  /*
   * Retrieves an invoice from Stripe and resolves its payment intent ID.
   */
  async retrieveInvoicePaymentIntentId(
    providerInvoiceId: string,
  ): Promise<string | null> {
    try {
      const invoice = await this.stripeService.getClient().invoices.retrieve(
        providerInvoiceId,
        {
          expand: ['payments.data.payment.payment_intent'],
        },
      );
      return this.resolveInvoicePaymentId(invoice);
    } catch {
      return null;
    }
  }

  /*
   * Retrieves a fully expanded Stripe invoice for webhook and sync flows.
   */
  async retrieveInvoiceForSync(
    providerInvoiceId: string,
  ): Promise<ProviderInvoiceResult> {
    const invoice = await this.stripeService.getClient().invoices.retrieve(
      providerInvoiceId,
      {
        expand: [
          'lines.data.price',
          'payments.data.payment.payment_intent',
        ],
      },
    );
    const mapped = this.mapInvoice(invoice);
    const receiptUrl = await this.resolveInvoiceReceiptUrlAsync(invoice);
    if (receiptUrl) {
      mapped.receiptUrl = receiptUrl;
    }
    return mapped;
  }

  /*
   * Resolves the Stripe subscription ID from invoice-level and line-item fields.
   */
  private resolveInvoiceProviderSubscriptionId(
    invoice: Stripe.Invoice,
  ): string | null {
    const invoiceWithLegacy = invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null;
    };

    const fromParent = resolveStripeResourceId(
      invoice.parent?.subscription_details?.subscription,
    );
    if (fromParent) {
      return fromParent;
    }

    const fromLegacy = resolveStripeResourceId(invoiceWithLegacy.subscription);
    if (fromLegacy) {
      return fromLegacy;
    }

    for (const line of invoice.lines?.data ?? []) {
      const lineItem = line as Stripe.InvoiceLineItem & {
        parent?: {
          subscription_item_details?: {
            subscription?: string | Stripe.Subscription | null;
          } | null;
          invoice_item_details?: {
            subscription?: string | Stripe.Subscription | null;
          } | null;
        } | null;
      };

      const fromLine = resolveStripeResourceId(
        lineItem.parent?.subscription_item_details?.subscription ??
          lineItem.parent?.invoice_item_details?.subscription,
      );
      if (fromLine) {
        return fromLine;
      }
    }

    return null;
  }

  /*
   * Picks the primary subscription charge line.
   * Prefers non-proration lines; for upgrade invoices falls back to the
   * positive proration charge (new plan) rather than unused-time credits.
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
      isProration: boolean;
    };

    const candidates: Candidate[] = [];

    for (const line of invoice.lines?.data ?? []) {
      const lineItem = line as Stripe.InvoiceLineItem & {
        price?: Stripe.Price | string | null;
        proration?: boolean | null;
        pricing?: {
          type?: string;
          price_details?: {
            price?: Stripe.Price | string | null;
          } | null;
        } | null;
      };

      const isProration = this.isInvoiceLineProration(lineItem);
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

      if (
        !productName &&
        line.description?.trim() &&
        !this.isProrationPlanDescription(line.description)
      ) {
        productName =
          line.description.replace(/^\d+\s×\s/, '').split('(')[0]?.trim() ||
          line.description;
      }

      candidates.push({
        productName,
        price,
        priceId,
        amount: line.amount ?? 0,
        isProration,
      });
    }

    const recurringCandidates = candidates.filter(
      (candidate) => !candidate.isProration,
    );
    const pool =
      recurringCandidates.length > 0
        ? recurringCandidates
        : candidates.filter((candidate) => candidate.amount > 0);

    if (pool.length === 0) {
      // Last resort: any priced line (including credits) for catalog lookup.
      if (candidates.length === 0) {
        return null;
      }
      candidates.sort(
        (left, right) => Math.abs(right.amount) - Math.abs(left.amount),
      );
      return candidates[0];
    }

    pool.sort((left, right) => right.amount - left.amount);
    return pool[0];
  }

  /*
   * True when Stripe used a proration/unused-time description instead of a plan name.
   */
  private isProrationPlanDescription(description: string): boolean {
    const normalized = description.trim().toLowerCase();
    return (
      normalized.includes('unused time') ||
      normalized.includes('remaining time') ||
      normalized.includes('proration') ||
      normalized.startsWith('time on ')
    );
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

      const productName =
        product &&
        'name' in product &&
        typeof product.name === 'string' &&
        product.name.length > 0
          ? product.name
          : null;

      const formatted = this.formatStripePlanLabel(productName, price);
      if (formatted) {
        return formatted;
      }

      if (productName) {
        return productName;
      }

      if (
        line.description?.trim() &&
        !this.isProrationPlanDescription(line.description)
      ) {
        return (
          line.description.replace(/^\d+\s×\s/, '').split('(')[0]?.trim() ||
          line.description
        );
      }
    }

    if (
      invoice.description &&
      !this.isProrationPlanDescription(invoice.description)
    ) {
      return invoice.description;
    }

    return null;
  }

  /*
   * Converts a Stripe hosted receipt page URL into a direct PDF download URL.
   * Stripe only exposes receipt_url (HTML); appending /pdf?s=ap triggers the PDF.
   */
  private toReceiptPdfDownloadUrl(receiptUrl: string): string {
    try {
      const parsed = new URL(receiptUrl);
      if (!this.isStripeChargeReceiptUrl(receiptUrl)) {
        return receiptUrl;
      }

      const path = parsed.pathname.replace(/\/$/, '');
      parsed.pathname = path.endsWith('/pdf') ? path : `${path}/pdf`;
      parsed.search = 's=ap';
      return parsed.toString();
    } catch {
      return receiptUrl;
    }
  }

  /*
   * True only for Stripe charge receipt URLs (never invoice PDF / hosted invoice).
   */
  private isStripeChargeReceiptUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        /pay\.stripe\.com$/i.test(parsed.hostname) &&
        parsed.pathname.includes('/receipts/')
      );
    } catch {
      return false;
    }
  }

  /*
   * Collects charge refs already present on an invoice (expanded or ID-only).
   */
  private collectInvoiceChargeRefs(
    invoice: Stripe.Invoice,
  ): Array<string | Stripe.Charge> {
    const refs: Array<string | Stripe.Charge> = [];

    const payments = (
      invoice as Stripe.Invoice & {
        payments?: {
          data?: Array<{
            payment?: {
              charge?: string | Stripe.Charge | null;
              payment_intent?: string | Stripe.PaymentIntent | null;
            } | null;
          }>;
        } | null;
      }
    ).payments?.data;

    for (const entry of payments ?? []) {
      const charge = entry.payment?.charge;
      if (charge) {
        refs.push(charge);
      }

      const paymentIntent = entry.payment?.payment_intent;
      if (paymentIntent && typeof paymentIntent === 'object') {
        const latestCharge = paymentIntent.latest_charge;
        if (latestCharge) {
          refs.push(latestCharge);
        }
      }
    }

    const invoiceWithLegacy = invoice as Stripe.Invoice & {
      latest_charge?: string | Stripe.Charge | null;
      charge?: string | Stripe.Charge | null;
    };
    if (invoiceWithLegacy.latest_charge) {
      refs.push(invoiceWithLegacy.latest_charge);
    }
    if (invoiceWithLegacy.charge) {
      refs.push(invoiceWithLegacy.charge);
    }

    return refs;
  }

  /*
   * Resolves a receipt URL from already-expanded charge objects only.
   */
  private resolveExpandedChargeReceiptUrl(
    invoice: Stripe.Invoice,
  ): string | null {
    for (const chargeRef of this.collectInvoiceChargeRefs(invoice)) {
      if (
        chargeRef &&
        typeof chargeRef === 'object' &&
        chargeRef.receipt_url &&
        this.isStripeChargeReceiptUrl(chargeRef.receipt_url)
      ) {
        return this.toReceiptPdfDownloadUrl(chargeRef.receipt_url);
      }
    }
    return null;
  }

  /*
   * Resolves the Stripe charge receipt URL only (never invoice PDF / hosted URL).
   */
  private resolveInvoiceReceiptUrl(invoice: Stripe.Invoice): string | null {
    return this.resolveExpandedChargeReceiptUrl(invoice);
  }

  /*
   * Loads payment intent + charge for an invoice and returns the charge receipt
   * PDF URL. Returns null when no charge receipt exists (does not use invoice PDF).
   */
  private async fetchChargeReceiptUrl(
    providerInvoiceId: string,
  ): Promise<string | null> {
    try {
      const invoice = await this.stripeService.getClient().invoices.retrieve(
        providerInvoiceId,
        {
          expand: ['payments.data.payment.payment_intent'],
        },
      );
      return this.resolveInvoiceReceiptUrlAsync(invoice);
    } catch {
      return null;
    }
  }

  /*
   * Resolves a charge receipt URL for sync flows, fetching the charge when
   * only an ID is available on the invoice payment / payment intent.
   * Never falls back to invoice PDF or hosted invoice URL.
   */
  private async resolveInvoiceReceiptUrlAsync(
    invoice: Stripe.Invoice,
  ): Promise<string | null> {
    const fromExpanded = this.resolveExpandedChargeReceiptUrl(invoice);
    if (fromExpanded) {
      return fromExpanded;
    }

    for (const chargeRef of this.collectInvoiceChargeRefs(invoice)) {
      const chargeId =
        typeof chargeRef === 'string'
          ? chargeRef
          : typeof chargeRef === 'object'
            ? chargeRef.id
            : null;
      if (!chargeId) {
        continue;
      }

      try {
        const charge = await this.stripeService
          .getClient()
          .charges.retrieve(chargeId);
        if (
          charge.receipt_url &&
          this.isStripeChargeReceiptUrl(charge.receipt_url)
        ) {
          return this.toReceiptPdfDownloadUrl(charge.receipt_url);
        }
      } catch {
        // Keep trying other charge refs.
      }
    }

    return null;
  }

  /*
   * Maps a payment intent webhook payload, fetching invoice data when needed.
   */
  async mapPaymentIntentFromWebhook(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<ProviderPaymentResult> {
    const mapped = this.mapPaymentIntent(paymentIntent);
    if (mapped.providerSubscriptionId) {
      return mapped;
    }

    const invoiceRef = (
      paymentIntent as Stripe.PaymentIntent & {
        invoice?: string | Stripe.Invoice | null;
      }
    ).invoice;
    const invoiceId = resolveStripeResourceId(invoiceRef);
    if (!invoiceId) {
      return mapped;
    }

    const invoiceResult = await this.retrieveInvoiceForSync(invoiceId);
    return {
      ...mapped,
      providerSubscriptionId: invoiceResult.providerSubscriptionId,
    };
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
      providerSubscriptionId:
        this.resolvePaymentIntentSubscriptionId(paymentIntent),
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
   * Resolves a subscription ID from a payment intent or its expanded invoice.
   */
  private resolvePaymentIntentSubscriptionId(
    paymentIntent: Stripe.PaymentIntent,
  ): string | null {
    const paymentIntentWithInvoice = paymentIntent as Stripe.PaymentIntent & {
      invoice?: string | Stripe.Invoice | null;
    };

    if (
      paymentIntentWithInvoice.invoice &&
      typeof paymentIntentWithInvoice.invoice === 'object'
    ) {
      return this.resolveInvoiceProviderSubscriptionId(
        paymentIntentWithInvoice.invoice,
      );
    }

    for (const key of ['subscriptionId', 'providerSubscriptionId'] as const) {
      const value = paymentIntent.metadata?.[key];
      if (typeof value === 'string' && value.startsWith('sub_')) {
        return value;
      }
    }

    return null;
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
