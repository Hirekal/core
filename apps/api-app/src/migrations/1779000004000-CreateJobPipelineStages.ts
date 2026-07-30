import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

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
        name: 'job_pipeline_stages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'slug', type: 'varchar', length: '50', isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0 },
          { name: 'active', type: 'boolean', default: true },
          { name: 'isDefault', type: 'boolean', default: false },
          { name: 'createdAt', type: 'bigint', isNullable: false },
          { name: 'updatedAt', type: 'bigint', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'job_pipeline_stages',
      new TableUnique({
        name: 'UQ_job_pipeline_stages_jobId_slug',
        columnNames: ['jobId', 'slug'],
      }),
    );

    await queryRunner.createIndex(
      'job_pipeline_stages',
      new TableIndex({
        name: 'IDX_job_pipeline_stages_jobId_sortOrder',
        columnNames: ['jobId', 'sortOrder'],
      }),
    );

    await queryRunner.createForeignKey(
      'job_pipeline_stages',
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
      'job_pipeline_stages',
      'FK_job_pipeline_stages_jobId',
    );
    await queryRunner.dropIndex(
      'job_pipeline_stages',
      'IDX_job_pipeline_stages_jobId_sortOrder',
    );
    await queryRunner.dropUniqueConstraint(
      'job_pipeline_stages',
      'UQ_job_pipeline_stages_jobId_slug',
    );
    await queryRunner.dropTable('job_pipeline_stages');
  }
}
