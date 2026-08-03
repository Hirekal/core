/**
 * @fileoverview TypeORM entity for the payment method table.
 */
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  RecordStatus,
  PaymentMethodType,
} from '../../common/enums/payment.enums';
import { PaymentCustomer } from '../../payment-customers/entities/payment-customer.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';

@Entity('paymentMethods')
export class PaymentMethod extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerPaymentMethodId: string;

  @Column({ type: 'varchar', length: 50 })
  type: PaymentMethodType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  last4: string | null;

  @Column({ type: 'integer', nullable: true })
  expMonth: number | null;

  @Column({ type: 'integer', nullable: true })
  expYear: number | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  declare status: RecordStatus;

  @ManyToOne(() => PaymentCustomer, (customer) => customer.paymentMethods)
  @JoinColumn({ name: 'customerId' })
  customer: PaymentCustomer;

  @ManyToOne(() => PaymentProvider, (provider) => provider.paymentMethods)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;
}
