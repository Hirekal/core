import { BaseEntity } from '../../../../common/entities/base.entity';
import type { Job } from '../../entities/job.entity';
import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';

@Entity('job_pipeline_stages')
export class JobPipelineStage extends BaseEntity {
    @Column({ type: 'uuid' })
    jobId!: string;

    @Column({ type: 'varchar', length: 100 })
    name!: string;

    @Column({ type: 'varchar', length: 50 })
    slug!: string;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'boolean', default: true })
    active!: boolean;

    @Column({ type: 'boolean', default: false })
    isDefault!: boolean;

    @ManyToOne('Job', 'pipelineStages', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'jobId' })
    job!: Relation<Job>;
}
