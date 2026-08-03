import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookDeliveryLogs1779000006500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhookDeliveryLogs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'applicationId', type: 'uuid', isNullable: true },
          {
            name: 'event',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: `'PENDING'`,
          },
          {
            name: 'requestUrl',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          { name: 'responseStatus', type: 'int', isNullable: true },
          { name: 'responseBody', type: 'text', isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'webhookDeliveryLogs',
      new TableIndex({
        name: 'IDX_webhookDeliveryLogs_jobId',
        columnNames: ['jobId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'webhookDeliveryLogs',
      'IDX_webhookDeliveryLogs_jobId',
    );
    await queryRunner.dropTable('webhookDeliveryLogs');
  }
}
