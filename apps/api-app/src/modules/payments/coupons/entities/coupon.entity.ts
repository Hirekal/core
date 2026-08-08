/**
 * @fileoverview TypeORM entity for the payment coupon codes table.
 */
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  CouponDiscountType,
  CouponDuration,
  RecordStatus,
} from '../../common/enums/payment.enums';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';

@Entity('paymentCouponCodes')
export class Coupon extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerCouponId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerPromotionCodeId: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  promotionCode: string;

  @Column({ type: 'varchar', length: 50 })
  discountType: CouponDiscountType;

  @Column({ type: 'integer' })
  discountValue: number;

  @Column({ type: 'varchar', length: 50 })
  duration: CouponDuration;

  @Column({ type: 'integer', nullable: true })
  maximumRedemptions: number | null;

  @Column({ type: 'integer', default: 0 })
  timesRedeemed: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  declare status: RecordStatus;

  @ManyToOne(() => PaymentProvider, (provider) => provider.coupons)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;
}
