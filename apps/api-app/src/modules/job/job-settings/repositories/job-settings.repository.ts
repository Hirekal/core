import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import { JobSettings } from '../entities/job-settings.entity';

@Injectable()
export class JobSettingsRepository extends BaseRepository<JobSettings> {
  constructor(
    @InjectRepository(JobSettings)
    repository: Repository<JobSettings>,
  ) {
    super(repository);
  }

  /** Find settings row for a job. */
  async findByJobId(jobId: string): Promise<JobSettings | null> {
    return this.repository.findOne({ where: { jobId } });
  }
}
