import { MigrationInterface, QueryRunner } from 'typeorm';
import { SYSTEM_ROLES } from '../modules/auth/common/constants/auth.constants';
import { ROLE_DESCRIPTIONS } from '../modules/auth/common/constants/messages';

export class SeedSystemRoles1753870800000 implements MigrationInterface {
  name = 'SeedSystemRoles1753870800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles = [
      {
        name: SYSTEM_ROLES.ADMIN,
        description: ROLE_DESCRIPTIONS.ADMIN,
      },
      {
        name: SYSTEM_ROLES.RECRUITER,
        description: ROLE_DESCRIPTIONS.RECRUITER,
      },
    ];

    for (const role of roles) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('roles')
        .values({
          name: role.name,
          description: role.description,
          isSystem: true,
          organizationId: null,
          status: 'ACTIVE',
          metadata: {},
        })
        .orIgnore()
        .execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from('roles')
      .where('name IN (:...names)', {
        names: [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.RECRUITER],
      })
      .andWhere('organizationId IS NULL')
      .execute();
  }
}
