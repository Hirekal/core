import { Column, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTimestampTransformer } from '../utils/timestamp.util';

/**
 * Shared base columns for all entities: id + createdAt + updatedAt.
 *
 * Timestamps are bigint epoch ms (project convention).
 */
// export abstract class BaseEntity {
//   @PrimaryGeneratedColumn('uuid')
//   id!: string;

//   @Column({ type: 'bigint', transformer: bigintTimestampTransformer })
//   createdAt!: number;

//   @Column({ type: 'bigint', transformer: bigintTimestampTransformer })
//   updatedAt!: number;
// }

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;
}
