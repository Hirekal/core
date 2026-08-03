import { Body, Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './modules/auth/common/decorators/public.decorator';

@Controller()
export class AppController {
  /**
   * Creates the root app controller.
   *
   * @param appService - Application-level helpers
   */
  constructor(private readonly appService: AppService) {}

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
}
