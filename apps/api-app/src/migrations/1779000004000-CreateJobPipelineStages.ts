import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

/**
 * ON DELETE CASCADE on jobId fires only on hard SQL DELETE (future purge).
 * API soft-delete on jobs does NOT trigger CASCADE — child rows remain.
 */
export class CreateJobPipelineStages1779000004000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jobPipelineStages',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'slug', type: 'varchar', length: '50', isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0 },
          { name: 'active', type: 'boolean', default: true },
          { name: 'isDefault', type: 'boolean', default: false },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'jobPipelineStages',
      new TableUnique({
        name: 'UQ_job_pipeline_stages_jobId_slug',
        columnNames: ['jobId', 'slug'],
      }),
    );

    await queryRunner.createIndex(
      'jobPipelineStages',
      new TableIndex({
        name: 'IDX_job_pipeline_stages_jobId_sortOrder',
        columnNames: ['jobId', 'sortOrder'],
      }),
    );

    await queryRunner.createForeignKey(
      'jobPipelineStages',
      new TableForeignKey({
        name: 'FK_job_pipeline_stages_jobId',
        columnNames: ['jobId'],
        referencedTableName: 'jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'jobPipelineStages',
      'FK_job_pipeline_stages_jobId',
    );
    await queryRunner.dropIndex(
      'jobPipelineStages',
      'IDX_job_pipeline_stages_jobId_sortOrder',
    );
    await queryRunner.dropUniqueConstraint(
      'jobPipelineStages',
      'UQ_job_pipeline_stages_jobId_slug',
    );
    await queryRunner.dropTable('jobPipelineStages');
  }
}
