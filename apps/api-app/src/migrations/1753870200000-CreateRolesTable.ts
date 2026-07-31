import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateRolesTable1753870200000 implements MigrationInterface {
  name = 'CreateRolesTable1753870200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'organizationId', type: 'uuid', isNullable: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'isSystem', type: 'boolean', default: false },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'roles',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('roles', true);
  }
}
