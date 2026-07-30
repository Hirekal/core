import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { RequestContextGuard } from '../../../common/request-context/request-context.guard';
import { CurrentOrganizationId } from '../../../common/request-context/current-organization-id.decorator';
import { toErrorMessage } from '../../../common/utils/error.util';
import {
    CreateJobQuestionDto,
    ReorderQuestionsDto,
    UpdateJobQuestionDto,
} from './dto/create-job-question.dto';
import { JobQuestionsService } from './job-questions.service';

@Controller('jobs/:jobId/questions')
@UseGuards(RequestContextGuard)
export class JobQuestionsController {
    private readonly logger = new Logger(JobQuestionsController.name);

    constructor(private readonly questionsService: JobQuestionsService) { }

    /**
     * List all questions for a job.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    @Get()
    async findAll(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentOrganizationId() organizationId: string,
    ) {
        try {
            return await this.questionsService.findAll(jobId, organizationId);
        } catch (error) {
            this.logger.error(
                `List questions for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Create a new question for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Post()
    async create(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentOrganizationId() organizationId: string,
        @Body() dto: CreateJobQuestionDto,
    ) {
        try {
            return await this.questionsService.create(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Create question for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Reorder questions for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('reorder')
    async reorder(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentOrganizationId() organizationId: string,
        @Body() dto: ReorderQuestionsDto,
    ) {
        try {
            return await this.questionsService.reorder(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Reorder questions for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Update a question for a job.
     * @param jobId 
     * @param questionId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch(':questionId')
    async update(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @Param('questionId', ParseUUIDPipe) questionId: string,
        @CurrentOrganizationId() organizationId: string,
        @Body() dto: UpdateJobQuestionDto,
    ) {
        try {
            return await this.questionsService.update(
                jobId,
                questionId,
                organizationId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Update question ${questionId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Delete a question for a job.
     * @param jobId 
     * @param questionId 
     * @param organizationId 
     * @returns 
     */
    @Delete(':questionId')
    async delete(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @Param('questionId', ParseUUIDPipe) questionId: string,
        @CurrentOrganizationId() organizationId: string,
    ) {
        try {
            return await this.questionsService.delete(
                jobId,
                questionId,
                organizationId,
            );
        } catch (error) {
            this.logger.error(
                `Delete question ${questionId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
