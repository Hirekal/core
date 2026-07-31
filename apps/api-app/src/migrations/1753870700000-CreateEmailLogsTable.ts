import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateEmailLogsTable1753870700000 implements MigrationInterface {
  name = 'CreateEmailLogsTable1753870700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'emailLogs',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid', isNullable: true },
          { name: 'organizationId', type: 'uuid', isNullable: true },
          { name: 'email', type: 'varchar', length: '255' },
          { name: 'subject', type: 'varchar', length: '500' },
          {
            name: 'providerMessageId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'sentAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'emailLogs',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'emailLogs',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('emailLogs', true);
  }
}
