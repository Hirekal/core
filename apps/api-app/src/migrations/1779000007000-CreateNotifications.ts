import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNotifications1779000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '50', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'message', type: 'text', isNullable: false },
          { name: 'jobId', type: 'uuid', isNullable: true },
          { name: 'applicationId', type: 'uuid', isNullable: true },
          {
            name: 'read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_userId_read',
        columnNames: ['userId', 'read'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_userId_read',
    );
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_userId_createdAt',
    );
    await queryRunner.dropTable('notifications');
  }
}
