import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../../common/repositories/base.repository';
import { JobQuestion } from '../entities/job-question.entity';

@Injectable()
export class JobQuestionRepository extends BaseRepository<JobQuestion> {
    constructor(
        @InjectRepository(JobQuestion)
        repository: Repository<JobQuestion>,
    ) {
        super(repository);
    }

    /**
     * List all questions for a job ordered by sortOrder.
     * @param jobId 
     * @returns 
     */
    async findByJobId(jobId: string): Promise<JobQuestion[]> {
        return this.repository.find({
            where: { jobId },
            order: { sortOrder: 'ASC' },
        });
    }

    /**
     * Find built-in video question for a job.
     * @param jobId 
     * @returns 
     */
    async findBuiltInVideo(jobId: string): Promise<JobQuestion | null> {
        return this.repository.findOne({
            where: { jobId, builtIn: true },
        });
    }

    /**
     * Hard-delete a question row.
     * @param id 
     * @returns 
     */
    async hardDelete(id: string): Promise<void> {
        await this.repository.delete(id);
    }
}
