import {
    BadRequestException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { QuestionErrors } from '../constants/question-errors';
import {
    QuestionCategory,
    QuestionType,
} from '../enums/job.enums';
import { JobService } from '../job.service';
import {
    CreateJobQuestionDto,
    ReorderQuestionsDto,
    UpdateJobQuestionDto,
} from './dto/create-job-question.dto';
import { JobQuestion } from './entities/job-question.entity';
import { JobQuestionRepository } from './repositories/job-question.repository';

@Injectable()
export class JobQuestionsService {
    private readonly logger = new Logger(JobQuestionsService.name);

    constructor(
        private readonly questionRepository: JobQuestionRepository,
        private readonly jobService: JobService,
    ) { }

    /**
     * List all questions for a job ordered by sortOrder.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    async findAll(
        jobId: string,
        organizationId: string,
    ): Promise<JobQuestion[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);
            return this.questionRepository.findByJobId(jobId);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `findAll failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(QuestionErrors.FAILED_TO_LIST);
        }
    }

    /**
     * Create a custom question. Cannot create a second built-in video question.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async create(
        jobId: string,
        organizationId: string,
        dto: CreateJobQuestionDto,
    ): Promise<JobQuestion> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            if (
                dto.type === QuestionType.VIDEO &&
                dto.category === QuestionCategory.MEDIA
            ) {
                const existing = await this.questionRepository.findBuiltInVideo(jobId);
                if (existing) {
                    throw new BadRequestException(QuestionErrors.BUILTIN_VIDEO_EXISTS);
                }
            }

            const existing = await this.questionRepository.findByJobId(jobId);
            const timestamp = new Date();

            return this.questionRepository.create({
                jobId,
                sortOrder: dto.sortOrder ?? existing.length + 1,
                label: dto.label,
                type: dto.type,
                category: dto.category ?? QuestionCategory.STANDARD,
                required: dto.required ?? false,
                builtIn: false,
                options: dto.options ?? null,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `create failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(QuestionErrors.FAILED_TO_CREATE);
        }
    }

    /**
     * Update a question. Built-in video: label/required/sortOrder only.
     * @param jobId 
     * @param questionId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async update(
        jobId: string,
        questionId: string,
        organizationId: string,
        dto: UpdateJobQuestionDto,
    ): Promise<JobQuestion> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const question = await this.questionRepository.findById(questionId);
            if (!question || question.jobId !== jobId) {
                throw new NotFoundException(QuestionErrors.NOT_FOUND(questionId));
            }

            const updateData: Partial<JobQuestion> = { updatedAt: new Date() };

            if (question.builtIn) {
                if (dto.type && dto.type !== QuestionType.VIDEO) {
                    throw new BadRequestException(
                        QuestionErrors.CANNOT_CHANGE_BUILTIN_TYPE,
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
                if (dto.options !== undefined) updateData.options = dto.options;
            }

            const updated = await this.questionRepository.update(
                questionId,
                updateData,
            );
            return updated!;
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `update failed questionId=${questionId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(QuestionErrors.FAILED_TO_UPDATE);
        }
    }

    /**
     * Delete a custom question. Built-in questions cannot be deleted.
     * @param jobId 
     * @param questionId 
     * @param organizationId 
     * @returns 
     */
    async delete(
        jobId: string,
        questionId: string,
        organizationId: string,
    ): Promise<{ success: boolean }> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const question = await this.questionRepository.findById(questionId);
            if (!question || question.jobId !== jobId) {
                throw new NotFoundException(QuestionErrors.NOT_FOUND(questionId));
            }

            if (question.builtIn) {
                throw new BadRequestException(QuestionErrors.CANNOT_DELETE_BUILTIN);
            }

            await this.questionRepository.hardDelete(questionId);
            return { success: true };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `delete failed questionId=${questionId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(QuestionErrors.FAILED_TO_DELETE);
        }
    }

    /**
     * Reorder questions by id list (sortOrder 1..n).
     * Every ID must belong to this job — never update by UUID alone.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    async reorder(
        jobId: string,
        organizationId: string,
        dto: ReorderQuestionsDto,
    ): Promise<JobQuestion[]> {
        try {
            await this.jobService.assertJobAccess(jobId, organizationId);

            const existing = await this.questionRepository.findByJobId(jobId);
            const validIds = new Set(existing.map((q) => q.id));
            const invalidId = dto.questionIds.find((id) => !validIds.has(id));
            if (invalidId) {
                throw new BadRequestException(
                    QuestionErrors.QUESTION_NOT_IN_JOB(invalidId, jobId),
                );
            }

            const timestamp = new Date();
            for (let i = 0; i < dto.questionIds.length; i++) {
                await this.questionRepository.update(dto.questionIds[i], {
                    sortOrder: i + 1,
                    updatedAt: timestamp,
                });
            }

            return this.questionRepository.findByJobId(jobId);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `reorder failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(QuestionErrors.FAILED_TO_REORDER);
        }
    }
}
