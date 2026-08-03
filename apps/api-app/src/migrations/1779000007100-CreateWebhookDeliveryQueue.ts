import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookDeliveryQueue1779000007100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhookDeliveryQueue',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'applicationId', type: 'uuid', isNullable: false },
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
          { name: 'fromStageId', type: 'uuid', isNullable: true },
          { name: 'toStageId', type: 'uuid', isNullable: true },
          {
            name: 'attemptCount',
            type: 'int',
            default: 0,
          },
          { name: 'lastError', type: 'text', isNullable: true },
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
      'webhookDeliveryQueue',
      new TableIndex({
        name: 'IDX_webhookDeliveryQueue_status_createdAt',
        columnNames: ['status', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'webhookDeliveryQueue',
      new TableIndex({
        name: 'IDX_webhookDeliveryQueue_application_event',
        columnNames: ['applicationId', 'jobId', 'event', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'webhookDeliveryQueue',
      'IDX_webhookDeliveryQueue_application_event',
    );
    await queryRunner.dropIndex(
      'webhookDeliveryQueue',
      'IDX_webhookDeliveryQueue_status_createdAt',
    );
    await queryRunner.dropTable('webhookDeliveryQueue');
  }
}
