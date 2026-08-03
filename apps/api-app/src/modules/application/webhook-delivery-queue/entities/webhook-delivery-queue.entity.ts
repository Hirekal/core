import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WebhookEvent,
  WebhookQueueStatus,
} from '../../enums/application.enums';

@Entity('webhookDeliveryQueue')
export class WebhookDeliveryQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @Column({ type: 'varchar', length: 50 })
  event!: WebhookEvent;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookQueueStatus.PENDING,
  })
  status!: WebhookQueueStatus;

  @Column({ type: 'varchar', length: 500 })
  requestUrl!: string;

  @Column({ type: 'uuid', nullable: true })
  fromStageId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  toStageId!: string | null;

  @Column({ type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
