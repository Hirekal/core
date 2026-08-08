import { In, MigrationInterface, QueryRunner } from 'typeorm';
import { COUPON_SEED } from '../modules/payments/common/constants/coupon.seed';
import { RecordStatus } from '../modules/payments/common/enums/payment.enums';
import { PaymentProvider } from '../modules/payments/payment-providers/entities/payment-provider.entity';
import { Coupon } from '../modules/payments/coupons/entities/coupon.entity';

export class SeedCoupons1779000007900 implements MigrationInterface {
  name = 'SeedCoupons1779000007900';

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

    for (const coupon of COUPON_SEED) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(Coupon)
        .values({
          name: coupon.name,
          paymentProviderId: stripeProvider.id,
          providerCouponId: coupon.providerCouponId,
          providerPromotionCodeId: coupon.providerPromotionCodeId,
          promotionCode: coupon.promotionCode,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          duration: coupon.duration,
          maximumRedemptions: coupon.maximumRedemptions,
          expiresAt: new Date(coupon.expiresAt),
          status: RecordStatus.ACTIVE,
          metadata: {
            ...(coupon.metadata ?? {}),
            seed: true,
            seedCode: coupon.promotionCode,
          },
        })
        .orIgnore()
        .execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.manager.delete(Coupon, {
      promotionCode: In(COUPON_SEED.map((coupon) => coupon.promotionCode)),
    });
  }
}
