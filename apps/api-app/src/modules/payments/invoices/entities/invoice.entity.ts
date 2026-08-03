/**
 * @fileoverview TypeORM entity for the invoice table.
 */
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecordStatus, InvoiceStatus } from '../../common/enums/payment.enums';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments-record/entities/payment.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';

@Entity('invoices')
export class Invoice extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerInvoiceId: string;

  @Column({ type: 'integer' })
  amountDue: number;

  @Column({ type: 'integer' })
  amountPaid: number;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 50 })
  invoiceStatus: InvoiceStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  invoiceUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  invoicePdf: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  declare status: RecordStatus;

  @ManyToOne(() => Subscription, (subscription) => subscription.invoices, {
    nullable: true,
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription | null;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment | null;

  @ManyToOne(() => PaymentProvider, (provider) => provider.invoices)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;
}
