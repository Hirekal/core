import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ApplicationModule } from '../application/application.module';
import { CronService } from './cron.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    forwardRef(() => ApplicationModule),
  ],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
