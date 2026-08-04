import {
  Body,
  Controller,
  Headers,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/common/decorators/public.decorator';
import { ConfirmUploadDto } from '../cloud-storage/dto/confirm-upload.dto';
import { PresignUploadDto } from '../cloud-storage/dto/presign-upload.dto';
import { toErrorMessage } from '../../common/utils/error.util';
import { APPLICATION_TOKEN_HEADER } from './enums/application.enums';
import { UpdateApplicationDto } from './dto/application.dto';
import { ApplicationService } from './application.service';

@Controller('public/applications')
export class PublicApplicationController {
  private readonly logger = new Logger(PublicApplicationController.name);

  constructor(private readonly applicationService: ApplicationService) {}

  /**
   * Updates a public application.
   * @param id - The ID of the application.
   * @param token - The token of the application.
   * @param dto - The data for the update.
   * @returns The updated application.
   */
  @Public()
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers(APPLICATION_TOKEN_HEADER) token: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    try {
      return await this.applicationService.updatePublic(id, token, dto);
    } catch (error) {
      this.logger.error(
        `Update application ${id} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Submits a public application.
   * @param id - The ID of the application.
   * @param token - The token of the application.
   * @returns The submitted application.
   */
  @Public()
  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers(APPLICATION_TOKEN_HEADER) token: string,
  ) {
    try {
      return await this.applicationService.submitPublic(id, token);
    } catch (error) {
      this.logger.error(
        `Submit application ${id} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Presigns a PDF upload URL for a FILE application field.
   * @param id - The ID of the application.
   * @param fieldId - The ID of the FILE application field.
   * @param token - The public session token.
   * @param dto - Upload metadata used for presigning.
   * @returns Presigned upload URL, storage key, and public URL.
   */
  @Public()
  @Post(':id/fields/:fieldId/file/upload-url')
  async presignFieldFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Headers(APPLICATION_TOKEN_HEADER) token: string,
    @Body() dto: PresignUploadDto,
  ) {
    try {
      return await this.applicationService.presignFieldFile(
        id,
        token,
        fieldId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `Presign field file ${id}/${fieldId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Confirms a PDF upload for a FILE application field.
   * @param id - The ID of the application.
   * @param fieldId - The ID of the FILE application field.
   * @param token - The public session token.
   * @param dto - Confirmed upload metadata.
   * @returns Stored field file metadata.
   */
  @Public()
  @Post(':id/fields/:fieldId/file/confirm')
  async confirmFieldFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Headers(APPLICATION_TOKEN_HEADER) token: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    try {
      return await this.applicationService.confirmFieldFile(
        id,
        token,
        fieldId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `Confirm field file ${id}/${fieldId} failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
