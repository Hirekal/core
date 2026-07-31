import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import { JobPipelineStage } from '../entities/job-pipeline-stage.entity';

@Injectable()
export class JobPipelineStageRepository extends BaseRepository<JobPipelineStage> {
    constructor(
        @InjectRepository(JobPipelineStage)
        repository: Repository<JobPipelineStage>,
    ) {
        super(repository);
    }

    /**
     * List all pipeline stages for a job, optionally active only.
     * @param jobId 
     * @param activeOnly 
     * @returns 
     */
    async findByJobId(
        jobId: string,
        activeOnly = false,
    ): Promise<JobPipelineStage[]> {
        const where: { jobId: string; active?: boolean } = { jobId };
        if (activeOnly) {
            where.active = true;
        }
        return this.repository.find({
            where,
            order: { sortOrder: 'ASC' },
        });
    }

    /**
     * Check if a slug is already taken for a job.
     * @param jobId 
     * @param slug 
     * @param excludeId 
     * @returns 
     */
    async isSlugTakenForJob(
        jobId: string,
        slug: string,
        excludeId?: string,
    ): Promise<boolean> {
        const qb = this.repository
            .createQueryBuilder('stage')
            .where('stage.jobId = :jobId', { jobId })
            .andWhere('stage.slug = :slug', { slug });

        if (excludeId) {
            qb.andWhere('stage.id != :excludeId', { excludeId });
        }

        return (await qb.getCount()) > 0;
    }
}
