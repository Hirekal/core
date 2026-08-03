import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobModule } from '../job.module';
import { WebhookDeliveryLog } from '../../application/webhook-delivery-logs/entities/webhook-delivery-log.entity';
import { JobSettings } from './entities/job-settings.entity';
import { JobSettingsController } from './job-settings.controller';
import { JobSettingsService } from './job-settings.service';
import { JobSettingsRepository } from './repositories/job-settings.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([JobSettings, WebhookDeliveryLog]),
        forwardRef(() => JobModule),
    ],
    controllers: [JobSettingsController],
    providers: [JobSettingsService, JobSettingsRepository],
    exports: [JobSettingsService, JobSettingsRepository],
})
export class JobSettingsModule { }
