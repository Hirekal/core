import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudStorageModule } from '../../cloud-storage/cloud-storage.module';
import { ApplicationAnswersModule } from '../application-answers/application-answers.module';
import { TranscriptionJob } from './entities/transcription-job.entity';
import { MediaWorkerCallbackController } from './media-worker-callback.controller';
import { TranscriptionJobRepository } from './repositories/transcription-job.repository';
import { TranscriptionJobsService } from './transcription-jobs.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([TranscriptionJob]),
        CloudStorageModule,
        ApplicationAnswersModule,
    ],
    controllers: [MediaWorkerCallbackController],
    providers: [TranscriptionJobsService, TranscriptionJobRepository],
    exports: [TranscriptionJobsService, TranscriptionJobRepository],
})
export class TranscriptionJobsModule { }
