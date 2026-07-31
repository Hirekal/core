import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateUserSessionsTable1753870500000 implements MigrationInterface {
  name = 'CreateUserSessionsTable1753870500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'userSessions',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'refreshTokenHash', type: 'varchar', length: '255' },
          { name: 'accessTokenHash', type: 'varchar', length: '255' },
          { name: 'accessTokenExpiresAt', type: 'timestamptz' },
          { name: 'refreshTokenExpiresAt', type: 'timestamptz' },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          { name: 'lastActivityAt', type: 'timestamptz', isNullable: true },
          { name: 'revokedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'userSessions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('userSessions', true);
  }
}
