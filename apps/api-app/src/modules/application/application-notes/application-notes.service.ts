import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../../auth/users/users.service';
import { ApplicationErrors } from '../constants/application-errors';
import { AddApplicationNoteDto } from '../dto/application.dto';
import { ApplicationRepository } from '../repositories/application.repository';
import { ApplicationNoteRepository } from './repositories/application-note.repository';

@Injectable()
export class ApplicationNotesService {
  private readonly logger = new Logger(ApplicationNotesService.name);

  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly noteRepository: ApplicationNoteRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Adds a note to a given application.
   * @param id - The ID of the application.
   * @param organizationId - The ID of the organization.
   * @param userId - The ID of the user.
   * @param dto - The data for the note.
   * @returns The added note.
   */
  async addNote(
    id: string,
    organizationId: string,
    userId: string,
    dto: AddApplicationNoteDto,
  ): Promise<Record<string, unknown>> {
    try {
      const application = await this.applicationRepository.findByIdForOrg(
        id,
        organizationId,
      );
      if (!application) {
        throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
      }

      const note = await this.noteRepository.create({
        applicationId: id,
        authorId: userId,
        text: dto.text.trim(),
      });

      const names = await this.usersService.findNamesByIds([userId]);
      const author = names.get(userId) || 'Team member';

      return {
        id: note.id,
        text: note.text,
        authorId: note.authorId,
        author,
        createdAt: note.createdAt,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`addNote failed id=${id}: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        ApplicationErrors.FAILED_TO_ADD_NOTE,
      );
    }
  }
}
