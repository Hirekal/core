import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the four scalar score columns if an earlier run of 1779000007200
 * only created the jsonb columns (speechMetrics / assessment / communicationMetrics).
 */
export class AddCommunicationScoreColumnsToTranscriptionJobs1779000007300
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcriptionJobs');
    if (!table) return;

    const columns: Array<{ name: string; type: string }> = [
      { name: 'communicationScore', type: 'float' },
      { name: 'speechClarity', type: 'float' },
      { name: 'speakingPaceWpm', type: 'float' },
      { name: 'fluencyScore', type: 'float' },
    ];

    for (const column of columns) {
      if (table.findColumnByName(column.name)) continue;
      await queryRunner.addColumn(
        'transcriptionJobs',
        new TableColumn({
          name: column.name,
          type: column.type,
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('transcriptionJobs');
    if (!table) return;

    for (const name of [
      'fluencyScore',
      'speakingPaceWpm',
      'speechClarity',
      'communicationScore',
    ]) {
      if (!table.findColumnByName(name)) continue;
      await queryRunner.dropColumn('transcriptionJobs', name);
    }
  }
}
