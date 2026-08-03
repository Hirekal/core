import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobModule } from '../job.module';
import { JobApplicationField } from './entities/job-application-field.entity';
import { JobApplicationFieldsController } from './job-application-fields.controller';
import { JobApplicationFieldsService } from './job-application-fields.service';
import { JobApplicationFieldRepository } from './repositories/job-application-field.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobApplicationField]),
    forwardRef(() => JobModule),
  ],
  controllers: [JobApplicationFieldsController],
  providers: [JobApplicationFieldsService, JobApplicationFieldRepository],
  exports: [JobApplicationFieldsService, JobApplicationFieldRepository],
})
export class JobApplicationFieldsModule {}
