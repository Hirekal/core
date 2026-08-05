/**
 * @fileoverview Default coupon catalog for database seeding.
 * Edit Stripe IDs and terms here, then run migrations.
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
    providerCouponId: 'AJUf7EPf',
    providerPromotionCodeId: 'promo_1U12LYJCYGyYR7NPUaUNqBUG',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 10,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 1,
    expiresAt: '2026-08-07T23:59:00.000Z',
    metadata: { seed: true },
  },
  {
    name: 'OFF20',
    promotionCode: 'OFF20',
    providerCouponId: '6KbnVGnn',
    providerPromotionCodeId: 'promo_1U12KrJCYGyYR7NPjyOc9bkp',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 1,
    expiresAt: '2026-08-07T23:59:00.000Z',
    metadata: { seed: true },
  },
  {
    name: 'OFF30',
    promotionCode: 'OFF30',
    providerCouponId: 'ib919CQN',
    providerPromotionCodeId: 'promo_1U12IkJCYGyYR7NPpWD5iHiT',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 30,
    duration: CouponDuration.ONCE,
    maximumRedemptions: 1,
    expiresAt: '2026-08-07T23:59:00.000Z',
    metadata: { seed: true },
  },
];
