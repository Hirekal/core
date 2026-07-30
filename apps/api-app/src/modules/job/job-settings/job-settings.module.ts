import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestContextGuard } from '../../../common/request-context/request-context.guard';
import { JobModule } from '../job.module';
import { JobSettings } from './entities/job-settings.entity';
import { JobSettingsController } from './job-settings.controller';
import { JobSettingsService } from './job-settings.service';
import { JobSettingsRepository } from './repositories/job-settings.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([JobSettings]),
        forwardRef(() => JobModule),
    ],
    controllers: [JobSettingsController],
    providers: [JobSettingsService, JobSettingsRepository, RequestContextGuard],
    exports: [JobSettingsService, JobSettingsRepository],
})
export class JobSettingsModule { }
