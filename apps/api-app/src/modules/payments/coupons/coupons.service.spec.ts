/**
 * @fileoverview Unit tests for coupon redemption limits.
 */
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { ERROR_MESSAGES } from '../common/messages/payment.messages';
import {
  CouponDiscountType,
  CouponDuration,
  RecordStatus,
} from '../common/enums/payment.enums';
import { PAYMENT_CONSTANTS } from '../common/constants/payment.constants';

function buildCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    name: 'SAVE20',
    promotionCode: 'SAVE20',
    providerCouponId: 'coupon_stripe_1',
    providerPromotionCodeId: 'promo_stripe_1',
    paymentProviderId: 'provider-1',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    duration: CouponDuration.ONCE,
    maximumRedemptions: PAYMENT_CONSTANTS.COUPON_DEFAULT_MAXIMUM_REDEMPTIONS,
    timesRedeemed: 0,
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    status: RecordStatus.ACTIVE,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Coupon;
}

describe('CouponsService redemption limits', () => {
  let service: CouponsService;
  let couponRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    increment: jest.Mock;
    update: jest.Mock;
  };
  let couponRedemptionRepository: {
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let stripeService: { getClient: jest.Mock };
  let stripeProvider: {
    createCoupon: jest.Mock;
    createPromotionCode: jest.Mock;
  };

  beforeEach(() => {
    couponRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      increment: jest.fn(),
      update: jest.fn(),
    };
    couponRedemptionRepository = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
      create: jest.fn((value) => value),
    };
    stripeService = {
      getClient: jest.fn().mockReturnValue({
        coupons: {
          retrieve: jest.fn().mockResolvedValue({ valid: true }),
        },
        promotionCodes: {
          retrieve: jest.fn().mockResolvedValue(null),
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
      }),
    };
    stripeProvider = {
      createCoupon: jest.fn(),
      createPromotionCode: jest.fn(),
    };

    service = new CouponsService(
      couponRepository as never,
      couponRedemptionRepository as never,
      stripeService as never,
      stripeProvider as never,
      { findByCode: jest.fn() } as never,
    );
  });

  function mockFindActiveCoupon(coupon: Coupon | null) {
    const getOne = jest.fn().mockResolvedValue(coupon);
    const andWhere = jest.fn().mockReturnValue({ getOne });
    const where = jest.fn().mockReturnValue({ andWhere, getOne });
    couponRepository.createQueryBuilder.mockReturnValue({ where });
  }

  it('allows first redemption for a customer', async () => {
    const coupon = buildCoupon();
    mockFindActiveCoupon(coupon);
    couponRedemptionRepository.findOne.mockResolvedValue(null);
    couponRedemptionRepository.count.mockResolvedValue(0);

    const result = await service.validatePromotionCode('SAVE20', 'org-a');

    expect(result.promotionCode).toBe('SAVE20');
    expect(couponRedemptionRepository.findOne).toHaveBeenCalledWith({
      where: {
        couponId: coupon.id,
        organizationId: 'org-a',
        status: RecordStatus.ACTIVE,
      },
    });
  });

  it('rejects the same customer redeeming twice', async () => {
    const coupon = buildCoupon();
    mockFindActiveCoupon(coupon);
    couponRedemptionRepository.findOne.mockResolvedValue({
      id: 'redemption-1',
      couponId: coupon.id,
      organizationId: 'org-a',
    });

    await expect(
      service.validatePromotionCode('SAVE20', 'org-a'),
    ).rejects.toThrow(ERROR_MESSAGES.COUPON.ALREADY_REDEEMED);
  });

  it('allows a different customer to redeem the same code', async () => {
    const coupon = buildCoupon({ timesRedeemed: 1 });
    mockFindActiveCoupon(coupon);
    couponRedemptionRepository.findOne.mockResolvedValue(null);
    couponRedemptionRepository.count.mockResolvedValue(1);

    await expect(
      service.validatePromotionCode('SAVE20', 'org-b'),
    ).resolves.toMatchObject({ promotionCode: 'SAVE20' });
  });

  it('rejects when the global 100 redemption limit is reached', async () => {
    const coupon = buildCoupon({
      timesRedeemed: PAYMENT_CONSTANTS.COUPON_DEFAULT_MAXIMUM_REDEMPTIONS,
      maximumRedemptions: PAYMENT_CONSTANTS.COUPON_DEFAULT_MAXIMUM_REDEMPTIONS,
    });
    mockFindActiveCoupon(coupon);
    couponRedemptionRepository.findOne.mockResolvedValue(null);
    couponRedemptionRepository.count.mockResolvedValue(
      PAYMENT_CONSTANTS.COUPON_DEFAULT_MAXIMUM_REDEMPTIONS,
    );

    await expect(
      service.validatePromotionCode('SAVE20', 'org-new'),
    ).rejects.toThrow(ERROR_MESSAGES.COUPON.MAX_REDEMPTIONS_REACHED);
  });

  it('rejects an expired promotion code', async () => {
    const coupon = buildCoupon({
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
    });
    mockFindActiveCoupon(coupon);

    await expect(
      service.validatePromotionCode('SAVE20', 'org-a'),
    ).rejects.toThrow(ERROR_MESSAGES.COUPON.EXPIRED);
  });

  it('rejects an invalid / non-existent promotion code', async () => {
    mockFindActiveCoupon(null);

    await expect(
      service.validatePromotionCode('NOPE', 'org-a'),
    ).rejects.toThrow(ERROR_MESSAGES.COUPON.NOT_AVAILABLE);
  });

  it('does not record a second redemption for the same customer', async () => {
    const coupon = buildCoupon({ timesRedeemed: 1 });
    mockFindActiveCoupon(coupon);
    couponRedemptionRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'redemption-1',
        couponId: coupon.id,
        organizationId: 'org-a',
        providerInvoiceId: 'in_1',
      });

    // First invoice already recorded — findOne for providerInvoiceId miss,
    // then priorCustomerRedemption hit.
    couponRedemptionRepository.findOne.mockReset();
    couponRedemptionRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'redemption-1',
        organizationId: 'org-a',
      });
    mockFindActiveCoupon(coupon);

    await service.recordSuccessfulRedemption({
      promotionCode: 'SAVE20',
      organizationId: 'org-a',
      providerInvoiceId: 'in_2',
      providerSubscriptionId: 'sub_1',
    });

    expect(couponRedemptionRepository.save).not.toHaveBeenCalled();
    expect(couponRepository.increment).not.toHaveBeenCalled();
  });

  it('sets Stripe promotion-code global and per-customer limits on create', async () => {
    const getOne = jest.fn().mockResolvedValue(null);
    couponRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnValue({ getOne }),
    });
    stripeService.getClient.mockReturnValue({
      promotionCodes: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      },
    });
    stripeProvider.createCoupon.mockResolvedValue({ id: 'coupon_new' });
    stripeProvider.createPromotionCode.mockResolvedValue({
      id: 'promo_new',
      max_redemptions: 100,
    });

    const paymentProvidersService = {
      findByCode: jest.fn().mockResolvedValue({ id: 'provider-1' }),
    };
    service = new CouponsService(
      {
        ...couponRepository,
        create: jest.fn(),
        save: jest.fn().mockImplementation(async (entity) => ({
          ...buildCoupon(),
          ...entity,
          id: 'coupon-created',
          timesRedeemed: 0,
        })),
        createQueryBuilder: couponRepository.createQueryBuilder,
      } as never,
      couponRedemptionRepository as never,
      stripeService as never,
      stripeProvider as never,
      paymentProvidersService as never,
    );

    // BaseRepository.createAndSave uses repository.create + save
    const repo = (service as unknown as { couponRepository: {
      create: jest.Mock;
      save: jest.Mock;
      createQueryBuilder: jest.Mock;
    } }).couponRepository;
    repo.create = jest.fn((value) => value);
    repo.save = jest.fn(async (entity) => ({
      ...buildCoupon(),
      ...entity,
      id: 'coupon-created',
    }));

    await service.create({
      name: 'SAVE20',
      promotionCode: 'SAVE20',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 20,
      duration: CouponDuration.ONCE,
    });

    expect(stripeProvider.createPromotionCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SAVE20',
        max_redemptions:
          PAYMENT_CONSTANTS.COUPON_DEFAULT_MAXIMUM_REDEMPTIONS,
      }),
    );
    expect(stripeProvider.createPromotionCode).toHaveBeenCalledWith(
      expect.not.objectContaining({
        restrictions: expect.anything(),
      }),
    );
    expect(stripeProvider.createCoupon).toHaveBeenCalledWith(
      expect.not.objectContaining({
        max_redemptions: expect.anything(),
      }),
    );
  });
});
