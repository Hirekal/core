/**
 * @fileoverview TypeORM entity for the price table.
 */
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecordStatus, PriceInterval } from '../../common/enums/payment.enums';
import { Product } from '../../products/entities/product.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity('prices')
export class Price extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerPriceId: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  interval: PriceInterval | null;

  @Column({ type: 'integer', nullable: true })
  intervalCount: number | null;

  declare status: RecordStatus;

  @ManyToOne(() => Product, (product) => product.prices)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => PaymentProvider, (provider) => provider.prices)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;

  @OneToMany(() => Subscription, (subscription) => subscription.price)
  subscriptions: Subscription[];
}
