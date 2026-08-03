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
  ) {}

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

  /**
   * Whether this browser session already recorded the given event for a job.
   * @param jobId - The ID of the job.
   * @param eventType - The type of event.
   * @param sessionId - The ID of the session.
   * @returns Whether the session event exists.
   */
  async hasSessionEvent(
    jobId: string,
    eventType: JobAnalyticsEventType,
    sessionId: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { jobId, eventType, sessionId },
    });
    return count > 0;
  }
}
