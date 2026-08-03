import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

/**
 * ON DELETE CASCADE on jobId fires only on hard SQL DELETE (future purge).
 * API soft-delete on jobs does NOT trigger CASCADE — child rows remain.
 */
export class CreateJobSettings1779000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jobSettings',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'general', type: 'jsonb', default: `'{}'` },
          { name: 'thankYouPage', type: 'jsonb', default: `'{}'` },
          { name: 'emailAutomation', type: 'jsonb', default: `'{}'` },
          { name: 'webhook', type: 'jsonb', default: `'{}'` },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'jobSettings',
      new TableUnique({
        name: 'UQ_job_settings_jobId',
        columnNames: ['jobId'],
      }),
    );

    await queryRunner.createForeignKey(
      'jobSettings',
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
    await queryRunner.dropForeignKey('jobSettings', 'FK_job_settings_jobId');
    await queryRunner.dropUniqueConstraint(
      'jobSettings',
      'UQ_job_settings_jobId',
    );
    await queryRunner.dropTable('jobSettings');
  }
}
