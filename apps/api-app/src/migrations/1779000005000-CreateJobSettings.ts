import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

/**
 * ON DELETE CASCADE on jobId fires only on hard SQL DELETE (future purge).
 * API soft-delete on jobs does NOT trigger CASCADE — child rows remain.
 */
export class CreateJobSettings1779000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'job_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'general', type: 'jsonb', default: `'{}'` },
          { name: 'thankYouPage', type: 'jsonb', default: `'{}'` },
          { name: 'emailAutomation', type: 'jsonb', default: `'{}'` },
          { name: 'webhook', type: 'jsonb', default: `'{}'` },
          { name: 'createdAt', type: 'bigint', isNullable: false },
          { name: 'updatedAt', type: 'bigint', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'job_settings',
      new TableUnique({
        name: 'UQ_job_settings_jobId',
        columnNames: ['jobId'],
      }),
    );

    await queryRunner.createForeignKey(
      'job_settings',
      new TableForeignKey({
        name: 'FK_job_settings_jobId',
        columnNames: ['jobId'],
        referencedTableName: 'jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('job_settings', 'FK_job_settings_jobId');
    await queryRunner.dropUniqueConstraint('job_settings', 'UQ_job_settings_jobId');
    await queryRunner.dropTable('job_settings');
  }
}
