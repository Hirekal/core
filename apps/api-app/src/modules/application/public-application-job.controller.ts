import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import { Public } from '../auth/common/decorators/public.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import { StartApplicationDto, TrackJobViewDto } from './dto/application.dto';
import { ApplicationService } from './application.service';

@Controller('public/jobs')
export class PublicApplicationJobController {
    private readonly logger = new Logger(PublicApplicationJobController.name);

    constructor(private readonly applicationService: ApplicationService) { }

    /**
     * Starts an application for a given job slug.
     * @param slug - The slug of the job.
     * @param dto - The data for the start.
     * @returns The started application.
     */
    @Public()
    @Post(':slug/applications/start')
    async start(
        @Param('slug') slug: string,
        @Body() dto: StartApplicationDto,
    ) {
        try {
            return await this.applicationService.startByJobSlug(slug, dto);
        } catch (error) {
            this.logger.error(
                `Start application for ${slug} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Records a page view for analytics (visitor count + unique viewers).
     * @param slug - The slug of the job.
     * @param dto - The data for the track view.
     * @returns The tracked view.
     */
    @Public()
    @Post(':slug/view')
    async trackView(
        @Param('slug') slug: string,
        @Body() dto: TrackJobViewDto,
    ) {
        try {
            return await this.applicationService.trackPageView(
                slug,
                dto.sessionId,
            );
        } catch (error) {
            this.logger.error(
                `Track view for ${slug} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
