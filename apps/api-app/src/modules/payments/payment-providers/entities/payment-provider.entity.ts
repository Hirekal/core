/**
 * @fileoverview TypeORM entity for the payment provider table.
 */
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecordStatus } from '../../common/enums/payment.enums';
import { PaymentCustomer } from '../../payment-customers/entities/payment-customer.entity';
import { Price } from '../../prices/entities/price.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments-record/entities/payment.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { WebhookEvent } from '../../webhooks/entities/webhook-event.entity';
import { Coupon } from '../../coupons/entities/coupon.entity';

@Entity('paymentProviders')
export class PaymentProvider extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  declare status: RecordStatus;

  @OneToMany(() => PaymentCustomer, (customer) => customer.paymentProvider)
  customers: PaymentCustomer[];

  @OneToMany(() => Price, (price) => price.paymentProvider)
  prices: Price[];

  @OneToMany(() => Subscription, (subscription) => subscription.paymentProvider)
  subscriptions: Subscription[];

  @OneToMany(() => Payment, (payment) => payment.paymentProvider)
  payments: Payment[];

  @OneToMany(() => PaymentMethod, (method) => method.paymentProvider)
  paymentMethods: PaymentMethod[];

  @OneToMany(() => Invoice, (invoice) => invoice.paymentProvider)
  invoices: Invoice[];

  @OneToMany(() => WebhookEvent, (event) => event.paymentProvider)
  webhookEvents: WebhookEvent[];

  @OneToMany(() => Coupon, (coupon) => coupon.paymentProvider)
  coupons: Coupon[];
}
