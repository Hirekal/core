import {
    QuestionCategory,
    QuestionType,
} from '../../enums/job.enums';
import { BaseEntity } from '../../../../common/entities/base.entity';
import type { Job } from '../../entities/job.entity';
import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';

@Entity('jobQuestions')
export class JobQuestion extends BaseEntity {
    @Column({ type: 'uuid' })
    jobId!: string;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'varchar', length: 500 })
    label!: string;

    @Column({ type: 'varchar', length: 50 })
    type!: QuestionType;

    @Column({
        type: 'varchar',
        length: 50,
        default: QuestionCategory.STANDARD,
    })
    category!: QuestionCategory;

    @Column({ type: 'boolean', default: false })
    required!: boolean;

    @Column({ type: 'boolean', default: false })
    builtIn!: boolean;

    @Column({ type: 'jsonb', nullable: true })
    options!: Record<string, unknown> | null;

    @ManyToOne('Job', 'questions', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'jobId' })
    job!: Relation<Job>;
}
