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
export class CreateJobQuestions1779000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jobQuestions',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0 },
          { name: 'label', type: 'varchar', length: '500', isNullable: false },
          { name: 'type', type: 'varchar', length: '50', isNullable: false },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            default: `'STANDARD'`,
          },
          { name: 'required', type: 'boolean', default: false },
          { name: 'builtIn', type: 'boolean', default: false },
          { name: 'options', type: 'jsonb', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'jobQuestions',
      new TableIndex({
        name: 'IDX_job_questions_jobId_sortOrder',
        columnNames: ['jobId', 'sortOrder'],
      }),
    );

    await queryRunner.createForeignKey(
      'jobQuestions',
      new TableForeignKey({
        name: 'FK_job_questions_jobId',
        columnNames: ['jobId'],
        referencedTableName: 'jobs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'jobQuestions',
      'FK_job_questions_jobId',
    );
    await queryRunner.dropIndex(
      'jobQuestions',
      'IDX_job_questions_jobId_sortOrder',
    );
    await queryRunner.dropTable('jobQuestions');
  }
}
