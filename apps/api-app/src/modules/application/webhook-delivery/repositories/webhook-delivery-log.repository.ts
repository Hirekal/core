import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import { WebhookDeliveryLog } from '../../webhook-delivery-logs/entities/webhook-delivery-log.entity';

@Injectable()
export class WebhookDeliveryLogRepository extends BaseRepository<WebhookDeliveryLog> {
    constructor(
        @InjectRepository(WebhookDeliveryLog)
        repository: Repository<WebhookDeliveryLog>,
    ) {
        super(repository);
    }

    /**
     * Finds recent delivery attempts for a job, newest first.
     * @param jobId - The ID of the job.
     * @param limit - The maximum number of logs to return.
     * @returns The recent delivery attempts for the job.
     */
    async findRecentByJobId(
        jobId: string,
        limit = 50,
    ): Promise<WebhookDeliveryLog[]> {
        return this.repository.find({
            where: { jobId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
}
