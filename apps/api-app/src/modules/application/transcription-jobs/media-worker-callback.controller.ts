import { Body, Controller, Logger, Post } from '@nestjs/common';
import { Public } from '../../auth/common/decorators/public.decorator';
import { toErrorMessage } from '../../../common/utils/error.util';
import { MediaWorkerCallbackDto } from './dto/media-worker.dto';
import { TranscriptionJobsService } from './transcription-jobs.service';

@Controller()
export class MediaWorkerCallbackController {
    private readonly logger = new Logger(MediaWorkerCallbackController.name);

    constructor(
        private readonly transcriptionJobsService: TranscriptionJobsService,
    ) {}
    /**
     * Handles a media worker callback.
     * @param body - The body of the callback.
     * @returns The void.
     */
    @Public()
    @Post('media-worker-response')
    async mediaWorkerResponse(@Body() body: MediaWorkerCallbackDto) {
        try {
            return await this.transcriptionJobsService.handleWorkerCallback(body);
        } catch (error) {
            this.logger.error(
                `Media worker callback failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
