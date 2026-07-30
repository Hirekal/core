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
} from '@nestjs/common';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../../common/utils/error.util';
import {
    CreateJobApplicationFieldDto,
    ReorderApplicationFieldsDto,
    UpdateJobApplicationFieldDto,
} from './dto/create-job-application-field.dto';
import { JobApplicationFieldsService } from './job-application-fields.service';

@Controller('jobs/:jobId/application-fields')
export class JobApplicationFieldsController {
    private readonly logger = new Logger(JobApplicationFieldsController.name);

    constructor(
        private readonly fieldsService: JobApplicationFieldsService,
    ) { }

    /**
     * List all application fields for a job.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    @Get()
    async findAll(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.fieldsService.findAll(jobId, organizationId);
        } catch (error) {
            this.logger.error(
                `List application fields for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Create a new application field for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Post()
    async create(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: CreateJobApplicationFieldDto,
    ) {
        try {
            return await this.fieldsService.create(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Create application field for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Reorder application fields for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('reorder')
    async reorder(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: ReorderApplicationFieldsDto,
    ) {
        try {
            return await this.fieldsService.reorder(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Reorder application fields for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
    /**
     * Update an application field for a job.
     * @param jobId 
     * @param fieldId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch(':fieldId')
    async update(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @Param('fieldId', ParseUUIDPipe) fieldId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: UpdateJobApplicationFieldDto,
    ) {
        try {
            return await this.fieldsService.update(
                jobId,
                fieldId,
                organizationId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Update application field ${fieldId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Delete an application field for a job.
     * @param jobId 
     * @param fieldId 
     * @param organizationId 
     * @returns 
     */
    @Delete(':fieldId')
    async delete(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @Param('fieldId', ParseUUIDPipe) fieldId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.fieldsService.delete(jobId, fieldId, organizationId);
        } catch (error) {
            this.logger.error(
                `Delete application field ${fieldId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
