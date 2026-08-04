import {
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Lists notifications for the current user (paginated, default 25).
   */
  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    try {
      return await this.notificationsService.listForUser(
        userId,
        organizationId,
        query,
      );
    } catch (error) {
      this.logger.error(`List notifications failed: ${toErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Unread count for the navbar bell badge.
   */
  @Get('unread-count')
  async unreadCount(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.notificationsService.unreadCount(
        userId,
        organizationId,
      );
    } catch (error) {
      this.logger.error(
        `Unread notifications count failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Marks all notifications as read.
   */
  @Patch('read-all')
  async markAllRead(
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.notificationsService.markAllRead(
        userId,
        organizationId,
      );
    } catch (error) {
      this.logger.error(
        `Mark all notifications read failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Marks a notification as read.
   */
  @Patch(':id/read')
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    try {
      return await this.notificationsService.markRead(
        id,
        userId,
        organizationId,
      );
    } catch (error) {
      this.logger.error(
        `Mark notification ${id} read failed: ${toErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
