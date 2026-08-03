import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import {
    JobListStatusFilter,
    JobSortBy,
    JobStatus,
    SortOrder,
} from '../enums/job.enums';
import { Job } from '../entities/job.entity';

export interface JobListOptions {
    organizationId: string;
    status?: JobListStatusFilter;
    search?: string;
    sortBy?: JobSortBy;
    order?: SortOrder;
    page?: number;
    limit?: number;
}

@Injectable()
export class JobRepository extends BaseRepository<Job> {
    constructor(
        @InjectRepository(Job)
        repository: Repository<Job>,
    ) {
        super(repository);
    }

    /**
     * Check if a slug is already taken for a job.
     * @param slug 
     * @param excludeId 
     * @returns 
     */
    async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
        const qb = this.repository
            .createQueryBuilder('job')
            .where('job.slug = :slug', { slug })
            .andWhere('job.deletedAt IS NULL');

        if (excludeId) {
            qb.andWhere('job.id != :excludeId', { excludeId });
        }

        const count = await qb.getCount();
        return count > 0;
    }

    /**
     * Find an active job by globally unique slug.
     * @param slug 
     * @returns 
     */
    async findBySlug(slug: string): Promise<Job | null> {
        return this.repository.findOne({
            where: { slug, deletedAt: IsNull() },
            relations: {
                questions: true,
                applicationFields: true,
                pipelineStages: true,
                settings: true,
            },
        });
    }

    /**
     * Find org-scoped job by id excluding soft-deleted.
     * @param id 
     * @param organizationId 
     * @returns 
     */
    async findByIdForOrg(
        id: string,
        organizationId: string,
    ): Promise<Job | null> {
        return this.repository.findOne({
            where: { id, organizationId, deletedAt: IsNull() },
            relations: {
                questions: true,
                applicationFields: true,
                pipelineStages: true,
                settings: true,
            },
        });
    }

    /**
     * Paginated org-scoped job list.
     * @param options 
     * @returns 
     */
    async findByOrganization(options: JobListOptions): Promise<{
        items: Job[];
        total: number;
    }> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 20;
        const skip = (page - 1) * limit;

        const qb = this.repository
            .createQueryBuilder('job')
            .where('job.organizationId = :organizationId', {
                organizationId: options.organizationId,
            })
            .andWhere('job.deletedAt IS NULL');

        if (options.status && options.status !== JobListStatusFilter.ALL) {
            qb.andWhere('job.status = :status', { status: options.status });
        }

        if (options.search) {
            qb.andWhere(
                '(LOWER(job.title) LIKE :search OR LOWER(job.company) LIKE :search OR LOWER(job.location) LIKE :search)',
                { search: `%${options.search.toLowerCase()}%` },
            );
        }

        const sortBy = options.sortBy ?? JobSortBy.UPDATED_AT;
        const order = (options.order ?? SortOrder.DESC).toUpperCase() as
            | 'ASC'
            | 'DESC';

        switch (sortBy) {
            case JobSortBy.TITLE:
                qb.orderBy('job.title', order);
                break;
            case JobSortBy.CREATED_AT:
                qb.orderBy('job.createdAt', order);
                break;
            case JobSortBy.APPLICATION_COUNT:
                qb.orderBy('job.applicationCount', order);
                break;
            case JobSortBy.UPDATED_AT:
            default:
                qb.orderBy('job.updatedAt', order);
                break;
        }

        qb.skip(skip).take(limit);

        const [items, total] = await qb.getManyAndCount();
        return { items, total };
    }

    /**
     * Find public job by slug — ACTIVE only, not soft-deleted.
     * @param slug 
     * @returns 
     */
    async findPublicBySlug(slug: string): Promise<Job | null> {
        return this.repository.findOne({
            where: {
                slug,
                status: JobStatus.ACTIVE,
                deletedAt: IsNull(),
            },
            relations: {
                questions: true,
                applicationFields: true,
                settings: true,
            },
        });
    }

    /**
     * Atomically increment a job analytics counter column.
     */
    async incrementCounter(
        jobId: string,
        field:
            | 'visitorCount'
            | 'viewers'
            | 'applicationsStarted'
            | 'applicationsSubmitted'
            | 'applicationCount',
    ): Promise<void> {
        await this.repository.query(
            `UPDATE jobs SET "${field}" = "${field}" + 1, "updatedAt" = now() WHERE id = $1`,
            [jobId],
        );
    }
}
