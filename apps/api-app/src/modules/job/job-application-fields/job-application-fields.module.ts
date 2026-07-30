import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextGuard } from '../../../common/request-context/request-context.guard';
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
    providers: [
        JobApplicationFieldsService,
        JobApplicationFieldRepository,
        RequestContextGuard,
    ],
    exports: [JobApplicationFieldsService, JobApplicationFieldRepository],
})
export class JobApplicationFieldsModule { }
