import { NotificationType } from '../enums/notification.enums';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'uuid' })
    organizationId!: string;

    @Column({ type: 'varchar', length: 50 })
    type!: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'text' })
    message!: string;

    @Column({ type: 'uuid', nullable: true })
    jobId!: string | null;

    @Column({ type: 'uuid', nullable: true })
    applicationId!: string | null;

    @Column({ type: 'boolean', default: false })
    read!: boolean;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    createdAt!: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updatedAt!: Date;
}
