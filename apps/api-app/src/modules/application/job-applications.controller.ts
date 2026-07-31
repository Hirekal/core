import { Controller, Get, Logger, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import { ListApplicationsQueryDto } from './dto/application.dto';
import { ApplicationService } from './application.service';

@Controller('jobs')
export class JobApplicationsController {
    private readonly logger = new Logger(JobApplicationsController.name);

    constructor(private readonly applicationService: ApplicationService) { }

    /**
     * Lists applications for a given job.
     * @param jobId - The ID of the job.
     * @param organizationId - The ID of the organization.
     * @param query - The query for the list.
     * @returns The applications for the given job.
     */
    @Get(':jobId/applications')
    async list(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Query() query: ListApplicationsQueryDto,
    ) {
        try {
            return await this.applicationService.listForJob(
                jobId,
                organizationId,
                query,
            );
        } catch (error) {
            this.logger.error(
                `List applications for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
