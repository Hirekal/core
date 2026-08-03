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
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../../common/utils/error.util';
import {
  CreateJobPipelineStageDto,
  ReorderPipelineStagesDto,
  UpdateJobPipelineStageDto,
} from './dto/create-job-pipeline-stage.dto';
import { JobPipelineStagesService } from './job-pipeline-stages.service';

@Controller('jobs/:jobId/stages')
export class JobPipelineStagesController {
  private readonly logger = new Logger(JobPipelineStagesController.name);

  constructor(private readonly stagesService: JobPipelineStagesService) {}

  /**
   * List all pipeline stages for a job.
   * @param jobId
   * @param organizationId
   * @param active
   * @returns
   */
  @Get()
  async findAll(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Query('active') active?: string,
  ) {
    try {
      return await this.stagesService.findAll(
        jobId,
        organizationId,
        active === 'true',
      );
    } catch (error) {
      this.logger.error(
        `List stages for job ${jobId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Create a new pipeline stage for a job.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  @Post()
  async create(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateJobPipelineStageDto,
  ) {
    try {
      return await this.stagesService.create(jobId, organizationId, dto);
    } catch (error) {
      this.logger.error(
        `Create stage for job ${jobId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Reorder pipeline stages for a job.
   * @param jobId
   * @param organizationId
   * @param dto
   * @returns
   */
  @Patch('reorder')
  async reorder(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: ReorderPipelineStagesDto,
  ) {
    try {
      return await this.stagesService.reorder(jobId, organizationId, dto);
    } catch (error) {
      this.logger.error(
        `Reorder stages for job ${jobId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Update a pipeline stage for a job.
   * @param jobId
   * @param stageId
   * @param organizationId
   * @param dto
   * @returns
   */
  @Patch(':stageId')
  async update(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateJobPipelineStageDto,
  ) {
    try {
      return await this.stagesService.update(
        jobId,
        stageId,
        organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `Update stage ${stageId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
  /**
   * Delete a pipeline stage for a job.
   * @param jobId
   * @param stageId
   * @param organizationId
   * @returns
   */
  @Delete(':stageId')
  async delete(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.stagesService.delete(jobId, stageId, organizationId);
    } catch (error) {
      this.logger.error(
        `Delete stage ${stageId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
