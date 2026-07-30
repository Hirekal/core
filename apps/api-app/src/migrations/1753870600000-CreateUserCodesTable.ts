import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateUserCodesTable1753870600000 implements MigrationInterface {
  name = 'CreateUserCodesTable1753870600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'userCodes',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'code', type: 'varchar', length: '255' },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'expiresAt', type: 'timestamptz' },
          { name: 'verifiedAt', type: 'timestamptz', isNullable: true },
          { name: 'attempts', type: 'int', default: 0 },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'userCodes',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('userCodes', true);
  }
}
