import type { Application } from '../../entities/application.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';

@Entity('applicationStageHistory')
export class ApplicationStageHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @Column({ type: 'uuid', nullable: true })
  fromStageId!: string | null;

  @Column({ type: 'uuid' })
  toStageId!: string;

  @Column({ type: 'uuid', nullable: true })
  changedById!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  changedAt!: Date;

  @ManyToOne('Application', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application!: Relation<Application>;
}
