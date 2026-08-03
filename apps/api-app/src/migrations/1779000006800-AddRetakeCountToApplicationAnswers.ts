import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRetakeCountToApplicationAnswers1779000006800
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'applicationAnswers',
            new TableColumn({
                name: 'retakeCount',
                type: 'int',
                default: 0,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('applicationAnswers', 'retakeCount');
    }
}
