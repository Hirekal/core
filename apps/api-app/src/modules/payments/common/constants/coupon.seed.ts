/**
 * @fileoverview Default coupon catalog for database seeding.
 * Edit Stripe IDs and terms here, then run migrations.
 *
 * Stripe coupon max_redemptions must stay unlimited — incomplete checkouts
 * attach the coupon ID and would otherwise burn limited Stripe redemptions
 * before payment succeeds. Enforce caps via local maximumRedemptions after
 * successful paid invoices only.
 */
import {
  CouponDiscountType,
  CouponDuration,
} from '../enums/payment.enums';

export interface CouponSeed {
  name: string;
  promotionCode: string;
  providerCouponId: string;
  providerPromotionCodeId: string;
  discountType: CouponDiscountType;
  discountValue: number;
  duration: CouponDuration;
  maximumRedemptions: number;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export const COUPON_SEED: CouponSeed[] = [
  {
    name: 'OFF10',
    promotionCode: 'OFF10',
    providerCouponId: 'za3Ym14n',
    providerPromotionCodeId: 'promo_1U1kOxJCYGyYR7NPPGN2XYLe',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 10,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 100,
    expiresAt: '2027-12-31T23:59:00.000Z',
    metadata: { seed: true },
  },
  {
    name: 'OFF20',
    promotionCode: 'OFF20',
    providerCouponId: 'UBXBU32y',
    providerPromotionCodeId: 'promo_1U1kOyJCYGyYR7NPQ3ZZcUpM',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 100,
    expiresAt: '2027-12-31T23:59:00.000Z',
    metadata: { seed: true },
  },
  {
    name: 'OFF30',
    promotionCode: 'OFF30',
    providerCouponId: 'HtX9SM6F',
    providerPromotionCodeId: 'promo_1U1kOzJCYGyYR7NP8ygjHt6X',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 30,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 100,
    expiresAt: '2027-12-31T23:59:00.000Z',
    metadata: { seed: true },
  },
];
