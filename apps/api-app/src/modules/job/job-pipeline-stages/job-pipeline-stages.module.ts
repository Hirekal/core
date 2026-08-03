import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  providers: [JobPipelineStagesService, JobPipelineStageRepository],
  exports: [JobPipelineStagesService, JobPipelineStageRepository],
})
export class JobPipelineStagesModule {}
