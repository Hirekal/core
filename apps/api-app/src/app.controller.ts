import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/common/decorators/public.decorator';

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    /**
     * Creates the root app controller.
     *
     * @param appService - Application-level helpers
     */
    constructor(private readonly appService: AppService) { }

    /**
     * Liveness/health check endpoint (public, no JWT required).
     *
     * @returns Health status string
     */
    @Public()
    @Get()
    getHealth(): string {
        return this.appService.getHealth();
    }

    /**
     * To-do: Add a POST endpoint to handle the response of media-worker.
     * @param response - The response from media-worker
     * @returns The response from the endpoint
     */
    @Public()
    @Post('media-worker-response')
    mediaWorkerResponse(@Body() response: unknown): { success: true } {
        this.logger.log(`Media worker response: ${JSON.stringify(response)}`);
        return { success: true };
    }

}
