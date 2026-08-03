import type { Application } from '../../entities/application.entity';
import type { JobApplicationField } from '../../../job/job-application-fields/entities/job-application-field.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';

@Entity('applicationFieldValues')
export class ApplicationFieldValue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @Column({ type: 'uuid' })
  applicationFieldId!: string;

  @Column({ type: 'text', nullable: true })
  value!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @ManyToOne('Application', 'fieldValues', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Relation<Application>;

  @ManyToOne('JobApplicationField', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationFieldId' })
  applicationField!: Relation<JobApplicationField>;
}
