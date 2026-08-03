/**
 * @fileoverview Shared entity columns for all persisted payment models.
 */
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from 'typeorm';
import { RecordStatus } from '../enums/payment.enums';

/**
 * Base columns inherited by every payment entity.
 */
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

  @Column({ type: 'varchar', length: 50, default: RecordStatus.ACTIVE })
  status: RecordStatus;
}
