import {
    BadRequestException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ApplicationFieldErrors } from '../constants/application-field-errors';
import { nowMs } from '../../../common/utils/timestamp.util';
import { JobService } from '../job.service';
import {
    CreateJobApplicationFieldDto,
    ReorderApplicationFieldsDto,
    UpdateJobApplicationFieldDto,
} from './dto/create-job-application-field.dto';
import { JobApplicationField } from './entities/job-application-field.entity';
import { JobApplicationFieldRepository } from './repositories/job-application-field.repository';

@Injectable()
export class JobApplicationFieldsService {
    private readonly logger = new Logger(JobApplicationFieldsService.name);

    constructor(
        private readonly fieldRepository: JobApplicationFieldRepository,
        private readonly jobService: JobService,
    ) { }

    /**
     * List all application fields for a job.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    async findAll(
        jobId: string,
        organizationId: string,
    ): Promise<JobApplicationField[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);
            return this.fieldRepository.findByJobId(jobId);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `findAll failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationFieldErrors.FAILED_TO_LIST,
            );
        }
    }

    /**
     * Create a custom application field.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async create(
        jobId: string,
        organizationId: string,
        dto: CreateJobApplicationFieldDto,
    ): Promise<JobApplicationField> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const existing = await this.fieldRepository.findByJobId(jobId);
            const timestamp = nowMs();

            return this.fieldRepository.create({
                jobId,
                sortOrder: dto.sortOrder ?? existing.length + 1,
                label: dto.label,
                type: dto.type,
                required: dto.required ?? false,
                builtIn: false,
                fieldKey: dto.fieldKey ?? null,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `create failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationFieldErrors.FAILED_TO_CREATE,
            );
        }
    }

    /**
     * Update an application field. Built-in: label/required/sortOrder only.
     * @param jobId 
     * @param fieldId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async update(
        jobId: string,
        fieldId: string,
        organizationId: string,
        dto: UpdateJobApplicationFieldDto,
    ): Promise<JobApplicationField> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const field = await this.fieldRepository.findById(fieldId);
            if (!field || field.jobId !== jobId) {
                throw new NotFoundException(ApplicationFieldErrors.NOT_FOUND(fieldId));
            }

            const updateData: Partial<JobApplicationField> = {
                updatedAt: nowMs(),
            };

            if (field.builtIn) {
                if (dto.type && dto.type !== field.type) {
                    throw new BadRequestException(
                        ApplicationFieldErrors.CANNOT_CHANGE_BUILTIN_TYPE,
                    );
                }
                if (dto.label !== undefined) updateData.label = dto.label;
                if (dto.required !== undefined) updateData.required = dto.required;
                if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
            } else {
                if (dto.label !== undefined) updateData.label = dto.label;
                if (dto.type !== undefined) updateData.type = dto.type;
                if (dto.required !== undefined) updateData.required = dto.required;
                if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
            }

            const updated = await this.fieldRepository.update(fieldId, updateData);
            return updated!;
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `update failed fieldId=${fieldId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationFieldErrors.FAILED_TO_UPDATE,
            );
        }
    }

    /**
     * Delete a custom application field.
     * @param jobId 
     * @param fieldId 
     * @param organizationId 
     * @returns 
     */
    async delete(
        jobId: string,
        fieldId: string,
        organizationId: string,
    ): Promise<{ success: boolean }> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const field = await this.fieldRepository.findById(fieldId);
            if (!field || field.jobId !== jobId) {
                throw new NotFoundException(ApplicationFieldErrors.NOT_FOUND(fieldId));
            }

            if (field.builtIn) {
                throw new BadRequestException(
                    ApplicationFieldErrors.CANNOT_DELETE_BUILTIN,
                );
            }

            await this.fieldRepository.hardDelete(fieldId);
            return { success: true };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `delete failed fieldId=${fieldId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationFieldErrors.FAILED_TO_DELETE,
            );
        }
    }

    /**
     * Reorder application fields by id list.
     * Every ID must belong to this job — never update by UUID alone.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async reorder(
        jobId: string,
        organizationId: string,
        dto: ReorderApplicationFieldsDto,
    ): Promise<JobApplicationField[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const existing = await this.fieldRepository.findByJobId(jobId);
            const validIds = new Set(existing.map((f) => f.id));
            const invalidId = dto.fieldIds.find((id) => !validIds.has(id));
            if (invalidId) {
                throw new BadRequestException(
                    ApplicationFieldErrors.FIELD_NOT_IN_JOB(invalidId, jobId),
                );
            }

            const timestamp = nowMs();
            for (let i = 0; i < dto.fieldIds.length; i++) {
                await this.fieldRepository.update(dto.fieldIds[i], {
                    sortOrder: i + 1,
                    updatedAt: timestamp,
                });
            }

            return this.fieldRepository.findByJobId(jobId);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `reorder failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationFieldErrors.FAILED_TO_REORDER,
            );
        }
    }
}
