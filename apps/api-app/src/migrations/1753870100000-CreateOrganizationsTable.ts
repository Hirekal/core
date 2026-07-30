import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateOrganizationsTable1753870100000 implements MigrationInterface {
  name = 'CreateOrganizationsTable1753870100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'organizations',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'name', type: 'varchar', length: '255' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('organizations', true);
  }
}
