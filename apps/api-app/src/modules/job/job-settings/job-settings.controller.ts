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
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { toErrorMessage } from '../../../common/utils/error.util';
import {
    PatchEmailAutomationDto,
    PatchGeneralSettingsDto,
    PatchThankYouPageDto,
    PatchWebhookSettingsDto,
} from './dto/update-job-settings.dto';
import { JobSettingsService } from './job-settings.service';

@Controller('jobs/:jobId/settings')
export class JobSettingsController {
    private readonly logger = new Logger(JobSettingsController.name);

    constructor(private readonly settingsService: JobSettingsService) { }

    /**
     * Get the settings for a job.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    @Get()
    async getSettings(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.settingsService.getSettings(jobId, organizationId);
        } catch (error) {
            this.logger.error(
                `Get settings for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Patch the general settings for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('general')
    async patchGeneral(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PatchGeneralSettingsDto,
    ) {
        try {
            return await this.settingsService.patchGeneral(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Patch general settings for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Patch the thank-you page settings for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('thank-you')
    async patchThankYou(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PatchThankYouPageDto,
    ) {
        try {
            return await this.settingsService.patchThankYou(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Patch thank-you settings for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Patch the email automation settings for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('email-automation')
    async patchEmailAutomation(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PatchEmailAutomationDto,
    ) {
        try {
            return await this.settingsService.patchEmailAutomation(
                jobId,
                organizationId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Patch email automation for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Patch the webhook settings for a job.
     * @param jobId 
     * @param organizationId 
     * @param dto 
     * @returns 
     */
    @Patch('webhook')
    async patchWebhook(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PatchWebhookSettingsDto,
    ) {
        try {
            return await this.settingsService.patchWebhook(jobId, organizationId, dto);
        } catch (error) {
            this.logger.error(
                `Patch webhook settings for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Upload the thank-you page media for a job.
     * @param jobId 
     * @param organizationId 
     * @param file 
     * @returns 
     */
    @Post('thank-you/media')
    @UseInterceptors(FileInterceptor('file'))
    async uploadThankYouMedia(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        try {
            return await this.settingsService.uploadThankYouMedia(
                jobId,
                organizationId,
                file,
            );
        } catch (error) {
            this.logger.error(
                `Upload thank-you media for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Delete the thank-you page media for a job.
     * @param jobId 
     * @param organizationId 
     * @returns 
     */
    @Delete('thank-you/media')
    async deleteThankYouMedia(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.settingsService.deleteThankYouMedia(
                jobId,
                organizationId,
            );
        } catch (error) {
            this.logger.error(
                `Delete thank-you media for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Upload the social preview image for a job.
     * @param jobId 
     * @param organizationId 
     * @param file 
     * @returns 
     */
    @Post('general/social-preview-image')
    @UseInterceptors(FileInterceptor('file'))
    async uploadSocialPreviewImage(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        try {
            return await this.settingsService.uploadSocialPreviewImage(
                jobId,
                organizationId,
                file,
            );
        } catch (error) {
            this.logger.error(
                `Upload social preview for job ${jobId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
