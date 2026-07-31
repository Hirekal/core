import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { UserStatus } from '../../common/constants/auth.constants';
import { Organization } from '../../organization/entities/organization.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { UserCode } from '../user-codes/entities/user-code.entity';
import { EmailLog } from '../../emails/entities/email-log.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  declare status: UserStatus;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => Organization, (organization) => organization.users)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];

  @OneToMany(() => UserCode, (code) => code.user)
  codes: UserCode[];

  @OneToMany(() => EmailLog, (emailLog) => emailLog.user)
  emailLogs: EmailLog[];
}
