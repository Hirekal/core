import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddApplyButtonLabelToJobs1779000006900
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'jobs',
            new TableColumn({
                name: 'applyButtonLabel',
                type: 'varchar',
                length: '100',
                isNullable: true,
                default: "'Start now'",
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('jobs', 'applyButtonLabel');
    }
}
