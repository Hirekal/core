import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { UserRole } from '../../users/user-roles/entities/user-role.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @ManyToOne(() => Organization, (organization) => organization.roles, {
    nullable: true,
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization | null;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];
}
