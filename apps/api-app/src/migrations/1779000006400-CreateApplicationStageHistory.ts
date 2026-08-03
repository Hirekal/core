import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateApplicationStageHistory1779000006400 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'applicationStageHistory',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'applicationId', type: 'uuid', isNullable: false },
          { name: 'fromStageId', type: 'uuid', isNullable: true },
          { name: 'toStageId', type: 'uuid', isNullable: false },
          { name: 'changedById', type: 'uuid', isNullable: true },
          {
            name: 'changedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'applicationStageHistory',
      new TableIndex({
        name: 'IDX_applicationStageHistory_applicationId',
        columnNames: ['applicationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'applicationStageHistory',
      'IDX_applicationStageHistory_applicationId',
    );
    await queryRunner.dropTable('applicationStageHistory');
  }
}
