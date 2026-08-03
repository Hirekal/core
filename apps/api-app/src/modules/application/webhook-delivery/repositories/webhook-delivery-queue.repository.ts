import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import {
  WebhookEvent,
  WebhookQueueStatus,
} from '../../enums/application.enums';
import { WebhookDeliveryQueue } from '../../webhook-delivery-queue/entities/webhook-delivery-queue.entity';

@Injectable()
export class WebhookDeliveryQueueRepository extends BaseRepository<WebhookDeliveryQueue> {
  constructor(
    @InjectRepository(WebhookDeliveryQueue)
    repository: Repository<WebhookDeliveryQueue>,
  ) {
    super(repository);
  }

  /**
   * Finds PENDING new-application queue rows for an application/job.
   */
  async findPendingNewApplication(
    applicationId: string,
    jobId: string,
  ): Promise<WebhookDeliveryQueue[]> {
    return this.repository.find({
      where: {
        applicationId,
        jobId,
        event: WebhookEvent.NEW_APPLICATION,
        status: WebhookQueueStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Claims the next READY_TO_SEND rows for cron processing.
   */
  async claimReadyToSend(limit: number): Promise<WebhookDeliveryQueue[]> {
    const ready = await this.repository.find({
      where: { status: WebhookQueueStatus.READY_TO_SEND },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    if (!ready.length) {
      return [];
    }

    const claimed: WebhookDeliveryQueue[] = [];
    for (const row of ready) {
      const result = await this.repository.update(
        { id: row.id, status: WebhookQueueStatus.READY_TO_SEND },
        {
          status: WebhookQueueStatus.SENDING,
          updatedAt: new Date(),
        },
      );
      if ((result.affected ?? 0) > 0) {
        claimed.push({ ...row, status: WebhookQueueStatus.SENDING });
      }
    }

    return claimed;
  }

  /**
   * Marks a queue row as SENT after delivery attempt (keeps history in queue).
   */
  async markSent(id: string, lastError: string | null = null): Promise<void> {
    await this.repository.update(id, {
      status: WebhookQueueStatus.SENT,
      lastError,
      updatedAt: new Date(),
    });
  }

  /**
   * Marks PENDING new-application rows as READY_TO_SEND.
   */
  async markPendingNewApplicationReady(
    applicationId: string,
    jobId: string,
  ): Promise<number> {
    const result = await this.repository.update(
      {
        applicationId,
        jobId,
        event: WebhookEvent.NEW_APPLICATION,
        status: WebhookQueueStatus.PENDING,
      },
      {
        status: WebhookQueueStatus.READY_TO_SEND,
        updatedAt: new Date(),
      },
    );
    return result.affected ?? 0;
  }
}
