/**
 * @fileoverview TypeORM entity for the webhook event table.
 */
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { WebhookProcessingStatus } from '../../common/enums/payment.enums';
import { WebhookEventBaseEntity } from '../../common/entities/webhook-event-base.entity';
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';

@Entity('webhookEvents')
export class WebhookEvent extends WebhookEventBaseEntity {
  @Column({ type: 'uuid' })
  paymentProviderId: string;

  @Column({ type: 'varchar', length: 255 })
  providerEventId: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookProcessingStatus.PENDING,
  })
  processingStatus: WebhookProcessingStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @ManyToOne(() => PaymentProvider, (provider) => provider.webhookEvents)
  @JoinColumn({ name: 'paymentProviderId' })
  paymentProvider: PaymentProvider;
}
