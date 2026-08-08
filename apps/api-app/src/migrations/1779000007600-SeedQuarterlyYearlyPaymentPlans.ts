import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  PAYMENT_PLAN_NON_MONTHLY_SEED_CODES,
  PAYMENT_PLAN_SEED,
} from '../modules/payments/common/constants/payment-plan.seed';
import { RecordStatus } from '../modules/payments/common/enums/payment.enums';
import { PaymentProvider } from '../modules/payments/payment-providers/entities/payment-provider.entity';
import { Product } from '../modules/payments/products/entities/product.entity';
import { Price } from '../modules/payments/prices/entities/price.entity';

export class SeedQuarterlyYearlyPaymentPlans1779000007600 implements MigrationInterface {
  name = 'SeedQuarterlyYearlyPaymentPlans1779000007600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const stripeProvider = await queryRunner.manager.findOne(PaymentProvider, {
      where: { code: 'STRIPE' },
      select: ['id'],
    });

    if (!stripeProvider?.id) {
      throw new Error(
        'Stripe payment provider not found. Run SeedPaymentProviders migration first.',
      );
    }

    for (const plan of PAYMENT_PLAN_SEED) {
      const product = await queryRunner.manager.findOne(Product, {
        where: { code: plan.code },
        select: ['id'],
      });

      if (!product?.id) {
        continue;
      }

      for (const price of plan.prices) {
        if (price.code.endsWith('_MONTHLY')) {
          continue;
        }

        await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into(Price)
          .values({
            productId: product.id,
            paymentProviderId: stripeProvider.id,
            providerPriceId: price.providerPriceId,
            currency: price.currency.toUpperCase(),
            amount: price.amount,
            interval: price.interval,
            intervalCount: price.intervalCount ?? 1,
            status: RecordStatus.ACTIVE,
            metadata: {
              ...(price.metadata ?? {}),
              seedCode: price.code,
              seed: true,
            },
          })
          .orIgnore()
          .execute();
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (PAYMENT_PLAN_NON_MONTHLY_SEED_CODES.length === 0) {
      return;
    }

    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Price)
      .where("metadata->>'seedCode' IN (:...seedCodes)", {
        seedCodes: PAYMENT_PLAN_NON_MONTHLY_SEED_CODES,
      })
      .execute();
  }
}
