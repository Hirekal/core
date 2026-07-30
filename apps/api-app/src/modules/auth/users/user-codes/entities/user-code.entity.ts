import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserCodeType } from '../../../common/constants/auth.constants';
import { User } from '../../entities/user.entity';

@Entity('userCodes')
export class UserCode extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  type: UserCodeType;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @ManyToOne(() => User, (user) => user.codes)
  @JoinColumn({ name: 'userId' })
  user: User;
}
