/**
 * @fileoverview TypeORM entity for successful coupon redemptions.
 */
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Coupon } from './coupon.entity';

@Entity('paymentCouponRedemptions')
export class CouponRedemption extends BaseEntity {
  @Column({ type: 'uuid' })
  couponId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 100 })
  promotionCode: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  providerInvoiceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerSubscriptionId: string | null;

  @ManyToOne(() => Coupon)
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;
}
