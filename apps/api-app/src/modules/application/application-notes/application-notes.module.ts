import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../auth/users/users.module';
import { ApplicationModule } from '../application.module';
import { ApplicationNote } from './entities/application-note.entity';
import { ApplicationNotesController } from './application-notes.controller';
import { ApplicationNotesService } from './application-notes.service';
import { ApplicationNoteRepository } from './repositories/application-note.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationNote]),
    UsersModule,
    forwardRef(() => ApplicationModule),
  ],
  controllers: [ApplicationNotesController],
  providers: [ApplicationNotesService, ApplicationNoteRepository],
  exports: [ApplicationNotesService, ApplicationNoteRepository],
})
export class ApplicationNotesModule {}
