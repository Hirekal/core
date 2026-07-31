import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { EmailLogStatus } from '../../common/constants/auth.constants';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('emailLogs')
export class EmailLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  declare status: EmailLogStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @ManyToOne(() => User, (user) => user.emailLogs, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization | null;
}
