import { Column, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTimestampTransformer } from '../utils/timestamp.util';

/**
 * Shared base columns for all entities: id + createdAt + updatedAt.
 *
 * Timestamps are bigint epoch ms (project convention).
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', transformer: bigintTimestampTransformer })
  createdAt!: number;

  @Column({ type: 'bigint', transformer: bigintTimestampTransformer })
  updatedAt!: number;
}

/**
 * Extends BaseEntity with soft-delete support (`deletedAt`).
 * Use for entities that soft-delete instead of hard-delete (e.g. jobs).
 */
export abstract class SoftDeletableEntity extends BaseEntity {
  @Column({
    type: 'bigint',
    nullable: true,
    transformer: bigintTimestampTransformer,
  })
  deletedAt!: number | null;
}
