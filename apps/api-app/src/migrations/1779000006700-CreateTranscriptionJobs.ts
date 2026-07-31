import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
} from 'typeorm';

export class CreateTranscriptionJobs1779000006700
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'transcriptionJobs',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'gen_random_uuid()',
                    },
                    { name: 'applicationId', type: 'uuid', isNullable: false },
                    {
                        name: 'applicationAnswerId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    { name: 'jobId', type: 'uuid', isNullable: false },
                    { name: 'organizationId', type: 'uuid', isNullable: false },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '50',
                        default: `'PENDING'`,
                    },
                    {
                        name: 'videoStorageKey',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'language',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    { name: 'sentAt', type: 'timestamptz', isNullable: true },
                    {
                        name: 'completedAt',
                        type: 'timestamptz',
                        isNullable: true,
                    },
                    { name: 'transcriptText', type: 'text', isNullable: true },
                    {
                        name: 'transcriptLanguage',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'transcriptDuration',
                        type: 'float',
                        isNullable: true,
                    },
                    { name: 'transcriptSegments', type: 'jsonb', isNullable: true },
                    { name: 'callbackPayload', type: 'jsonb', isNullable: true },
                    { name: 'errorMessage', type: 'text', isNullable: true },
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

        await queryRunner.createIndex(
            'transcriptionJobs',
            new TableIndex({
                name: 'IDX_transcriptionJobs_applicationId',
                columnNames: ['applicationId'],
            }),
        );

        await queryRunner.createIndex(
            'transcriptionJobs',
            new TableIndex({
                name: 'IDX_transcriptionJobs_applicationAnswerId',
                columnNames: ['applicationAnswerId'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(
            'transcriptionJobs',
            'IDX_transcriptionJobs_applicationAnswerId',
        );
        await queryRunner.dropIndex(
            'transcriptionJobs',
            'IDX_transcriptionJobs_applicationId',
        );
        await queryRunner.dropTable('transcriptionJobs');
    }
}
