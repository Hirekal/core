import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateJobs1779000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.createTable(
      new Table({
        name: 'jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'organizationId', type: 'uuid', isNullable: false },
          { name: 'createdById', type: 'uuid', isNullable: true },
          { name: 'updatedById', type: 'uuid', isNullable: true },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'internalTitle',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'company', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'companyWebsite',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'employmentType',
            type: 'varchar',
            length: '50',
            default: `'FULL_TIME'`,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: `'ACTIVE'`,
          },
          { name: 'slug', type: 'varchar', length: '100', isNullable: false },
          {
            name: 'candidateIntroTitle',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'candidateInstructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'applicationSectionTitle',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: `'Complete your application'`,
          },
          {
            name: 'introMediaType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'introMediaUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'introMediaStorageKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'introMediaFileName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'questionRetakes',
            type: 'varchar',
            length: '50',
            default: `'UNLIMITED'`,
          },
          {
            name: 'transcriptionLanguage',
            type: 'varchar',
            length: '50',
            default: `'english'`,
          },
          { name: 'aiTranscripts', type: 'boolean', default: true },
          { name: 'visitorCount', type: 'int', default: 0 },
          { name: 'viewers', type: 'int', default: 0 },
          { name: 'applicationsStarted', type: 'int', default: 0 },
          { name: 'applicationsSubmitted', type: 'int', default: 0 },
          { name: 'applicationCount', type: 'int', default: 0 },
          { name: 'createdAt', type: 'bigint', isNullable: false },
          { name: 'updatedAt', type: 'bigint', isNullable: false },
          { name: 'deletedAt', type: 'bigint', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'jobs',
      new TableUnique({ name: 'UQ_jobs_slug', columnNames: ['slug'] }),
    );

    await queryRunner.createIndex(
      'jobs',
      new TableIndex({
        name: 'IDX_jobs_organizationId_status',
        columnNames: ['organizationId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'jobs',
      new TableIndex({
        name: 'IDX_jobs_organizationId_updatedAt',
        columnNames: ['organizationId', 'updatedAt'],
      }),
    );

    // organizationId / createdById / updatedById are plain UUIDs on this branch.
    // FK constraints to organizations/users will be added when merging the auth branch.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('jobs', 'IDX_jobs_organizationId_updatedAt');
    await queryRunner.dropIndex('jobs', 'IDX_jobs_organizationId_status');
    await queryRunner.dropUniqueConstraint('jobs', 'UQ_jobs_slug');
    await queryRunner.dropTable('jobs');
  }
}
