import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import {
  BASE_ENTITY_COLUMNS,
  STATUS_COLUMN,
} from './helpers/migration-columns';

const APPLICATION_STATUS_COLUMN = {
  ...STATUS_COLUMN,
  default: "'IN_PROGRESS'",
};

export class CreateApplications1779000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const baseColumns = BASE_ENTITY_COLUMNS.filter((c) => c.name !== 'status');

    await queryRunner.createTable(
      new Table({
        name: 'applications',
        columns: [
          ...baseColumns,
          APPLICATION_STATUS_COLUMN,
          { name: 'jobId', type: 'uuid', isNullable: false },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'stageId', type: 'uuid', isNullable: true },
          {
            name: 'firstName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'lastName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          { name: 'rating', type: 'int', isNullable: true },
          {
            name: 'sessionTokenHash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'submittedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'lastActivityAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'applications',
      new TableIndex({
        name: 'IDX_applications_jobId_status',
        columnNames: ['jobId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'applications',
      new TableIndex({
        name: 'IDX_applications_organizationId_submittedAt',
        columnNames: ['organizationId', 'submittedAt'],
      }),
    );

    await queryRunner.createIndex(
      'applications',
      new TableIndex({
        name: 'IDX_applications_jobId_stageId',
        columnNames: ['jobId', 'stageId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'applications',
      'IDX_applications_jobId_stageId',
    );
    await queryRunner.dropIndex(
      'applications',
      'IDX_applications_organizationId_submittedAt',
    );
    await queryRunner.dropIndex(
      'applications',
      'IDX_applications_jobId_status',
    );
    await queryRunner.dropTable('applications');
  }
}
