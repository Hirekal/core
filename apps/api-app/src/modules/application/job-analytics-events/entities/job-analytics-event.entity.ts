import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { JobAnalyticsEventType } from '../../enums/application.enums';

@Entity('jobAnalyticsEvents')
export class JobAnalyticsEvent {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    jobId!: string;

    @Column({ type: 'varchar', length: 50 })
    eventType!: JobAnalyticsEventType;

    @Column({ type: 'varchar', length: 100, nullable: true })
    sessionId!: string | null;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    createdAt!: Date;
}
