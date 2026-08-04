/**
 * @fileoverview Subscription persistence and provider synchronization service.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Price } from '../prices/entities/price.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { PaymentCustomersService } from '../payment-customers/payment-customers.service';
import { PricesService } from '../prices/prices.service';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
  SUCCESS_MESSAGES,
} from '../common/messages/payment.messages';
import {
  RecordStatus,
  SubscriptionPlanChangeAction,
  SubscriptionStatus,
} from '../common/enums/payment.enums';
import {
  ProviderPlanChangePreviewResult,
  ProviderSubscriptionResult,
} from '../providers/payment-provider.interface';
import {
  comparePlans,
  isImmediatePlanChange,
  PlanChangeDirection,
} from '../common/utils/plan-comparison.util';
import {
  CHANGEABLE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_METADATA_KEYS,
} from '../common/constants/subscription.constants';
import { rethrowStripeError } from '../common/utils/stripe-error.util';
import { toIsoString } from '../common/utils/date.util';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly pricesService: PricesService,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

  /*
   * Creates a provider subscription for a customer and persists local state.
   */
  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    try {
      const customer = await this.paymentCustomersService.findOne(
        dto.customerId,
      );
      const price = await this.pricesService.findOne(dto.priceId);
      const provider = await this.paymentProvidersService.findById(
        customer.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      await paymentProvider.validateCustomerPaymentMethod(
        customer.providerCustomerId,
      );

      const providerSubscription = await paymentProvider.createSubscription({
        providerCustomerId: customer.providerCustomerId,
        providerPriceId: price.providerPriceId,
        metadata: dto.metadata,
      });

      return this.saveFromProviderResult({
        userId: customer.userId,
        customerId: customer.id,
        priceId: price.id,
        paymentProviderId: provider.id,
        providerResult: providerSubscription,
        metadata: dto.metadata,
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CREATE_FAILED(dto.customerId),
        error,
      );
      rethrowStripeError(error);
    }
  }

  /*
   * Cancels a subscription and syncs provider state to the database.
   */
  async cancel(id: string, cancelAtPeriodEnd = true): Promise<Subscription> {
    try {
      const subscription = await this.findOne(id);
      this.assertSubscriptionChangeable(subscription);
      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerSubscription = await paymentProvider.cancelSubscription(
        subscription.providerSubscriptionId,
        cancelAtPeriodEnd,
      );

      return this.syncFromProviderResult(
        subscription,
        providerSubscription,
        this.clearScheduledChangeMetadata(subscription.metadata),
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.CANCEL_FAILED(id), error);
      rethrowStripeError(error);
    }
  }

  /*
   * Resumes a subscription scheduled to cancel at period end.
   */
  async resume(id: string): Promise<Subscription> {
    try {
      const subscription = await this.findOne(id);
      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      try {
        const providerSubscription = await paymentProvider.resumeSubscription(
          subscription.providerSubscriptionId,
        );
        return this.syncFromProviderResult(
          subscription,
          providerSubscription,
          this.clearScheduledChangeMetadata(subscription.metadata),
        );
      } catch {
        throw new BadRequestException(
          ERROR_MESSAGES.SUBSCRIPTION.RESUME_NOT_SUPPORTED,
        );
      }
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.RESUME_FAILED(id), error);
      rethrowStripeError(error);
    }
  }

  /*
   * Upgrades a subscription to a higher plan with immediate proration.
   */
  async upgrade(id: string, newPriceId: string): Promise<Subscription> {
    try {
      const planChangeResult = await this.changePlan(
        id,
        newPriceId,
        SubscriptionPlanChangeAction.UPGRADE,
      );
      return planChangeResult.subscription;
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CHANGE_PLAN_FAILED(id),
        error,
      );
      rethrowStripeError(error);
    }
  }

  /*
   * Schedules a downgrade to take effect at the next billing period.
   */
  async downgrade(id: string, newPriceId: string): Promise<Subscription> {
    try {
      const planChangeResult = await this.changePlan(
        id,
        newPriceId,
        SubscriptionPlanChangeAction.DOWNGRADE,
      );
      return planChangeResult.subscription;
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CHANGE_PLAN_FAILED(id),
        error,
      );
      rethrowStripeError(error);
    }
  }

  /*
   * Previews invoice impact before an immediate subscription plan change.
   */
  async previewPlanChange(
    id: string,
    newPriceId: string,
  ): Promise<{
    currentPlan: Price;
    newPlan: Price;
    preview: ProviderPlanChangePreviewResult;
    direction: PlanChangeDirection;
  }> {
    try {
      const subscription = await this.findOne(id);
      this.assertSubscriptionChangeable(subscription);

      const currentPrice = await this.ensureCurrentPrice(subscription);
      const newPrice = await this.pricesService.findOne(newPriceId);
      const direction = comparePlans(currentPrice, newPrice);
      if (direction === PlanChangeDirection.SAME) {
        throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.SAME_PLAN);
      }

      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      const planChangePreviewResult =
        await paymentProvider.previewSubscriptionPlanChange({
          providerCustomerId: subscription.customer.providerCustomerId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          providerPriceId: newPrice.providerPriceId,
        });

      return {
        currentPlan: currentPrice,
        newPlan: newPrice,
        preview: planChangePreviewResult,
        direction,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CHANGE_PLAN_FAILED(id),
        error,
      );
      rethrowStripeError(error);
    }
  }

  /*
   * Cancels a pending scheduled downgrade on the subscription.
   */
  async cancelScheduledChange(id: string): Promise<Subscription> {
    try {
      const subscription = await this.findOne(id);
      if (!this.hasScheduledChange(subscription.metadata)) {
        throw new BadRequestException(
          ERROR_MESSAGES.SUBSCRIPTION.NO_SCHEDULED_CHANGE,
        );
      }

      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerSubscription =
        await paymentProvider.cancelScheduledPlanChange(
          subscription.providerSubscriptionId,
        );

      return this.syncFromProviderResult(
        subscription,
        providerSubscription,
        this.clearScheduledChangeMetadata(subscription.metadata),
      );
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CHANGE_PLAN_FAILED(id),
        error,
      );
      rethrowStripeError(error);
    }
  }

  /*
   * Validates plan direction, calls the provider, and syncs local state.
   * Upgrades update priceId immediately; downgrades keep the current priceId
   * until the provider switches the plan at the next billing period.
   */
  private async changePlan(
    id: string,
    newPriceId: string,
    direction: SubscriptionPlanChangeAction,
  ): Promise<{ subscription: Subscription; message: string }> {
    try {
      const subscription = await this.findOne(id);
      this.assertSubscriptionChangeable(subscription);

      const currentPrice = await this.ensureCurrentPrice(subscription);
      const newPrice = await this.pricesService.findOne(newPriceId);
      const comparison = this.validatePlanChange(
        currentPrice,
        newPrice,
        direction,
        false,
      );

      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      if (isImmediatePlanChange(comparison)) {
        await paymentProvider.validateCustomerPaymentMethod(
          subscription.customer.providerCustomerId,
        );
      }

      const providerResult = await paymentProvider.changeSubscriptionPlan({
        providerSubscriptionId: subscription.providerSubscriptionId,
        providerCustomerId: subscription.customer.providerCustomerId,
        providerPriceId: newPrice.providerPriceId,
        isUpgrade: isImmediatePlanChange(comparison),
      });

      const metadata = isImmediatePlanChange(comparison)
        ? this.clearScheduledChangeMetadata(subscription.metadata)
        : this.buildScheduledChangeMetadata(
            subscription.metadata,
            newPrice,
            providerResult,
          );

      const updatedSubscription = await this.syncFromProviderResult(
        subscription,
        providerResult,
        metadata,
        isImmediatePlanChange(comparison) ? newPrice.id : undefined,
      );

      const syncedSubscription = isImmediatePlanChange(comparison)
        ? await this.refreshFromProvider(updatedSubscription)
        : updatedSubscription;

      return {
        subscription: syncedSubscription,
        message: isImmediatePlanChange(comparison)
          ? SUCCESS_MESSAGES.SUBSCRIPTION.UPGRADED
          : SUCCESS_MESSAGES.SUBSCRIPTION.DOWNGRADED,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.CHANGE_PLAN_FAILED(id),
        error,
      );
      throw error;
    }
  }

  /*
   * Validates provider, currency, interval, and upgrade/downgrade direction.
   */
  private validatePlanChange(
    currentPrice: Price,
    newPrice: Price,
    direction: SubscriptionPlanChangeAction,
    previewMode: boolean,
  ): PlanChangeDirection {
    if (currentPrice.paymentProviderId !== newPrice.paymentProviderId) {
      throw new BadRequestException(
        ERROR_MESSAGES.SUBSCRIPTION.PLAN_PROVIDER_MISMATCH,
      );
    }

    if (
      currentPrice.currency.toUpperCase() !== newPrice.currency.toUpperCase()
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.SUBSCRIPTION.CURRENCY_MISMATCH,
      );
    }

    if (!currentPrice.interval || !newPrice.interval) {
      throw new BadRequestException(
        ERROR_MESSAGES.SUBSCRIPTION.INTERVAL_NOT_SUPPORTED,
      );
    }

    const comparison = comparePlans(currentPrice, newPrice);
    if (comparison === PlanChangeDirection.SAME) {
      throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.SAME_PLAN);
    }

    if (
      !previewMode &&
      direction === SubscriptionPlanChangeAction.UPGRADE &&
      comparison === PlanChangeDirection.DOWNGRADE
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.SUBSCRIPTION.INVALID_UPGRADE,
      );
    }

    if (
      !previewMode &&
      direction === SubscriptionPlanChangeAction.DOWNGRADE &&
      comparison === PlanChangeDirection.UPGRADE
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.SUBSCRIPTION.INVALID_DOWNGRADE,
      );
    }

    return comparison;
  }

  /*
   * Ensures the subscription status allows plan changes.
   */
  private assertSubscriptionChangeable(subscription: Subscription): void {
    if (
      !CHANGEABLE_SUBSCRIPTION_STATUSES.includes(
        subscription.subscriptionStatus as (typeof CHANGEABLE_SUBSCRIPTION_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(ERROR_MESSAGES.SUBSCRIPTION.NOT_CHANGEABLE);
    }
  }

  /*
   * Resolves the subscription's current price from the relation or database.
   */
  private async ensureCurrentPrice(subscription: Subscription): Promise<Price> {
    try {
      if (subscription.price?.amount !== undefined) {
        return subscription.price;
      }
      const currentPrice = await this.pricesService.findOne(
        subscription.priceId,
      );
      subscription.price = currentPrice;
      return currentPrice;
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(subscription.id),
        error,
      );
      throw error;
    }
  }

  /*
   * Builds metadata describing a pending scheduled plan change.
   */
  buildScheduledChangeMetadata(
    metadata: Record<string, unknown> | null | undefined,
    newPrice: Price,
    providerResult: ProviderSubscriptionResult,
  ): Record<string, unknown> {
    const scheduledChange = providerResult.scheduledChange;
    return {
      ...(metadata ?? {}),
      [SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PRICE_ID]: newPrice.id,
      [SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PROVIDER_PRICE_ID]:
        newPrice.providerPriceId,
      [SUBSCRIPTION_METADATA_KEYS.PROVIDER_SCHEDULE_ID]:
        scheduledChange?.providerScheduleId ?? null,
      [SUBSCRIPTION_METADATA_KEYS.SCHEDULED_PLAN_CHANGE_AT]:
        scheduledChange?.effectiveAt
          ? toIsoString(scheduledChange.effectiveAt)
          : null,
    };
  }

  /*
   * Removes pending scheduled plan change keys from subscription metadata.
   */
  clearScheduledChangeMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const next = { ...(metadata ?? {}) };
    delete next[SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PRICE_ID];
    delete next[SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PROVIDER_PRICE_ID];
    delete next[SUBSCRIPTION_METADATA_KEYS.PROVIDER_SCHEDULE_ID];
    delete next[SUBSCRIPTION_METADATA_KEYS.SCHEDULED_PLAN_CHANGE_AT];
    return next;
  }

  /*
   * Returns true when a downgrade or lateral change is scheduled in metadata.
   */
  hasScheduledChange(
    metadata: Record<string, unknown> | null | undefined,
  ): boolean {
    return Boolean(
      metadata?.[SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PRICE_ID],
    );
  }

  /*
   * Determines whether webhook sync should update local priceId.
   * Pending downgrade metadata keeps the current plan until Stripe
   * activates the scheduled lower price at the next billing cycle.
   */
  resolveWebhookPriceUpdate(
    subscription: Subscription,
    activeProviderPriceId: string,
    mappedPrice: Price | null,
  ): { priceId?: string; metadata?: Record<string, unknown> } {
    const pendingProviderPriceId =
      subscription.metadata?.[
        SUBSCRIPTION_METADATA_KEYS.PENDING_DOWNGRADE_PROVIDER_PRICE_ID
      ];

    if (
      typeof pendingProviderPriceId === 'string' &&
      pendingProviderPriceId.length > 0
    ) {
      if (activeProviderPriceId === pendingProviderPriceId && mappedPrice) {
        return {
          priceId: mappedPrice.id,
          metadata: this.clearScheduledChangeMetadata(subscription.metadata),
        };
      }

      // Keep the current plan and scheduled metadata until Stripe switches price.
      return {};
    }

    if (mappedPrice && mappedPrice.id !== subscription.priceId) {
      return { priceId: mappedPrice.id };
    }

    return {};
  }

  /*
   * Returns the user's latest subscription regardless of status.
   */
  async findLatestByUserId(userId: string): Promise<Subscription | null> {
    try {
      const activeSubscription = await this.findActiveByUserId(userId);
      if (activeSubscription) {
        return activeSubscription;
      }

      const subscription = await this.subscriptionsRepository.findOne({
        where: { userId },
        relations: {
          customer: true,
          price: { product: true },
          paymentProvider: true,
        },
        order: { createdAt: 'DESC' },
      });

      return subscription ?? null;
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(userId), error);
      throw error;
    }
  }

  /*
   * Returns the user's latest active subscription when one exists.
   */
  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    try {
      return this.subscriptionsRepository.findOne({
        where: {
          userId,
          status: RecordStatus.ACTIVE,
          subscriptionStatus: In([
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ]),
        },
        relations: {
          customer: true,
          price: { product: true },
          paymentProvider: true,
        },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(userId), error);
      throw error;
    }
  }

  /*
   * Returns a subscription by internal ID with customer and price relations.
   */
  async findOne(id: string): Promise<Subscription> {
    try {
      return BaseRepository.findOneOrFail(
        this.subscriptionsRepository,
        { id },
        ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND,
        { customer: true, price: { product: true }, paymentProvider: true },
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Returns a subscription when it belongs to the given user.
   */
  async findOneForUser(id: string, userId: string): Promise<Subscription> {
    try {
      const subscription = await this.findOne(id);
      if (subscription.userId !== userId) {
        throw new ForbiddenException(ERROR_MESSAGES.SUBSCRIPTION.NOT_FOUND);
      }
      return this.refreshFromProvider(subscription);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Pulls the latest subscription state from the payment provider into the database.
   */
  async refreshFromProvider(subscription: Subscription): Promise<Subscription> {
    try {
      const provider = await this.paymentProvidersService.findById(
        subscription.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerResult = await paymentProvider.retrieveSubscription(
        subscription.providerSubscriptionId,
      );
      const price = await this.pricesService.findByProviderPriceId(
        providerResult.providerPriceId,
        provider.code,
      );
      const priceUpdate = this.resolveWebhookPriceUpdate(
        subscription,
        providerResult.providerPriceId,
        price,
      );
      const hasScheduledChange = this.hasScheduledChange(subscription.metadata);
      const resolvedPriceId =
        priceUpdate.priceId ?? (hasScheduledChange ? undefined : price?.id);
      const metadata =
        priceUpdate.metadata ??
        (hasScheduledChange
          ? subscription.metadata
          : this.clearScheduledChangeMetadata(subscription.metadata));

      return this.syncFromProviderResult(
        subscription,
        providerResult,
        metadata,
        resolvedPriceId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to refresh subscription ${subscription.id} from provider`,
        error,
      );
      return this.findOne(subscription.id);
    }
  }

  /*
   * Persists a Stripe subscription from checkout or webhook context.
   */
  async syncFromStripeCheckout(input: {
    userId: string;
    providerCode: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
    priceId?: string;
    email?: string;
    name?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Subscription | null> {
    if (!input.providerSubscriptionId) {
      return null;
    }

    try {
      const existingSubscription = await this.findByProviderSubscriptionId(
        input.providerSubscriptionId,
        input.providerCode,
      );

      let customer =
        await this.paymentCustomersService.findByProviderCustomerId(
          input.providerCustomerId,
          input.providerCode,
        );

      if (!customer) {
        if (!input.providerCustomerId) {
          this.logger.warn(
            `Skipping subscription sync ${input.providerSubscriptionId}: missing Stripe customer`,
          );
          return null;
        }

        customer = await this.paymentCustomersService.upsertFromProvider({
          userId: input.userId,
          providerCode: input.providerCode,
          providerCustomerId: input.providerCustomerId,
          email: input.email ?? '',
          name: input.name ?? null,
          metadata: input.metadata,
        });
      }

      const paymentProvider = this.paymentProviderRegistry.resolve(
        input.providerCode,
      );
      const providerSubscription = await paymentProvider.retrieveSubscription(
        input.providerSubscriptionId,
      );

      let localPriceId = input.priceId;
      if (localPriceId) {
        try {
          const localPrice = await this.pricesService.findOne(localPriceId);
          localPriceId = localPrice.id;
        } catch {
          localPriceId = undefined;
        }
      }

      if (!localPriceId) {
        const localPrice = await this.pricesService.findByProviderPriceId(
          providerSubscription.providerPriceId,
          input.providerCode,
        );
        localPriceId = localPrice?.id;
      }

      if (!localPriceId) {
        this.logger.warn(
          `Skipping subscription sync ${input.providerSubscriptionId}: local price not found for ${providerSubscription.providerPriceId}`,
        );
        return null;
      }

      if (existingSubscription) {
        return this.syncFromProviderResult(
          existingSubscription,
          providerSubscription,
          input.metadata,
          localPriceId,
        );
      }

      return this.saveFromProviderResult({
        userId: input.userId,
        customerId: customer.id,
        priceId: localPriceId,
        paymentProviderId: customer.paymentProviderId,
        providerResult: providerSubscription,
        metadata: input.metadata,
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.SYNC_FAILED(input.providerSubscriptionId),
        error,
      );
      throw error;
    }
  }

  /*
   * Finds a subscription by the provider-side subscription ID.
   */
  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
    providerCode: string,
  ): Promise<Subscription | null> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      return this.subscriptionsRepository.findOne({
        where: { providerSubscriptionId, paymentProviderId: provider.id },
        relations: { customer: true, price: true, paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.FIND_FAILED(providerSubscriptionId),
        error,
      );
      throw error;
    }
  }

  /*
   * Upserts local state from a provider API or webhook result.
   */
  async syncFromProviderResult(
    subscription: Subscription,
    providerResult: ProviderSubscriptionResult,
    metadata?: Record<string, unknown> | null,
    priceId?: string,
  ): Promise<Subscription> {
    try {
      let resolvedPriceId = priceId;
      if (!resolvedPriceId && providerResult.providerPriceId) {
        const provider = await this.paymentProvidersService.findById(
          subscription.paymentProviderId,
        );
        const mappedPrice = await this.pricesService.findByProviderPriceId(
          providerResult.providerPriceId,
          provider.code,
        );
        resolvedPriceId = mappedPrice?.id;
      }

      const nextMetadata = {
        ...(metadata ?? subscription.metadata ?? {}),
        ...(resolvedPriceId ? { priceId: resolvedPriceId } : {}),
      };

      Object.assign(subscription, {
        subscriptionStatus: providerResult.subscriptionStatus,
        currentPeriodStart: providerResult.currentPeriodStart,
        currentPeriodEnd: providerResult.currentPeriodEnd,
        cancelAtPeriodEnd: providerResult.cancelAtPeriodEnd,
        canceledAt: providerResult.canceledAt,
        trialStart: providerResult.trialStart,
        trialEnd: providerResult.trialEnd,
        metadata: nextMetadata,
        status: this.resolveRecordStatus(providerResult.subscriptionStatus),
        ...(resolvedPriceId ? { priceId: resolvedPriceId } : {}),
      });

      // Loaded price relations win over priceId on save unless cleared first.
      if (resolvedPriceId) {
        Reflect.deleteProperty(subscription, 'price');
      }

      await this.subscriptionsRepository.save(subscription);
      return this.findOne(subscription.id);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.SYNC_FAILED(
          providerResult.providerSubscriptionId,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Creates a new local record from a provider subscription result.
   */
  async saveFromProviderResult(input: {
    userId: string;
    customerId: string;
    priceId: string;
    paymentProviderId: string;
    providerResult: ProviderSubscriptionResult;
    metadata?: Record<string, unknown>;
  }): Promise<Subscription> {
    try {
      const existingSubscription = await this.subscriptionsRepository.findOne({
        where: {
          paymentProviderId: input.paymentProviderId,
          providerSubscriptionId: input.providerResult.providerSubscriptionId,
        },
      });

      if (existingSubscription) {
        return this.syncFromProviderResult(
          existingSubscription,
          input.providerResult,
          input.metadata,
          input.priceId,
        );
      }

      const createdSubscription = await BaseRepository.createAndSave(
        this.subscriptionsRepository,
        {
          userId: input.userId,
          customerId: input.customerId,
          priceId: input.priceId,
          paymentProviderId: input.paymentProviderId,
          providerSubscriptionId: input.providerResult.providerSubscriptionId,
          subscriptionStatus: input.providerResult.subscriptionStatus,
          currentPeriodStart: input.providerResult.currentPeriodStart,
          currentPeriodEnd: input.providerResult.currentPeriodEnd,
          cancelAtPeriodEnd: input.providerResult.cancelAtPeriodEnd,
          canceledAt: input.providerResult.canceledAt,
          trialStart: input.providerResult.trialStart,
          trialEnd: input.providerResult.trialEnd,
          status: this.resolveRecordStatus(
            input.providerResult.subscriptionStatus,
          ),
          metadata: input.metadata ?? {},
        },
      );

      return this.findOne(createdSubscription.id);
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SUBSCRIPTION.SYNC_FAILED(
          input.providerResult.providerSubscriptionId,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Maps subscription status from the provider into local record status.
   */
  private resolveRecordStatus(
    subscriptionStatus: SubscriptionStatus,
  ): RecordStatus {
    if (
      subscriptionStatus === SubscriptionStatus.CANCELED ||
      subscriptionStatus === SubscriptionStatus.INCOMPLETE
    ) {
      return RecordStatus.INACTIVE;
    }

    return RecordStatus.ACTIVE;
  }

  /*
   * Returns a user-facing success message for subscription lifecycle actions.
   */
  getSuccessMessage(
    action: 'cancel' | 'resume' | 'cancelScheduledChange',
  ): string {
    if (action === 'cancel') {
      return SUCCESS_MESSAGES.SUBSCRIPTION.CANCELED;
    }
    if (action === 'cancelScheduledChange') {
      return SUCCESS_MESSAGES.SUBSCRIPTION.SCHEDULED_CHANGE_CANCELED;
    }
    return SUCCESS_MESSAGES.SUBSCRIPTION.RESUMED;
  }
}
