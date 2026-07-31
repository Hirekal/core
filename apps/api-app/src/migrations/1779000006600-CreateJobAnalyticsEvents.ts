import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
} from 'typeorm';

export class CreateJobAnalyticsEvents1779000006600
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'jobAnalyticsEvents',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'gen_random_uuid()',
                    },
                    { name: 'jobId', type: 'uuid', isNullable: false },
                    {
                        name: 'eventType',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'sessionId',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamptz',
                        default: 'now()',
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'jobAnalyticsEvents',
            new TableIndex({
                name: 'IDX_jobAnalyticsEvents_jobId_eventType',
                columnNames: ['jobId', 'eventType'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(
            'jobAnalyticsEvents',
            'IDX_jobAnalyticsEvents_jobId_eventType',
        );
        await queryRunner.dropTable('jobAnalyticsEvents');
    }
}
