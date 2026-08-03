import type { Application } from '../../entities/application.entity';
import type { JobQuestion } from '../../../job/job-questions/entities/job-question.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';

@Entity('applicationAnswers')
export class ApplicationAnswer {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    applicationId!: string;

    @Column({ type: 'uuid' })
    questionId!: string;

    @Column({ type: 'text', nullable: true })
    answerText!: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    mediaType!: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    mediaUrl!: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    mediaStorageKey!: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    mediaFileName!: string | null;

    @Column({ type: 'int', nullable: true })
    mediaDurationSeconds!: number | null;

    @Column({ type: 'int', default: 0 })
    retakeCount!: number;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    createdAt!: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updatedAt!: Date;

    @ManyToOne('Application', 'answers', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'applicationId' })
    application!: Relation<Application>;

    @ManyToOne('JobQuestion', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'questionId' })
    question!: Relation<JobQuestion>;
}
