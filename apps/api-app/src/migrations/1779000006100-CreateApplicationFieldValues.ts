import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateApplicationFieldValues1779000006100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'applicationFieldValues',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'applicationId', type: 'uuid', isNullable: false },
          { name: 'applicationFieldId', type: 'uuid', isNullable: false },
          { name: 'value', type: 'text', isNullable: true },
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

    await queryRunner.createUniqueConstraint(
      'applicationFieldValues',
      new TableUnique({
        name: 'UQ_applicationFieldValues_application_field',
        columnNames: ['applicationId', 'applicationFieldId'],
      }),
    );

    await queryRunner.createIndex(
      'applicationFieldValues',
      new TableIndex({
        name: 'IDX_applicationFieldValues_applicationId',
        columnNames: ['applicationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'applicationFieldValues',
      'IDX_applicationFieldValues_applicationId',
    );
    await queryRunner.dropUniqueConstraint(
      'applicationFieldValues',
      'UQ_applicationFieldValues_application_field',
    );
    await queryRunner.dropTable('applicationFieldValues');
  }
}
