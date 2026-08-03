import {
  Body,
  Controller,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../../common/utils/error.util';
import { AddApplicationNoteDto } from '../dto/application.dto';
import { ApplicationNotesService } from './application-notes.service';

@Controller('applications')
export class ApplicationNotesController {
  private readonly logger = new Logger(ApplicationNotesController.name);

  constructor(
    private readonly applicationNotesService: ApplicationNotesService,
  ) {}

  /**
   * Adds a note to a given application.
   * @param id - The ID of the application.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @param dto - The data for the note.
   * @returns The added note.
   */
  @Post(':id/notes')
  async addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddApplicationNoteDto,
  ) {
    try {
      return await this.applicationNotesService.addNote(
        id,
        organizationId,
        userId,
        dto,
      );
    } catch (error) {
      this.logger.error(`Add note ${id} failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }
}
