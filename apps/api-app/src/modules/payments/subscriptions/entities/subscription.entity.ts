/**
 * @fileoverview TypeORM entity for the subscription table.
 */
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  RecordStatus,
  SubscriptionStatus,
} from '../../common/enums/payment.enums';
import { PaymentCustomer } from '../../payment-customers/entities/payment-customer.entity';
import { Price } from '../../prices/entities/price.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';
import { Payment } from '../../payments-record/entities/payment.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid' })
  priceId: string;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerSubscriptionId: string;

  @Column({ type: 'varchar', length: 50 })
  subscriptionStatus: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamptz' })
  currentPeriodEnd: Date;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trialStart: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trialEnd: Date | null;

  declare status: RecordStatus;

  @ManyToOne(() => PaymentCustomer, (customer) => customer.subscriptions)
  @JoinColumn({ name: 'customerId' })
  customer: PaymentCustomer;

  @ManyToOne(() => Price, (price) => price.subscriptions)
  @JoinColumn({ name: 'priceId' })
  price: Price;

  @ManyToOne(() => PaymentProvider, (provider) => provider.subscriptions)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;

  @OneToMany(() => Payment, (payment) => payment.subscription)
  payments: Payment[];

  @OneToMany(() => Invoice, (invoice) => invoice.subscription)
  invoices: Invoice[];
}
