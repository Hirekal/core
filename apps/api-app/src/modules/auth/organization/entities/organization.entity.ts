import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base.entity';
import { OrganizationStatus } from '../../common/constants/auth.constants';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  declare status: OrganizationStatus;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Role, (role) => role.organization)
  roles: Role[];
}
