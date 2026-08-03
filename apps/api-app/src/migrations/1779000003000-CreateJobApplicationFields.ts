import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

/**
 * ON DELETE CASCADE on jobId fires only on hard SQL DELETE (future purge).
 * API soft-delete on jobs does NOT trigger CASCADE — child rows remain.
 */
export class CreateJobApplicationFields1779000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jobApplicationFields',
        columns: [
          ...BASE_ENTITY_COLUMNS,
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
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'jobApplicationFields',
      new TableIndex({
        name: 'IDX_job_application_fields_jobId_sortOrder',
        columnNames: ['jobId', 'sortOrder'],
      }),
    );

    await queryRunner.createForeignKey(
      'jobApplicationFields',
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
      'jobApplicationFields',
      'FK_job_application_fields_jobId',
    );
    await queryRunner.dropIndex(
      'jobApplicationFields',
      'IDX_job_application_fields_jobId_sortOrder',
    );
    await queryRunner.dropTable('jobApplicationFields');
  }
}
