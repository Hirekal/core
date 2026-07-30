import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextGuard } from '../../../common/request-context/request-context.guard';
import { JobModule } from '../job.module';
import { JobPipelineStage } from './entities/job-pipeline-stage.entity';
import { JobPipelineStagesController } from './job-pipeline-stages.controller';
import { JobPipelineStagesService } from './job-pipeline-stages.service';
import { JobPipelineStageRepository } from './repositories/job-pipeline-stage.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([JobPipelineStage]),
        forwardRef(() => JobModule),
    ],
    controllers: [JobPipelineStagesController],
    providers: [
        JobPipelineStagesService,
        JobPipelineStageRepository,
        RequestContextGuard,
    ],
    exports: [JobPipelineStagesService, JobPipelineStageRepository],
})
export class JobPipelineStagesModule { }
