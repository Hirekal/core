import { BaseEntity } from '../../../common/entities/base.entity';
import type { Job } from '../../job/entities/job.entity';
import type { JobPipelineStage } from '../../job/job-pipeline-stages/entities/job-pipeline-stage.entity';
import { ApplicationStatus } from '../enums/application.enums';
import type { ApplicationAnswer } from '../application-answers/entities/application-answer.entity';
import type { ApplicationFieldValue } from '../application-field-values/entities/application-field-value.entity';
import type { ApplicationNote } from '../application-notes/entities/application-note.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';

@Entity('applications')
export class Application extends BaseEntity {
  @Column({ type: 'uuid' })
  jobId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid', nullable: true })
  stageId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'int', nullable: true })
  rating!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sessionTokenHash!: string | null;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  lastActivityAt!: Date;

  declare status: ApplicationStatus;

  @ManyToOne('Job', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: Relation<Job>;

  @ManyToOne('JobPipelineStage', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stageId' })
  stage!: Relation<JobPipelineStage | null>;

  @OneToMany('ApplicationFieldValue', 'application')
  fieldValues!: Relation<ApplicationFieldValue[]>;

  @OneToMany('ApplicationAnswer', 'application')
  answers!: Relation<ApplicationAnswer[]>;

  @OneToMany('ApplicationNote', 'application')
  notes!: Relation<ApplicationNote[]>;
}
