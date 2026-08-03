import { In, MigrationInterface, QueryRunner } from 'typeorm';
import { PAYMENT_PROVIDER_SEED } from '../modules/payments/common/constants/payment.constants';
import { RecordStatus } from '../modules/payments/common/enums/payment.enums';
import { PaymentProvider } from '../modules/payments/payment-providers/entities/payment-provider.entity';

export class SeedPaymentProviders1779000007300 implements MigrationInterface {
  name = 'SeedPaymentProviders1779000007300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const provider of PAYMENT_PROVIDER_SEED) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(PaymentProvider)
        .values({
          code: provider.code,
          name: provider.name,
          description: provider.description,
          status: RecordStatus.ACTIVE,
          metadata: {},
        })
        .orIgnore()
        .execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.delete(PaymentProvider, {
      code: In(PAYMENT_PROVIDER_SEED.map((provider) => provider.code)),
    });
  }
}
