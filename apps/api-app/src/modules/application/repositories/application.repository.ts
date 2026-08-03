import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import {
    ApplicationSortBy,
    ApplicationStatus,
} from '../enums/application.enums';
import { Application } from '../entities/application.entity';

export interface ApplicationListOptions {
    jobId: string;
    organizationId: string;
    stageId?: string;
    search?: string;
    sortBy?: ApplicationSortBy;
    status?: ApplicationStatus;
}

@Injectable()
export class ApplicationRepository extends BaseRepository<Application> {
    constructor(
        @InjectRepository(Application)
        repository: Repository<Application>,
    ) {
        super(repository);
    }

    /**
     * Finds an application by ID for a given organization.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @returns The application for the given ID and organization.
     */
    async findByIdForOrg(
        id: string,
        organizationId: string,
    ): Promise<Application | null> {
        return this.repository.findOne({
            where: { id, organizationId, deletedAt: IsNull() },
            relations: {
                fieldValues: true,
                answers: { question: true },
                notes: true,
                stage: true,
            },
        });
    }

    /**
     * Finds an application with relations needed to build a webhook payload.
     * @param id - The ID of the application.
     * @returns The application for the given ID with its webhook relations.
     */
    async findByIdWithWebhookRelations(
        id: string,
    ): Promise<Application | null> {
        return this.repository.findOne({
            where: { id, deletedAt: IsNull() },
            relations: {
                fieldValues: true,
                answers: { question: true },
                stage: true,
            },
        });
    }

    /**
     * Finds an application by ID with its token.
     * @param id - The ID of the application.
     * @returns The application for the given ID with its token.
     */
    async findByIdWithToken(id: string): Promise<Application | null> {
        return this.repository.findOne({
            where: { id, deletedAt: IsNull() },
            relations: {
                fieldValues: true,
                answers: true,
                job: {
                    questions: true,
                    applicationFields: true,
                    pipelineStages: true,
                },
            },
        });
    }

    /**
     * Lists applications for a given job.
     * @param options - The options for the list.
     * @returns The applications for the given job.
     */
    async listForJob(
        options: ApplicationListOptions,
    ): Promise<Application[]> {
        const qb = this.repository
            .createQueryBuilder('application')
            .leftJoinAndSelect('application.stage', 'stage')
            .leftJoinAndSelect('application.answers', 'answers')
            .where('application.jobId = :jobId', { jobId: options.jobId })
            .andWhere('application.organizationId = :organizationId', {
                organizationId: options.organizationId,
            })
            .andWhere('application.deletedAt IS NULL');

        if (options.stageId) {
            qb.andWhere('application.stageId = :stageId', {
                stageId: options.stageId,
            });
        }

        if (options.status) {
            qb.andWhere('application.status = :status', {
                status: options.status,
            });
        } else {
            qb.andWhere('application.status = :submitted', {
                submitted: ApplicationStatus.SUBMITTED,
            });
        }

        if (options.search) {
            const q = `%${options.search.toLowerCase()}%`;
            qb.andWhere(
                `(LOWER(application.firstName) LIKE :q OR LOWER(application.lastName) LIKE :q OR LOWER(application.email) LIKE :q)`,
                { q },
            );
        }

        switch (options.sortBy) {
            case ApplicationSortBy.NAME:
                qb.orderBy('application.firstName', 'ASC')
                    .addOrderBy('application.lastName', 'ASC');
                break;
            case ApplicationSortBy.STAGE:
                qb.orderBy('stage.sortOrder', 'ASC');
                break;
            case ApplicationSortBy.SUBMITTED:
            default:
                qb.orderBy('application.submittedAt', 'DESC', 'NULLS LAST')
                    .addOrderBy('application.startedAt', 'DESC');
                break;
        }

        return qb.getMany();
    }

    /**
     * Increments the counters for a given job.
     * @param jobId - The ID of the job.
     * @param field - The field to increment.
     * @returns The void.
     */
    async incrementJobCounters(
        jobId: string,
        field: 'applicationsStarted' | 'applicationsSubmitted' | 'applicationCount',
    ): Promise<void> {
        await this.repository.manager.query(
            `UPDATE jobs SET "${field}" = "${field}" + 1, "updatedAt" = now() WHERE id = $1`,
            [jobId],
        );
    }
}
