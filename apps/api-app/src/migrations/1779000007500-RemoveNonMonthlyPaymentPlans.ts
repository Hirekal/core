import { MigrationInterface, QueryRunner } from 'typeorm';
import { PriceInterval } from '../modules/payments/common/enums/payment.enums';
import { Price } from '../modules/payments/prices/entities/price.entity';

const REMOVED_SEED_CODES = [
  'STARTER_YEARLY',
  'PROFESSIONAL_YEARLY',
  'ENTERPRISE_YEARLY',
];

export class RemoveNonMonthlyPaymentPlans1779000007500 implements MigrationInterface {
  name = 'RemoveNonMonthlyPaymentPlans1779000007500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Price)
      .where("metadata->>'seedCode' IN (:...seedCodes)", {
        seedCodes: REMOVED_SEED_CODES,
      })
      .execute();

    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Price)
      .where('interval IS NOT NULL')
      .andWhere('interval <> :interval', { interval: PriceInterval.MONTH })
      .execute();
  }

  public async down(): Promise<void> {
    // Yearly/quarterly plans are intentionally not restored.
  }
}
