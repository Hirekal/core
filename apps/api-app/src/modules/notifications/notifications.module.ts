import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../auth/users/users.module';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRepository } from './repositories/notification.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification]),
        UsersModule,
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, NotificationRepository],
    exports: [NotificationsService],
})
export class NotificationsModule { }
