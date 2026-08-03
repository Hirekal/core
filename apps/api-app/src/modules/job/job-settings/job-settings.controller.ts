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
import { PresignUploadDto } from '../../cloud-storage/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../../cloud-storage/dto/confirm-upload.dto';
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
     * Recent webhook delivery attempts for a job.
     * @param jobId - The ID of the job.
     * @param organizationId - The ID of the organization.
     * @returns The webhook delivery logs.
     */
    @Get('webhook-logs')
    async getWebhookLogs(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.settingsService.getWebhookLogs(jobId, organizationId);
        } catch (error) {
            this.logger.error(
                `Get webhook logs for job ${jobId} failed: ${toErrorMessage(error)}`,
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

    /** Presigned URL for direct browser upload of thank-you page media. */
    @Post('thank-you/media/upload-url')
    presignThankYouMediaUpload(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PresignUploadDto,
    ) {
        return this.settingsService.presignThankYouMediaUpload(
            jobId,
            organizationId,
            dto,
        );
    }

    /** Confirms thank-you media after direct R2 upload. */
    @Post('thank-you/media/confirm')
    confirmThankYouMediaUpload(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: ConfirmUploadDto,
    ) {
        return this.settingsService.confirmThankYouMediaUpload(
            jobId,
            organizationId,
            dto,
        );
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

    /** Presigned URL for direct browser upload of social preview image. */
    @Post('general/social-preview-image/upload-url')
    presignSocialPreviewUpload(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: PresignUploadDto,
    ) {
        return this.settingsService.presignSocialPreviewUpload(
            jobId,
            organizationId,
            dto,
        );
    }

    /** Confirms social preview image after direct R2 upload. */
    @Post('general/social-preview-image/confirm')
    confirmSocialPreviewUpload(
        @Param('jobId', ParseUUIDPipe) jobId: string,
        @CurrentUser('organizationId') organizationId: string,
        @Body() dto: ConfirmUploadDto,
    ) {
        return this.settingsService.confirmSocialPreviewUpload(
            jobId,
            organizationId,
            dto,
        );
    }
}
