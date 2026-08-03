import {
    Controller,
    Get,
    Logger,
    Param,
    ParseUUIDPipe,
    Patch,
} from '@nestjs/common';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { toErrorMessage } from '../../common/utils/error.util';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
    private readonly logger = new Logger(NotificationsController.name);

    constructor(private readonly notificationsService: NotificationsService) { }

    /**
     * Lists notifications for a user.
     * @param userId - The ID of the user.
     * @param organizationId - The ID of the organization.
     * @returns The notifications for the user.
     */
    @Get()
    async list(
        @CurrentUser('id') userId: string,
        @CurrentUser('organizationId') organizationId: string,
    ) {
        try {
            return await this.notificationsService.listForUser(
                userId,
                organizationId,
            );
        } catch (error) {
            this.logger.error(
                `List notifications failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Marks all notifications as read.
     * @param userId - The ID of the user.
     * @param organizationId - The ID of the organization.
     * @returns The void.
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
     * @param id - The ID of the notification.
     * @param userId - The ID of the user.
     * @param organizationId - The ID of the organization.
     * @returns The notification.
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
