import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateApplicationAnswers1779000006200 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'applicationAnswers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'applicationId', type: 'uuid', isNullable: false },
          { name: 'questionId', type: 'uuid', isNullable: false },
          { name: 'answerText', type: 'text', isNullable: true },
          {
            name: 'mediaType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'mediaUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'mediaStorageKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'mediaFileName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'mediaDurationSeconds',
            type: 'int',
            isNullable: true,
          },
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

    await queryRunner.createUniqueConstraint(
      'applicationAnswers',
      new TableUnique({
        name: 'UQ_applicationAnswers_application_question',
        columnNames: ['applicationId', 'questionId'],
      }),
    );

    await queryRunner.createIndex(
      'applicationAnswers',
      new TableIndex({
        name: 'IDX_applicationAnswers_applicationId',
        columnNames: ['applicationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'applicationAnswers',
      'IDX_applicationAnswers_applicationId',
    );
    await queryRunner.dropUniqueConstraint(
      'applicationAnswers',
      'UQ_applicationAnswers_application_question',
    );
    await queryRunner.dropTable('applicationAnswers');
  }
}
