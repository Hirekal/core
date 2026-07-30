import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextGuard } from '../../common/request-context/request-context.guard';
import { Job } from './entities/job.entity';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { PublicJobController } from './public-job.controller';
import { JobRepository } from './repositories/job.repository';
import { JobApplicationField } from './job-application-fields/entities/job-application-field.entity';
import { JobApplicationFieldRepository } from './job-application-fields/repositories/job-application-field.repository';
import { JobApplicationFieldsModule } from './job-application-fields/job-application-fields.module';
import { JobPipelineStage } from './job-pipeline-stages/entities/job-pipeline-stage.entity';
import { JobPipelineStageRepository } from './job-pipeline-stages/repositories/job-pipeline-stage.repository';
import { JobPipelineStagesModule } from './job-pipeline-stages/job-pipeline-stages.module';
import { JobQuestion } from './job-questions/entities/job-question.entity';
import { JobQuestionRepository } from './job-questions/repositories/job-question.repository';
import { JobQuestionsModule } from './job-questions/job-questions.module';
import { JobSettings } from './job-settings/entities/job-settings.entity';
import { JobSettingsRepository } from './job-settings/repositories/job-settings.repository';
import { JobSettingsModule } from './job-settings/job-settings.module';

/**
 * Job domain module — single entry imported by AppModule.
 * Owns core job APIs and nests questions, fields, stages, and settings.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            Job,
            JobQuestion,
            JobApplicationField,
            JobPipelineStage,
            JobSettings,
        ]),
        forwardRef(() => JobQuestionsModule),
        forwardRef(() => JobApplicationFieldsModule),
        forwardRef(() => JobPipelineStagesModule),
        forwardRef(() => JobSettingsModule),
    ],
    controllers: [JobController, PublicJobController],
    providers: [
        JobService,
        JobRepository,
        JobQuestionRepository,
        JobApplicationFieldRepository,
        JobPipelineStageRepository,
        JobSettingsRepository,
        RequestContextGuard,
    ],
    exports: [JobService, JobRepository],
})
export class JobModule { }
