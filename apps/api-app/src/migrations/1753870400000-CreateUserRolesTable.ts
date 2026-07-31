import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateUserRolesTable1753870400000 implements MigrationInterface {
  name = 'CreateUserRolesTable1753870400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'userRoles',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'roleId', type: 'uuid' },
          { name: 'assignedBy', type: 'uuid', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'userRoles',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'userRoles',
      new TableForeignKey({
        columnNames: ['roleId'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('userRoles', true);
  }
}
