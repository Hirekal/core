import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudStorageModule } from '../../cloud-storage/cloud-storage.module';
import { ApplicationModule } from '../application.module';
import { ApplicationAnswer } from './entities/application-answer.entity';
import { ApplicationAnswersController } from './application-answers.controller';
import { ApplicationAnswersService } from './application-answers.service';
import { ApplicationAnswerRepository } from './repositories/application-answer.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([ApplicationAnswer]),
        CloudStorageModule,
        forwardRef(() => ApplicationModule),
    ],
    controllers: [ApplicationAnswersController],
    providers: [ApplicationAnswersService, ApplicationAnswerRepository],
    exports: [ApplicationAnswersService, ApplicationAnswerRepository],
})
export class ApplicationAnswersModule {}
