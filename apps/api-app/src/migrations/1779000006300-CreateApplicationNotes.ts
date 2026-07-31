import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableIndex,
} from 'typeorm';

export class CreateApplicationNotes1779000006300 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'applicationNotes',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'gen_random_uuid()',
                    },
                    { name: 'applicationId', type: 'uuid', isNullable: false },
                    { name: 'authorId', type: 'uuid', isNullable: true },
                    { name: 'text', type: 'text', isNullable: false },
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
            'applicationNotes',
            new TableIndex({
                name: 'IDX_applicationNotes_applicationId',
                columnNames: ['applicationId'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex(
            'applicationNotes',
            'IDX_applicationNotes_applicationId',
        );
        await queryRunner.dropTable('applicationNotes');
    }
}
