/**
 * @fileoverview TypeORM entity for the payment table.
 */
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  RecordStatus,
  PaymentMethodType,
  PaymentStatus,
} from '../../common/enums/payment.enums';
import { PaymentCustomer } from '../../payment-customers/entities/payment-customer.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';

@Entity('payments')
export class Payment extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerPaymentId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: PaymentMethodType | null;

  @Column({ type: 'varchar', length: 50 })
  paymentStatus: PaymentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  declare status: RecordStatus;

  @ManyToOne(() => PaymentCustomer, (customer) => customer.payments)
  @JoinColumn({ name: 'customerId' })
  customer: PaymentCustomer;

  @ManyToOne(() => Subscription, (subscription) => subscription.payments, {
    nullable: true,
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription | null;

  @ManyToOne(() => PaymentProvider, (provider) => provider.payments)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;
}
