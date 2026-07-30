import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * ON DELETE CASCADE on jobId fires only on hard SQL DELETE (future purge).
 * API soft-delete on jobs does NOT trigger CASCADE — child rows remain.
 */
export class CreateJobApplicationFields1779000003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'job_application_fields',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0 },
          { name: 'label', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          { name: 'required', type: 'boolean', default: false },
          { name: 'builtIn', type: 'boolean', default: false },
          {
            name: 'fieldKey',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          { name: 'createdAt', type: 'bigint', isNullable: false },
          { name: 'updatedAt', type: 'bigint', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'job_application_fields',
      new TableIndex({
        name: 'IDX_job_application_fields_jobId_sortOrder',
        columnNames: ['jobId', 'sortOrder'],
      }),
    );

    await queryRunner.createForeignKey(
      'job_application_fields',
      new TableForeignKey({
        name: 'FK_job_application_fields_jobId',
        columnNames: ['jobId'],
        referencedTableName: 'jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'job_application_fields',
      'FK_job_application_fields_jobId',
    );
    await queryRunner.dropIndex(
      'job_application_fields',
      'IDX_job_application_fields_jobId_sortOrder',
    );
    await queryRunner.dropTable('job_application_fields');
  }
}
