/**
 * @fileoverview Lookup, validation, and successful-payment redemption for coupons.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Stripe from 'stripe';
import { Coupon } from './entities/coupon.entity';
import { CouponRedemption } from './entities/coupon-redemption.entity';
import { RecordStatus } from '../common/enums/payment.enums';
import { ERROR_MESSAGES } from '../common/messages/payment.messages';
import { now } from '../common/utils/date.util';
import { StripeService } from '../providers/stripe/stripe.service';
import { isPostgresUniqueViolation } from '../../../common/utils/error.util';

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
  ) {}

  /*
   * Validates a promotion code without consuming a Stripe redemption.
   */
  async validatePromotionCode(
    promotionCode: string,
  ): Promise<ValidatedCouponResponse> {
    const coupon = await this.findActiveByPromotionCode(promotionCode);
    const livePromotionCode = await this.tryResolveLivePromotionCode(coupon);
    this.assertCouponRedeemable(coupon, livePromotionCode);

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

    const livePromotionCode = await this.tryResolveLivePromotionCode(coupon);
    this.assertCouponRedeemable(coupon, livePromotionCode);

    if (!coupon.providerCouponId) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.INVALID);
    }

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

    const coupon = await this.couponRepository.findOne({
      where: { promotionCode, status: RecordStatus.ACTIVE },
    });
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

  /*
   * Finds an active, non-expired local coupon by promotion code.
   */
  private async findActiveByPromotionCode(
    promotionCode: string,
  ): Promise<Coupon> {
    const normalized = promotionCode.trim().toUpperCase();
    if (!normalized) {
      throw new NotFoundException(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
    }

    const coupon = await this.couponRepository.findOne({
      where: {
        promotionCode: normalized,
        status: RecordStatus.ACTIVE,
      },
    });

    if (!coupon) {
      throw new NotFoundException(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < now().valueOf()) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.EXPIRED);
    }

    return coupon;
  }

  /*
   * Loads Stripe promotion code stats when available (does not require active).
   */
  private async tryResolveLivePromotionCode(
    coupon: Coupon,
  ): Promise<Stripe.PromotionCode | null> {
    const stripe = this.stripeService.getClient();

    try {
      const listed = await stripe.promotionCodes.list({
        code: coupon.promotionCode,
        limit: 1,
      });
      const livePromotionCode = listed.data[0];
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

    if (coupon.providerPromotionCodeId) {
      try {
        return await stripe.promotionCodes.retrieve(
          coupon.providerPromotionCodeId,
        );
      } catch (error) {
        this.logger.warn(
          `Stored promotion code ${coupon.providerPromotionCodeId} is invalid for ${coupon.promotionCode}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return null;
  }

  /*
   * Enforces max redemptions using successful local redemptions and Stripe stats.
   */
  private assertCouponRedeemable(
    coupon: Coupon,
    promotionCode: Stripe.PromotionCode | null,
  ): void {
    const localRedeemed = coupon.timesRedeemed ?? 0;
    const stripeRedeemed = promotionCode?.times_redeemed ?? 0;
    const timesRedeemed = Math.max(localRedeemed, stripeRedeemed);

    const stripeMax = promotionCode?.max_redemptions ?? null;
    const localMax = coupon.maximumRedemptions ?? null;
    const maxRedemptions =
      stripeMax != null && localMax != null
        ? Math.min(stripeMax, localMax)
        : (stripeMax ?? localMax);

    if (maxRedemptions != null && timesRedeemed >= maxRedemptions) {
      throw new BadRequestException(
        ERROR_MESSAGES.COUPON.MAX_REDEMPTIONS_REACHED,
      );
    }

    if (
      promotionCode?.expires_at &&
      promotionCode.expires_at * 1000 < now().valueOf()
    ) {
      throw new BadRequestException(ERROR_MESSAGES.COUPON.EXPIRED);
    }
  }

  private toValidatedResponse(
    coupon: Coupon,
    promotionCode: Stripe.PromotionCode | null,
  ): ValidatedCouponResponse {
    const timesRedeemed = Math.max(
      coupon.timesRedeemed ?? 0,
      promotionCode?.times_redeemed ?? 0,
    );

    return {
      id: coupon.id,
      name: coupon.name,
      promotionCode: coupon.promotionCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      duration: coupon.duration,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      timesRedeemed,
      maximumRedemptions:
        promotionCode?.max_redemptions ?? coupon.maximumRedemptions,
    };
  }
}
