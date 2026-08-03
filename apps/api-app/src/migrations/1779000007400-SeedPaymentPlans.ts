import { In, MigrationInterface, QueryRunner } from 'typeorm';
import { PAYMENT_PLAN_SEED } from '../modules/payments/common/constants/payment-plan.seed';
import { RecordStatus } from '../modules/payments/common/enums/payment.enums';
import { PaymentProvider } from '../modules/payments/payment-providers/entities/payment-provider.entity';
import { Product } from '../modules/payments/products/entities/product.entity';
import { Price } from '../modules/payments/prices/entities/price.entity';

export class SeedPaymentPlans1779000007400 implements MigrationInterface {
  name = 'SeedPaymentPlans1779000007400';

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
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(Product)
        .values({
          name: plan.name,
          code: plan.code,
          description: plan.description,
          status: RecordStatus.ACTIVE,
          metadata: {
            ...(plan.metadata ?? {}),
            seed: true,
          },
        })
        .orIgnore()
        .execute();

      const product = await queryRunner.manager.findOne(Product, {
        where: { code: plan.code },
        select: ['id'],
      });

      if (!product?.id) {
        continue;
      }

      for (const price of plan.prices) {
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
    const planCodes = PAYMENT_PLAN_SEED.map((plan) => plan.code);
    const priceSeedCodes = PAYMENT_PLAN_SEED.flatMap((plan) =>
      plan.prices.map((price) => price.code),
    );

    if (priceSeedCodes.length > 0) {
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(Price)
        .where("metadata->>'seedCode' IN (:...seedCodes)", {
          seedCodes: priceSeedCodes,
        })
        .execute();
    }

    if (planCodes.length > 0) {
      await queryRunner.manager.delete(Product, {
        code: In(planCodes),
      });
    }
  }
}
