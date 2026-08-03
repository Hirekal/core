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
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { PresignUploadDto } from '../cloud-storage/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../cloud-storage/dto/confirm-upload.dto';
import { JobService } from './job.service';
import { toErrorMessage } from '../../common/utils/error.util';

@Controller('jobs')
export class JobController {
  private readonly logger = new Logger(JobController.name);

  constructor(private readonly jobService: JobService) {}

  /**
   * List jobs for the current organization.
   * @param organizationId
   * @param query
   * @returns
   */
  @Get()
  async findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ListJobsQueryDto,
  ) {
    try {
      return await this.jobService.findAll(organizationId, query);
    } catch (error) {
      this.logger.error(`List jobs failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Create a new job (seeds questions, fields, stages, settings).
   * @param organizationId
   * @param userId
   * @param dto
   * @returns
   */
  @Post()
  async create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateJobDto,
  ) {
    try {
      return await this.jobService.create(organizationId, userId, dto);
    } catch (error) {
      this.logger.error(`Create job failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Admin preview payload for a job.
   * @param id
   * @param organizationId
   * @returns
   */
  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.jobService.preview(id, organizationId);
    } catch (error) {
      this.logger.error(`Preview job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Presigned URL for direct browser upload of intro media to R2.
   */
  @Post(':id/media/intro/upload-url')
  presignIntroMediaUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: PresignUploadDto,
  ) {
    return this.jobService.presignIntroMediaUpload(id, organizationId, dto);
  }

  /**
   * Confirms intro media after the browser PUTs directly to R2.
   */
  @Post(':id/media/intro/confirm')
  confirmIntroMediaUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.jobService.confirmIntroMediaUpload(
      id,
      organizationId,
      userId,
      dto,
    );
  }

  /**
   * Remove intro media from R2 and clear job columns.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Delete(':id/media/intro')
  async deleteIntroMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.deleteIntroMedia(id, organizationId, userId);
    } catch (error) {
      this.logger.error(
        `Delete intro media for job ${id} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Duplicate a job with children and R2 media copy.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Post(':id/duplicate')
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.duplicate(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Duplicate job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Pause an active job.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Post(':id/pause')
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.pause(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Pause job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Resume a paused job.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Post(':id/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.resume(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Resume job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Archive an active or paused job.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Post(':id/archive')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.archive(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Archive job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Restore an archived job to active.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.restore(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Restore job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get a full job by id (org-scoped).
   * @param id
   * @param organizationId
   * @returns
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.jobService.findById(id, organizationId);
    } catch (error) {
      this.logger.error(`Get job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Update a job and optional nested questions/fields.
   * @param id
   * @param organizationId
   * @param userId
   * @param dto
   * @returns
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateJobDto,
  ) {
    try {
      return await this.jobService.update(id, organizationId, userId, dto);
    } catch (error) {
      this.logger.error(`Update job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Soft-delete an archived job (and best-effort R2 cleanup).
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    try {
      return await this.jobService.delete(id, organizationId, userId);
    } catch (error) {
      this.logger.error(`Delete job ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }
}
