import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import {
  NOTIFICATIONS_DEFAULT_LIMIT,
} from '../dto/list-notifications-query.dto';

export type NotificationListQuery = {
  page?: number;
  limit?: number;
};

export type NotificationListResult = {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  /**
   * Creates multiple notifications.
   * @param rows - The notifications to create.
   * @returns The created notifications.
   */
  async createMany(rows: DeepPartial<Notification>[]): Promise<Notification[]> {
    if (!rows.length) {
      return [];
    }
    const entities = this.repository.create(rows);
    return this.repository.save(entities);
  }

  /**
   * Finds paginated notifications for a user (newest first).
   */
  async findForUser(
    userId: string,
    organizationId: string,
    query: NotificationListQuery = {},
  ): Promise<NotificationListResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(
      1,
      query.limit ?? NOTIFICATIONS_DEFAULT_LIMIT,
    );
    const skip = (page - 1) * limit;

    const [items, total] = await this.repository.findAndCount({
      where: { userId, organizationId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /**
   * Counts unread notifications for a user.
   */
  async countUnread(userId: string, organizationId: string): Promise<number> {
    return this.repository.count({
      where: { userId, organizationId, read: false },
    });
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
  ): Promise<Notification | null> {
    const row = await this.repository.findOne({
      where: { id, userId, organizationId },
    });
    if (!row || row.read) {
      return row;
    }

    row.read = true;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }

  /**
   * Marks all notifications as read.
   * @param userId - The ID of the user.
   * @param organizationId - The ID of the organization.
   * @returns The void.
   */
  async markAllRead(userId: string, organizationId: string): Promise<void> {
    await this.repository.update(
      { userId, organizationId, read: false },
      { read: true, updatedAt: new Date() },
    );
  }
}
