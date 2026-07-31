import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudStorageModule } from '../cloud-storage/cloud-storage.module';
import { JobModule } from '../job/job.module';
import { ApplicationController } from './application.controller';
import { JobApplicationsController } from './job-applications.controller';
import { PublicApplicationController } from './public-application.controller';
import { PublicApplicationJobController } from './public-application-job.controller';
import { ApplicationPublicAccessService } from './application-public-access.service';
import { ApplicationService } from './application.service';
import { ApplicationAnswersModule } from './application-answers/application-answers.module';
import { ApplicationAnswer } from './application-answers/entities/application-answer.entity';
import { ApplicationFieldValue } from './application-field-values/entities/application-field-value.entity';
import { ApplicationFieldValueRepository } from './application-field-values/repositories/application-field-value.repository';
import { ApplicationNotesModule } from './application-notes/application-notes.module';
import { ApplicationNote } from './application-notes/entities/application-note.entity';
import { ApplicationStageHistory } from './application-stage-history/entities/application-stage-history.entity';
import { ApplicationStageHistoryRepository } from './application-stage-history/repositories/application-stage-history.repository';
import { Application } from './entities/application.entity';
import { JobAnalyticsEvent } from './job-analytics-events/entities/job-analytics-event.entity';
import { JobAnalyticsEventRepository } from './job-analytics-events/repositories/job-analytics-event.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { WebhookDeliveryLog } from './webhook-delivery-logs/entities/webhook-delivery-log.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Application,
            ApplicationFieldValue,
            ApplicationAnswer,
            ApplicationNote,
            ApplicationStageHistory,
            JobAnalyticsEvent,
            WebhookDeliveryLog,
        ]),
        CloudStorageModule,
        JobModule,
        forwardRef(() => ApplicationAnswersModule),
        forwardRef(() => ApplicationNotesModule),
    ],
    controllers: [
        PublicApplicationJobController,
        PublicApplicationController,
        JobApplicationsController,
        ApplicationController,
    ],
    providers: [
        ApplicationService,
        ApplicationPublicAccessService,
        ApplicationRepository,
        ApplicationFieldValueRepository,
        ApplicationStageHistoryRepository,
        JobAnalyticsEventRepository,
    ],
    exports: [
        ApplicationService,
        ApplicationRepository,
        ApplicationPublicAccessService,
    ],
})
export class ApplicationModule {}
