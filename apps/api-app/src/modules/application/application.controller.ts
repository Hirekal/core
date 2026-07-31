import {
    Body,
    Controller,
    Delete,
    Get,
    Logger,
    Param,
    ParseUUIDPipe,
    Patch,
} from '@nestjs/common';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import {
    UpdateApplicationRatingDto,
    UpdateApplicationStageDto,
} from './dto/application.dto';
import { ApplicationService } from './application.service';

@Controller('applications')
export class ApplicationController {
    private readonly logger = new Logger(ApplicationController.name);

    constructor(private readonly applicationService: ApplicationService) { }

    /**
     * Finds an application by ID for a given organization.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @returns The application for the given ID and organization.
     */
    @Get(':id')
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.applicationService.findByIdForOrg(
                id,
                organizationId,
            );
        } catch (error) {
            this.logger.error(
                `Get application ${id} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Updates the stage of a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @param userId - The ID of the user.
     * @param dto - The data for the update.
     * @returns The updated application.
     */
    @Patch(':id/stage')
    async updateStage(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('organizationId') organizationId: string,
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateApplicationStageDto,
    ) {
        try {
            return await this.applicationService.updateStage(
                id,
                organizationId,
                userId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Update stage ${id} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Updates the rating of a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @param dto - The data for the update.
     * @returns The updated application.
     */
    @Patch(':id/rating')
    async updateRating(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: UpdateApplicationRatingDto,
    ) {
        try {
            return await this.applicationService.updateRating(
                id,
                organizationId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Update rating ${id} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Removes a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @returns The void.
     */
    @Delete(':id')
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            await this.applicationService.softDelete(id, organizationId);
            return { success: true };
        } catch (error) {
            this.logger.error(
                `Delete application ${id} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
