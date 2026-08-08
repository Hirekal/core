/**
 * @fileoverview Lookup, validation, creation, and successful-payment redemption for coupons.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';
import {
  CouponDiscountType,
  CouponDuration,
  RecordStatus,
} from '../common/enums/payment.enums';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { PAYMENT_CONSTANTS } from '../common/constants/payment.constants';
import { now, toDate } from '../common/utils/date.util';
import { toProviderMinorAmount } from '../common/utils/currency-amount.util';
import { isPostgresUniqueViolation } from '../../../common/utils/error.util';
import { BaseRepository } from '../common/repositories/base.repository';
import { StripeService } from '../providers/stripe/stripe.service';
import { StripeProvider } from '../providers/stripe/stripe.provider';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

export interface ValidatedCouponResponse {
  id: string;
  name: string;
  promotionCode: string;
  discountType: string;
  discountValue: number;
  duration: string;
  expiresAt: string | null;
  timesRedeemed: number;
  maximumRedemptions: number | null;
}

/*
 * Incomplete checkouts must use coupon IDs so Stripe promotion codes are not
 * marked redeemed before payment succeeds.
 */
export type StripeDiscountRef = { kind: 'coupon'; id: string };

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private readonly couponRedemptionRepository: Repository<CouponRedemption>,
    private readonly stripeService: StripeService,
    private readonly stripeProvider: StripeProvider,
    private readonly paymentProvidersService: PaymentProvidersService,
  ) {}

  /*
   * Creates a local coupon synchronized with Stripe coupon + promotion code.
   * Stripe objects are created first; local save failure cleans them up.
   */
  async create(dto: CreateCouponDto): Promise<ValidatedCouponResponse> {
    const promotionCode = dto.promotionCode.trim().toUpperCase();
    let providerCouponId: string | null = null;
    let providerPromotionCodeId: string | null = null;

    try {
      this.assertCreateDto(dto, promotionCode);

      const existing = await this.couponRepository
        .createQueryBuilder('coupon')
        .where('UPPER(TRIM(coupon.promotionCode)) = :code', {
          code: promotionCode,
        })
        .getOne();
      if (existing) {
        throw new ConflictException(ERROR_MESSAGES.COUPON.CODE_ALREADY_EXISTS);
      }

      await this.assertStripePromotionCodeAvailable(promotionCode);

      const provider = await this.paymentProvidersService.findByCode(
        PAYMENT_CONSTANTS.DEFAULT_PROVIDER_CODE,
      );

      const expiresAt = dto.expiresAt ? toDate(dto.expiresAt) : null;
      const redeemByUnix = expiresAt
        ? Math.floor(expiresAt.getTime() / 1000)
        : undefined;

      const stripeCoupon = await this.stripeProvider.createCoupon(
        this.buildStripeCouponParams(dto, redeemByUnix),
      );
      providerCouponId = stripeCoupon.id;

      const stripePromotionCode = await this.stripeProvider.createPromotionCode({
        promotion: {
          type: 'coupon',
          coupon: stripeCoupon.id,
        },
        code: promotionCode,
        expires_at: redeemByUnix,
        metadata: {
          localPromotionCode: promotionCode,
        },
      });
      providerPromotionCodeId = stripePromotionCode.id;

      const metadata: Record<string, unknown> = {
        ...(dto.metadata ?? {}),
      };
      if (dto.discountType === CouponDiscountType.FIXED && dto.currency) {
        metadata.currency = dto.currency.toUpperCase();
      }
      if (
        dto.duration === CouponDuration.REPEATING &&
        dto.durationInMonths != null
      ) {
        metadata.durationInMonths = dto.durationInMonths;
      }

      const coupon = await BaseRepository.createAndSave(this.couponRepository, {
        name: dto.name.trim(),
        paymentProviderId: provider.id,
        providerCouponId: stripeCoupon.id,
        providerPromotionCodeId: stripePromotionCode.id,
        promotionCode,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        duration: dto.duration,
        maximumRedemptions: dto.maximumRedemptions ?? null,
        timesRedeemed: 0,
        expiresAt,
        status: RecordStatus.ACTIVE,
        metadata,
      });

      return this.toValidatedResponse(coupon, stripePromotionCode);
    } catch (error) {
      await this.cleanupStripeCouponArtifacts(
        providerCouponId,
        providerPromotionCodeId,
      );

      if (isPostgresUniqueViolation(error)) {
        this.logger.error(LOG_MESSAGES.COUPON.CREATE_FAILED(promotionCode), error);
        throw new ConflictException(ERROR_MESSAGES.COUPON.CODE_ALREADY_EXISTS);
      }

      this.logger.error(LOG_MESSAGES.COUPON.CREATE_FAILED(promotionCode), error);
      throw error;
    }
  }

  /*
   * Validates a promotion code without consuming a Stripe redemption.
   */
  async validatePromotionCode(
    promotionCode: string,
  ): Promise<ValidatedCouponResponse> {
    const coupon = await this.findActiveByPromotionCode(promotionCode);
    await this.assertCouponRedeemable(coupon);
    const livePromotionCode = await this.tryResolveLivePromotionCode(coupon);

    return this.toValidatedResponse(coupon, livePromotionCode);
  }

  /*
   * Resolves a Stripe coupon discount for incomplete checkout / preview.
   * Uses coupon IDs only — promotion codes redeem immediately on apply.
   */
  async resolveStripeDiscountRef(
    promotionCodeOrCoupon?: string | Coupon | null,
  ): Promise<StripeDiscountRef | null> {
    if (!promotionCodeOrCoupon) {
      return null;
    }

    const coupon =
      typeof promotionCodeOrCoupon === 'string'
        ? await this.findActiveByPromotionCode(promotionCodeOrCoupon)
        : promotionCodeOrCoupon;

    await this.assertCouponRedeemable(coupon);

    if (!coupon.providerCouponId) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.INVALID);
    }

    // Ensure the Stripe coupon itself is still attachable. Limited Stripe
    // max_redemptions would be consumed by incomplete checkouts.
    await this.assertStripeCouponAttachable(coupon.providerCouponId);

    return { kind: 'coupon', id: coupon.providerCouponId };
  }

  /*
   * Records a redemption only after a successful paid invoice.
   */
  async recordSuccessfulRedemption(input: {
    promotionCode?: string | null;
    organizationId: string;
    providerInvoiceId: string;
    providerSubscriptionId?: string | null;
  }): Promise<void> {
    const promotionCode = input.promotionCode?.trim().toUpperCase();
    if (!promotionCode || !input.providerInvoiceId) {
      return;
    }

    const existing = await this.couponRedemptionRepository.findOne({
      where: { providerInvoiceId: input.providerInvoiceId },
    });
    if (existing) {
      return;
    }

    const coupon = await this.couponRepository
      .createQueryBuilder('coupon')
      .where('UPPER(TRIM(coupon.promotionCode)) = :code', { code: promotionCode })
      .andWhere('coupon.status = :status', { status: RecordStatus.ACTIVE })
      .getOne();
    if (!coupon) {
      this.logger.warn(
        `Skipping redemption record; coupon ${promotionCode} not found locally`,
      );
      return;
    }

    try {
      await this.couponRedemptionRepository.save(
        this.couponRedemptionRepository.create({
          couponId: coupon.id,
          organizationId: input.organizationId,
          promotionCode,
          providerInvoiceId: input.providerInvoiceId,
          providerSubscriptionId: input.providerSubscriptionId ?? null,
          status: RecordStatus.ACTIVE,
          metadata: {},
        }),
      );

      await this.couponRepository.increment({ id: coupon.id }, 'timesRedeemed', 1);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }

  private assertCreateDto(dto: CreateCouponDto, promotionCode: string): void {
    if (!promotionCode) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.INVALID);
    }

    if (
      dto.discountType === CouponDiscountType.PERCENTAGE &&
      dto.discountValue > 100
    ) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.INVALID);
    }

    if (dto.discountType === CouponDiscountType.FIXED && !dto.currency?.trim()) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.CURRENCY_REQUIRED);
    }

    if (
      dto.duration === CouponDuration.REPEATING &&
      (dto.durationInMonths == null || dto.durationInMonths < 1)
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.COUPON.DURATION_IN_MONTHS_REQUIRED,
      );
    }

    if (dto.expiresAt) {
      const expiresAt = toDate(dto.expiresAt);
      if (expiresAt.getTime() <= now().valueOf()) {
        throw new BadRequestException(ERROR_MESSAGES.COUPON.EXPIRES_AT_INVALID);
      }
    }
  }

  private buildStripeCouponParams(
    dto: CreateCouponDto,
    redeemByUnix?: number,
  ): Stripe.CouponCreateParams {
    const duration = dto.duration.toLowerCase() as Stripe.CouponCreateParams.Duration;
    const params: Stripe.CouponCreateParams = {
      name: dto.name.trim(),
      duration,
      redeem_by: redeemByUnix,
      metadata: {
        localPromotionCode: dto.promotionCode.trim().toUpperCase(),
      },
    };

    if (dto.duration === CouponDuration.REPEATING) {
      params.duration_in_months = dto.durationInMonths;
    }

    if (dto.discountType === CouponDiscountType.PERCENTAGE) {
      params.percent_off = dto.discountValue;
    } else {
      const currency = dto.currency!.trim().toUpperCase();
      params.currency = currency.toLowerCase();
      params.amount_off = toProviderMinorAmount(dto.discountValue, currency);
    }

    return params;
  }

  private async assertStripePromotionCodeAvailable(
    promotionCode: string,
  ): Promise<void> {
    try {
      const listed = await this.stripeService.getClient().promotionCodes.list({
        code: promotionCode,
        limit: 10,
      });
      const active = listed.data.find((entry) => entry.active);
      if (active) {
        throw new ConflictException(ERROR_MESSAGES.COUPON.CODE_ALREADY_EXISTS);
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.warn(
        `Stripe promotion code availability check failed for ${promotionCode}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async cleanupStripeCouponArtifacts(
    providerCouponId: string | null,
    providerPromotionCodeId: string | null,
  ): Promise<void> {
    if (providerPromotionCodeId) {
      await this.stripeProvider.deactivatePromotionCode(providerPromotionCodeId);
    }
    if (providerCouponId) {
      await this.stripeProvider.deleteCoupon(providerCouponId);
    }
  }

  /*
   * Finds an active, non-expired local coupon by promotion code.
   * Matching is case-insensitive (OFF10 / off10 / Off10 all work).
   */
  private async findActiveByPromotionCode(
    promotionCode: string,
  ): Promise<Coupon> {
    const normalized = promotionCode.trim().toUpperCase();
    if (!normalized) {
      throw new NotFoundException(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
    }

    const coupon = await this.couponRepository
      .createQueryBuilder('coupon')
      .where('UPPER(TRIM(coupon.promotionCode)) = :code', { code: normalized })
      .andWhere('coupon.status = :status', { status: RecordStatus.ACTIVE })
      .getOne();

    if (!coupon) {
      throw new NotFoundException(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < now().valueOf()) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.EXPIRED);
    }

    return coupon;
  }

  /*
   * Loads the best matching live Stripe promotion code for display/metadata.
   */
  private async tryResolveLivePromotionCode(
    coupon: Coupon,
  ): Promise<Stripe.PromotionCode | null> {
    const stripe = this.stripeService.getClient();

    if (coupon.providerPromotionCodeId) {
      try {
        const stored = await stripe.promotionCodes.retrieve(
          coupon.providerPromotionCodeId,
        );
        if (stored?.id) {
          return stored;
        }
      } catch (error) {
        this.logger.warn(
          `Stored promotion code ${coupon.providerPromotionCodeId} is invalid for ${coupon.promotionCode}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    try {
      const listed = await stripe.promotionCodes.list({
        code: coupon.promotionCode,
        limit: 10,
      });
      const livePromotionCode =
        listed.data.find((entry) => entry.active) ?? listed.data[0] ?? null;
      if (livePromotionCode?.id) {
        if (livePromotionCode.id !== coupon.providerPromotionCodeId) {
          await this.couponRepository.update(coupon.id, {
            providerPromotionCodeId: livePromotionCode.id,
          });
          coupon.providerPromotionCodeId = livePromotionCode.id;
        }
        return livePromotionCode;
      }
    } catch (error) {
      this.logger.warn(
        `Stripe promotion code list failed for ${coupon.promotionCode}`,
        error instanceof Error ? error.message : error,
      );
    }

    return null;
  }

  /*
   * Enforces max redemptions from successful local redemptions only.
   * Stripe incomplete-checkout attaches must not consume limited promo counters.
   */
  private async assertCouponRedeemable(coupon: Coupon): Promise<void> {
    const successfulRedemptions = await this.couponRedemptionRepository.count({
      where: {
        couponId: coupon.id,
        status: RecordStatus.ACTIVE,
      },
    });
    const timesRedeemed = Math.max(
      coupon.timesRedeemed ?? 0,
      successfulRedemptions,
    );
    const maxRedemptions = coupon.maximumRedemptions ?? null;

    if (maxRedemptions != null && timesRedeemed >= maxRedemptions) {
      throw new BadRequestException(
        ERROR_MESSAGES.COUPON.MAX_REDEMPTIONS_REACHED,
      );
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < now().valueOf()) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.EXPIRED);
    }
  }

  /*
   * Confirms the Stripe coupon object can still be attached to a checkout.
   */
  private async assertStripeCouponAttachable(
    providerCouponId: string,
  ): Promise<void> {
    try {
      const stripeCoupon = await this.stripeService
        .getClient()
        .coupons.retrieve(providerCouponId);

      if (!stripeCoupon.valid) {
        throw new BadRequestException(
          ERROR_MESSAGES.COUPON.MAX_REDEMPTIONS_REACHED,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(
        `Failed to retrieve Stripe coupon ${providerCouponId}`,
        error instanceof Error ? error.message : error,
      );
      throw new NotFoundException(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
    }
  }

  private toValidatedResponse(
    coupon: Coupon,
    promotionCode: Stripe.PromotionCode | null,
  ): ValidatedCouponResponse {
    return {
      id: coupon.id,
      name: coupon.name,
      promotionCode: coupon.promotionCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      duration: coupon.duration,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      timesRedeemed: coupon.timesRedeemed ?? 0,
      maximumRedemptions:
        coupon.maximumRedemptions ?? promotionCode?.max_redemptions ?? null,
    };
  }
}
