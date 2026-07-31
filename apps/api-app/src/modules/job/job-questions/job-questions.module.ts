import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobModule } from '../job.module';
import { JobQuestion } from './entities/job-question.entity';
import { JobQuestionsController } from './job-questions.controller';
import { JobQuestionsService } from './job-questions.service';
import { JobQuestionRepository } from './repositories/job-question.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([JobQuestion]),
        forwardRef(() => JobModule),
    ],
    controllers: [JobQuestionsController],
    providers: [JobQuestionsService, JobQuestionRepository],
    exports: [JobQuestionsService, JobQuestionRepository],
})
export class JobQuestionsModule { }
