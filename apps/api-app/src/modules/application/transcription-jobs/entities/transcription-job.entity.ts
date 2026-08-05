import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TranscriptionJobStatus } from '../../enums/application.enums';
import { CommunicationMetrics } from '../utils/communication-metrics.util';

export interface TranscriptSegmentRecord {
  start: number;
  end: number;
  text: string;
}

@Entity('transcriptionJobs')
export class TranscriptionJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  applicationId!: string;

  @Column({ type: 'uuid' })
  applicationAnswerId!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: TranscriptionJobStatus.PENDING,
  })
  status!: TranscriptionJobStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  videoStorageKey!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  transcriptText!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  transcriptLanguage!: string | null;

  @Column({ type: 'float', nullable: true })
  transcriptDuration!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  transcriptSegments!: TranscriptSegmentRecord[] | null;

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload!: Record<string, unknown> | null;

  /** Raw SpeechBrain metrics from the media worker (snake_case keys). */
  @Column({ type: 'jsonb', nullable: true })
  speechMetrics!: Record<string, unknown> | null;

  /** Raw pronunciation assessment from the media worker (snake_case keys). */
  @Column({ type: 'jsonb', nullable: true })
  assessment!: Record<string, unknown> | null;

  /** Derived recruiter metrics computed in the API (camelCase). */
  @Column({ type: 'jsonb', nullable: true })
  communicationMetrics!: CommunicationMetrics | null;

  /** Individual score columns for querying / reporting. */
  @Column({ type: 'float', nullable: true })
  communicationScore!: number | null;

  @Column({ type: 'float', nullable: true })
  speechClarity!: number | null;

  @Column({ type: 'float', nullable: true })
  speakingPaceWpm!: number | null;

  @Column({ type: 'float', nullable: true })
  fluencyScore!: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
