import {
  EmploymentType,
  IntroMediaType,
  JobStatus,
  QuestionRetakes,
} from '../enums/job.enums';
import { BaseEntity } from '../../../common/entities/base.entity';
import type { JobApplicationField } from '../job-application-fields/entities/job-application-field.entity';
import type { JobPipelineStage } from '../job-pipeline-stages/entities/job-pipeline-stage.entity';
import type { JobQuestion } from '../job-questions/entities/job-question.entity';
import type { JobSettings } from '../job-settings/entities/job-settings.entity';
import { Column, Entity, OneToMany, OneToOne, Relation } from 'typeorm';

@Entity('jobs')
export class Job extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedById!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  internalTitle!: string | null;

  @Column({ type: 'varchar', length: 255 })
  company!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  companyWebsite!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: EmploymentType.FULL_TIME,
  })
  employmentType!: EmploymentType;

  declare status: JobStatus;

  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  candidateIntroTitle!: string | null;

  @Column({ type: 'text', nullable: true })
  candidateInstructions!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: 'Complete your application',
  })
  applicationSectionTitle!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: 'Start now',
  })
  applyButtonLabel!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  introMediaType!: IntroMediaType | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  introMediaUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  introMediaStorageKey!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  introMediaFileName!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: QuestionRetakes.UNLIMITED,
  })
  questionRetakes!: QuestionRetakes;

  @Column({ type: 'varchar', length: 50, default: 'english' })
  transcriptionLanguage!: string;

  @Column({ type: 'boolean', default: true })
  aiTranscripts!: boolean;

  @Column({ type: 'int', default: 0 })
  visitorCount!: number;

  @Column({ type: 'int', default: 0 })
  viewers!: number;

  @Column({ type: 'int', default: 0 })
  applicationsStarted!: number;

  @Column({ type: 'int', default: 0 })
  applicationsSubmitted!: number;

  @Column({ type: 'int', default: 0 })
  applicationCount!: number;

  @OneToMany('JobQuestion', 'job')
  questions!: Relation<JobQuestion[]>;

  @OneToMany('JobApplicationField', 'job')
  applicationFields!: Relation<JobApplicationField[]>;

  @OneToMany('JobPipelineStage', 'job')
  pipelineStages!: Relation<JobPipelineStage[]>;

  @OneToOne('JobSettings', 'job')
  settings!: Relation<JobSettings>;
}
