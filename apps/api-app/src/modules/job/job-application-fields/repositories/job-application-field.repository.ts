import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import { JobApplicationField } from '../entities/job-application-field.entity';

@Injectable()
export class JobApplicationFieldRepository extends BaseRepository<JobApplicationField> {
  constructor(
    @InjectRepository(JobApplicationField)
    repository: Repository<JobApplicationField>,
  ) {
    super(repository);
  }

  /**
   * List application fields for a job ordered by sortOrder.
   * @param jobId
   * @returns
   */
  async findByJobId(jobId: string): Promise<JobApplicationField[]> {
    return this.repository.find({
      where: { jobId },
      order: { sortOrder: 'ASC' },
    });
  }

  /** Hard-delete an application field row. */
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
