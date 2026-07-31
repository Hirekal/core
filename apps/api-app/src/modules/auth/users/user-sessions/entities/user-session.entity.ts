import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../../common/entities/base.entity';
import { User } from '../../entities/user.entity';

@Entity('userSessions')
export class UserSession extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  refreshTokenHash: string;

  @Column({ type: 'varchar', length: 255 })
  accessTokenHash: string;

  @Column({ type: 'timestamptz' })
  accessTokenExpiresAt: Date;

  @Column({ type: 'timestamptz' })
  refreshTokenExpiresAt: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastActivityAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @ManyToOne(() => User, (user) => user.sessions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
