import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateUsersTable1753870300000 implements MigrationInterface {
  name = 'CreateUsersTable1753870300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'organizationId', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255' },
          { name: 'password', type: 'varchar', length: '255' },
          { name: 'emailVerified', type: 'boolean', default: false },
          { name: 'lastLoginAt', type: 'timestamptz', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
        ],
        uniques: [new TableUnique({ columnNames: ['email'] })],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users', true);
  }
}
