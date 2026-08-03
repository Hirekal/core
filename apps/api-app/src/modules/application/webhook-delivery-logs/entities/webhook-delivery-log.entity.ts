import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  WebhookDeliveryStatus,
  WebhookEvent,
} from '../../enums/application.enums';

@Entity('webhookDeliveryLogs')
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @Column({ type: 'uuid', nullable: true })
  applicationId!: string | null;

  @Column({ type: 'varchar', length: 50 })
  event!: WebhookEvent;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'varchar', length: 500 })
  requestUrl!: string;

  @Column({ type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'text', nullable: true })
  responseBody!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
