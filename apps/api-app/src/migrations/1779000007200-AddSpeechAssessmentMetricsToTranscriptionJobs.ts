import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSpeechAssessmentMetricsToTranscriptionJobs1779000007200
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'speechMetrics',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'assessment',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'communicationMetrics',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'communicationScore',
        type: 'float',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'speechClarity',
        type: 'float',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'speakingPaceWpm',
        type: 'float',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'transcriptionJobs',
      new TableColumn({
        name: 'fluencyScore',
        type: 'float',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('transcriptionJobs', 'fluencyScore');
    await queryRunner.dropColumn('transcriptionJobs', 'speakingPaceWpm');
    await queryRunner.dropColumn('transcriptionJobs', 'speechClarity');
    await queryRunner.dropColumn('transcriptionJobs', 'communicationScore');
    await queryRunner.dropColumn('transcriptionJobs', 'communicationMetrics');
    await queryRunner.dropColumn('transcriptionJobs', 'assessment');
    await queryRunner.dropColumn('transcriptionJobs', 'speechMetrics');
  }
}
