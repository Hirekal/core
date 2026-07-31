import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobAnalyticsEventType } from '../../enums/application.enums';
import { JobAnalyticsEvent } from '../entities/job-analytics-event.entity';

@Injectable()
export class JobAnalyticsEventRepository {
    constructor(
        @InjectRepository(JobAnalyticsEvent)
        private readonly repository: Repository<JobAnalyticsEvent>,
    ) { }

    /**
     * Records a new job analytics event.
     * @param jobId - The ID of the job.
     * @param eventType - The type of event.
     * @param sessionId - The ID of the session.
     * @returns The created job analytics event.
     */
    async record(
        jobId: string,
        eventType: JobAnalyticsEventType,
        sessionId?: string | null,
    ): Promise<JobAnalyticsEvent> {
        const event = this.repository.create({
            jobId,
            eventType,
            sessionId: sessionId ?? null,
        });
        return this.repository.save(event);
    }
}
