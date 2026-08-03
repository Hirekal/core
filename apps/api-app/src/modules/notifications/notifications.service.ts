import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../auth/users/users.service';
import { NotificationType } from './enums/notification.enums';
import {
  NotificationErrors,
  NotifyNewApplicationParams,
  NotifyStageChangeParams,
} from './constants/notification.constants';
import { toNotificationResponse } from './notification.mapper';
import { NotificationRepository } from './repositories/notification.repository';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Lists notifications for a user.
   * @param userId - The ID of the user.
   * @param organizationId - The ID of the organization.
   * @returns The notifications for the user.
   */
  async listForUser(
    userId: string,
    organizationId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      const items = await this.notificationRepository.findForUser(
        userId,
        organizationId,
      );
      return items.map(toNotificationResponse);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `listForUser failed userId=${userId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(NotificationErrors.FAILED_TO_LIST);
    }
  }

  /**
   * Marks a notification as read.
   * @param id - The ID of the notification.
   * @param userId - The ID of the user.
   * @param organizationId - The ID of the organization.
   * @returns The notification.
   */
  async markRead(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const updated = await this.notificationRepository.markRead(
        id,
        userId,
        organizationId,
      );
      if (!updated) {
        throw new NotFoundException(NotificationErrors.NOT_FOUND(id));
      }
      return toNotificationResponse(updated);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `markRead failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        NotificationErrors.FAILED_TO_MARK_READ,
      );
    }
  }

  /**
   * Marks all notifications as read.
   * @param userId - The ID of the user.
   * @param organizationId - The ID of the organization.
   * @returns The notifications for the user.
   */
  async markAllRead(
    userId: string,
    organizationId: string,
  ): Promise<Record<string, unknown>[]> {
    try {
      await this.notificationRepository.markAllRead(userId, organizationId);
      return this.listForUser(userId, organizationId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `markAllRead failed userId=${userId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        NotificationErrors.FAILED_TO_MARK_ALL_READ,
      );
    }
  }

  /**
   * Notifies a user that a candidate has submitted an application.
   * @param params - The parameters for the notification.
   * @returns The void.
   */
  notifyNewApplication(params: NotifyNewApplicationParams): void {
    void this.dispatch({
      ...params,
      type: NotificationType.APPLICATION,
      title: 'New application received',
      message: `${params.candidateName} submitted an application for ${params.jobTitle}.`,
    }).catch((error) => {
      this.logger.error(
        `notifyNewApplication failed applicationId=${params.applicationId}: ${(error as Error).message}`,
      );
    });
  }

  /**
   * Notifies a user that a candidate has moved to another stage.
   * @param params - The parameters for the notification.
   * @returns The void.
   */
  notifyStageChange(params: NotifyStageChangeParams): void {
    void this.dispatch({
      organizationId: params.organizationId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      type: NotificationType.STAGE,
      title: 'Stage change',
      message: `${params.candidateName} moved from ${params.fromStageName} to ${params.toStageName} for ${params.jobTitle}.`,
    }).catch((error) => {
      this.logger.error(
        `notifyStageChange failed applicationId=${params.applicationId}: ${(error as Error).message}`,
      );
    });
  }

  /**
   * Dispatches a notification to a user.
   * @param params - The parameters for the notification.
   * @returns The void.
   */
  private async dispatch(params: {
    organizationId: string;
    jobId: string;
    applicationId: string;
    type: NotificationType;
    title: string;
    message: string;
  }): Promise<void> {
    const users = await this.usersService.findAll(params.organizationId);
    if (!users.length) {
      return;
    }

    const timestamp = new Date();
    await this.notificationRepository.createMany(
      users.map((user) => ({
        userId: user.id,
        organizationId: params.organizationId,
        type: params.type,
        title: params.title,
        message: params.message,
        jobId: params.jobId,
        applicationId: params.applicationId,
        read: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
  }
}
