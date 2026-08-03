import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationRepository {
    constructor(
        @InjectRepository(Notification)
        private readonly repository: Repository<Notification>,
    ) { }

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
     * Finds notifications for a user.
     * @param userId - The ID of the user.
     * @param organizationId - The ID of the organization.
     * @returns The notifications for the user.
     */
    async findForUser(
        userId: string,
        organizationId: string,
    ): Promise<Notification[]> {
        return this.repository.find({
            where: { userId, organizationId },
            order: { createdAt: 'DESC' },
            take: 100,
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
    async markAllRead(
        userId: string,
        organizationId: string,
    ): Promise<void> {
        await this.repository.update(
            { userId, organizationId, read: false },
            { read: true, updatedAt: new Date() },
        );
    }
}
