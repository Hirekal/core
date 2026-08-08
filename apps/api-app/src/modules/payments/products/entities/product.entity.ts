/**
 * @fileoverview TypeORM entity for the product table.
 */
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecordStatus } from '../../common/enums/payment.enums';
import { Price } from '../../prices/entities/price.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  declare status: RecordStatus;

  @OneToMany(() => Price, (price) => price.product)
  prices: Price[];
}
