/**
 * @fileoverview Base columns for webhook audit records.
 */
import { PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Audit-only webhook event record without soft delete.
 */
export abstract class WebhookEventBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
