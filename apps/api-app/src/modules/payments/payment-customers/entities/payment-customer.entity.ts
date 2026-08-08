/**
 * @fileoverview TypeORM entity for the payment customer table.
 */
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecordStatus } from '../../common/enums/payment.enums';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments-record/entities/payment.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

@Entity('paymentCustomers')
export class PaymentCustomer extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerCustomerId: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  declare status: RecordStatus;

  @ManyToOne(() => PaymentProvider, (provider) => provider.customers)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;

  @OneToMany(() => Subscription, (subscription) => subscription.customer)
  subscriptions: Subscription[];

  @OneToMany(() => Payment, (payment) => payment.customer)
  payments: Payment[];

  @OneToMany(() => PaymentMethod, (method) => method.customer)
  paymentMethods: PaymentMethod[];
}
