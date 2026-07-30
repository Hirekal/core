import {
    BadRequestException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PipelineStageErrors } from '../constants/pipeline-stage-errors';
import { slugifyTitle } from '../../../common/utils/slug.util';
import { JobService } from '../job.service';
import {
    CreateJobPipelineStageDto,
    ReorderPipelineStagesDto,
    UpdateJobPipelineStageDto,
} from './dto/create-job-pipeline-stage.dto';
import { JobPipelineStage } from './entities/job-pipeline-stage.entity';
import { JobPipelineStageRepository } from './repositories/job-pipeline-stage.repository';

@Injectable()
export class JobPipelineStagesService {
    private readonly logger = new Logger(JobPipelineStagesService.name);

    constructor(
        private readonly stageRepository: JobPipelineStageRepository,
        private readonly jobService: JobService,
    ) { }

    /**
     * List all pipeline stages for a job, optionally active only.
     * @param jobId 
     * @param organizationId 
     * @param activeOnly 
     * @returns 
     */
    async findAll(
        jobId: string,
        organizationId: string,
        activeOnly = false,
    ): Promise<JobPipelineStage[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);
            return this.stageRepository.findByJobId(jobId, activeOnly);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `findAll failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(PipelineStageErrors.FAILED_TO_LIST);
        }
    }

    /**
     * Add a custom pipeline stage with slug derived from name.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async create(
        jobId: string,
        organizationId: string,
        dto: CreateJobPipelineStageDto,
    ): Promise<JobPipelineStage> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const baseSlug = slugifyTitle(dto.name);
            let slug = baseSlug;
            let suffix = 2;
            while (await this.stageRepository.isSlugTakenForJob(jobId, slug)) {
                slug = `${baseSlug}-${suffix++}`;
            }

            const existing = await this.stageRepository.findByJobId(jobId);
            const timestamp = new Date();

            return this.stageRepository.create({
                jobId,
                name: dto.name,
                slug,
                sortOrder: dto.sortOrder ?? existing.length + 1,
                active: dto.active ?? true,
                isDefault: false,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `create failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                PipelineStageErrors.FAILED_TO_CREATE,
            );
        }
    }

    /**
     * Update stage name, active flag, or sortOrder.
     * @param jobId 
     * @param stageId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async update(
        jobId: string,
        stageId: string,
        organizationId: string,
        dto: UpdateJobPipelineStageDto,
    ): Promise<JobPipelineStage> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const stage = await this.stageRepository.findById(stageId);
            if (!stage || stage.jobId !== jobId) {
                throw new NotFoundException(PipelineStageErrors.NOT_FOUND(stageId));
            }

            const updateData: Partial<JobPipelineStage> = {
                updatedAt: new Date(),
            };

            if (dto.name !== undefined) {
                updateData.name = dto.name;
                const baseSlug = slugifyTitle(dto.name);
                let slug = baseSlug;
                let suffix = 2;
                while (
                    await this.stageRepository.isSlugTakenForJob(jobId, slug, stageId)
                ) {
                    slug = `${baseSlug}-${suffix++}`;
                }
                updateData.slug = slug;
            }
            if (dto.active !== undefined) updateData.active = dto.active;
            if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

            const updated = await this.stageRepository.update(stageId, updateData);
            return updated!;
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `update failed stageId=${stageId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                PipelineStageErrors.FAILED_TO_UPDATE,
            );
        }
    }

    /**
     * Deactivate a custom stage. Default stages cannot be deleted.
     * @param jobId 
     * @param stageId 
     * @param organizationId 
     * @returns 
     */
    async delete(
        jobId: string,
        stageId: string,
        organizationId: string,
    ): Promise<{ success: boolean }> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const stage = await this.stageRepository.findById(stageId);
            if (!stage || stage.jobId !== jobId) {
                throw new NotFoundException(PipelineStageErrors.NOT_FOUND(stageId));
            }

            if (stage.isDefault) {
                throw new BadRequestException(PipelineStageErrors.CANNOT_DELETE_DEFAULT);
            }

            await this.stageRepository.update(stageId, {
                active: false,
                updatedAt: new Date(),
            });

            return { success: true };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `delete failed stageId=${stageId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                PipelineStageErrors.FAILED_TO_DELETE,
            );
        }
    }

    /**
     * Reorder stages by id list.
     * Every ID must belong to this job — never update by UUID alone.
     */
    async reorder(
        jobId: string,
        organizationId: string,
        dto: ReorderPipelineStagesDto,
    ): Promise<JobPipelineStage[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const existing = await this.stageRepository.findByJobId(jobId);
            const validIds = new Set(existing.map((s) => s.id));
            const invalidId = dto.stageIds.find((id) => !validIds.has(id));
            if (invalidId) {
                throw new BadRequestException(
                    PipelineStageErrors.STAGE_NOT_IN_JOB(invalidId, jobId),
                );
            }

            const timestamp = new Date();
            for (let i = 0; i < dto.stageIds.length; i++) {
                await this.stageRepository.update(dto.stageIds[i], {
                    sortOrder: i + 1,
                    updatedAt: timestamp,
                });
            }

            return this.stageRepository.findByJobId(jobId);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `reorder failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                PipelineStageErrors.FAILED_TO_REORDER,
            );
        }
    }
}
