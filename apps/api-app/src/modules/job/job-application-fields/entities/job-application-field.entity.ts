import { ApplicationFieldType } from '../../enums/job.enums';
import { BaseEntity } from '../../../../common/entities/base.entity';
import type { Job } from '../../entities/job.entity';
import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';

@Entity('jobApplicationFields')
export class JobApplicationField extends BaseEntity {
  @Column({ type: 'uuid' })
  jobId!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: ApplicationFieldType;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @Column({ type: 'boolean', default: false })
  builtIn!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fieldKey!: string | null;

  @ManyToOne('Job', 'applicationFields', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: Relation<Job>;
}
