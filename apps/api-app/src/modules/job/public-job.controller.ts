import { Controller, Get, Logger, Param } from '@nestjs/common';
import { Public } from '../auth/common/decorators/public.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import { JobService } from './job.service';

@Controller('public/jobs')
export class PublicJobController {
  private readonly logger = new Logger(PublicJobController.name);

  constructor(private readonly jobService: JobService) {}

  /**
   * Get public job by slug.
   * @param slug
   * @returns
   */
  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    try {
      return await this.jobService.findPublicBySlug(slug);
    } catch (error) {
      this.logger.error(
        `Get public job ${slug} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
