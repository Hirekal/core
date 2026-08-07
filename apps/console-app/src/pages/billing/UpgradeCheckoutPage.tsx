/**
 * @fileoverview Custom checkout for prorated plan upgrades.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import Button from '../../components/common/Button';
import BillingErrorState from '../../components/billing/BillingErrorState';
import CheckoutOrderSummary from '../../components/billing/CheckoutOrderSummary';
import CheckoutPaymentForm from '../../components/billing/CheckoutPaymentForm';
import CheckoutSkeleton from '../../components/billing/CheckoutSkeleton';
import { useAuth } from '../../context/AuthContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import {
  BILLING_PERIODS,
  comparePlanDirection,
  matchesBillingPeriod,
  resolveBillingPeriod,
  type BillingPeriod,
} from '../../utils/billingFormat';
import type { Price, ValidatedCoupon } from '../../types/billing';

type UpgradeLocationState = {
  price?: Price;
  subscriptionId?: string;
  currentProductName?: string | null;
};

/**
 * Renders upgrade checkout with prorated amount and card entry.
 */
export default function UpgradeCheckoutPage() {
  const { priceId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationState = (location.state as UpgradeLocationState | null) ?? null;

  const [price, setPrice] = useState<Price | null>(locationState?.price ?? null);
  const [currentPrice, setCurrentPrice] = useState<Price | null>(null);
  const [productPrices, setProductPrices] = useState<Price[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [currentProductName, setCurrentProductName] = useState<string | null>(
    locationState?.currentProductName ?? null,
  );
  const [subscriptionId, setSubscriptionId] = useState<string | null>(
    locationState?.subscriptionId ?? null,
  );
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [amountDue, setAmountDue] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [periodSwitching, setPeriodSwitching] = useState(false);
  const [periodSwitchError, setPeriodSwitchError] = useState('');
  const [error, setError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState('');
  const upgradePreparedRef = useRef(false);
  const subscriptionIdRef = useRef<string | null>(locationState?.subscriptionId ?? null);
  const upgradeSucceededRef = useRef(false);

  useEffect(() => {
    subscriptionIdRef.current = subscriptionId;
  }, [subscriptionId]);

  const availablePeriods = useMemo(() => {
    if (!currentPrice) {
      return [];
    }

    return BILLING_PERIODS.filter((period) =>
      productPrices.some((productPrice) => {
        if (!matchesBillingPeriod(productPrice, period)) {
          return false;
        }
        const direction = comparePlanDirection(currentPrice, productPrice);
        return direction === 'upgrade' || direction === 'lateral';
      }),
    );
  }, [currentPrice, productPrices]);

  const applyPreview = useCallback(
    (
      loadedPrice: Price,
      planChangePreview: Awaited<ReturnType<typeof billingService.previewPlanChange>>,
      coupon?: ValidatedCoupon | null,
    ) => {
      const direction = planChangePreview.direction;
      if (direction !== 'upgrade' && direction !== 'lateral') {
        throw new Error('Selected plan is not an upgrade from your current plan.');
      }

      setPrice(loadedPrice);
      setAmountDue(planChangePreview.preview.estimatedAmountPayable);
      setDiscountAmount(planChangePreview.preview.discountAmount ?? 0);
      setDiscountLabel(
        planChangePreview.preview.discountLabel ?? coupon?.promotionCode ?? null,
      );

      const period = resolveBillingPeriod(
        loadedPrice.interval,
        loadedPrice.intervalCount,
      );
      if (period) {
        setBillingPeriod(period);
      }
    },
    [],
  );

  useEffect(() => {
    if (!priceId) {
      navigate('/billing/plans', { replace: true });
      return;
    }

    if (!user?.email) {
      return;
    }

    let cancelled = false;

    const initializeCheckout = async () => {
      try {
        setLoading(true);
        setError('');
        upgradePreparedRef.current = false;
        upgradeSucceededRef.current = false;

        const subscriptionPromise = locationState?.subscriptionId
          ? Promise.resolve(null)
          : billingService.getMySubscription();

        const subscription = await subscriptionPromise;
        const resolvedSubscriptionId =
          locationState?.subscriptionId ?? subscription?.id ?? null;

        if (!resolvedSubscriptionId) {
          throw new Error('You need an active subscription before upgrading.');
        }

        const prefetch = billingService.takeUpgradeCheckoutPrefetch(
          resolvedSubscriptionId,
          priceId,
        );

        const loadedPricePromise = prefetch?.price
          ? Promise.resolve(prefetch.price)
          : locationState?.price && locationState.price.id === priceId
            ? Promise.resolve(locationState.price)
            : billingService.getPrice(priceId);

        const previewPromise =
          prefetch?.previewPromise ??
          billingService.previewPlanChange(resolvedSubscriptionId, priceId);

        const siblingPricesPromise =
          prefetch?.siblingPricesPromise ??
          loadedPricePromise.then((loadedPrice) =>
            billingService.getPrices(loadedPrice.productId),
          );

        const configPromise =
          prefetch?.configPromise ?? billingService.getCheckoutConfig();

        const [loadedPrice, planChangePreview, siblingPrices, checkoutConfig] =
          await Promise.all([
            loadedPricePromise,
            previewPromise,
            siblingPricesPromise.catch(() => [] as Price[]),
            configPromise,
          ]);

        if (!checkoutConfig.publishableKey) {
          throw new Error('Checkout is missing required Stripe configuration');
        }

        if (cancelled) {
          return;
        }

        setSubscriptionId(resolvedSubscriptionId);
        setEmail(user.email);
        setName(user.name ?? '');
        setStripePromise(loadStripe(checkoutConfig.publishableKey));
        setCurrentPrice(planChangePreview.currentPlan);
        setProductPrices(
          siblingPrices.filter((productPrice) => productPrice.status === 'ACTIVE'),
        );
        setCurrentProductName(
          planChangePreview.currentPlan.product?.name ??
            locationState?.currentProductName ??
            subscription?.price?.product?.name ??
            null,
        );
        applyPreview(loadedPrice, planChangePreview);
        billingService.clearUpgradeCheckoutPrefetch(
          resolvedSubscriptionId,
          priceId,
        );
      } catch (err) {
        if (!cancelled) {
          setError(toUserErrorMessage(err, 'Failed to load upgrade checkout'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initializeCheckout();

    return () => {
      cancelled = true;
      const preparedSubscriptionId = subscriptionIdRef.current;
      if (
        upgradePreparedRef.current &&
        !upgradeSucceededRef.current &&
        preparedSubscriptionId
      ) {
        void billingService
          .cancelPendingUpgradeCheckout(preparedSubscriptionId)
          .catch(() => undefined);
      }
    };
  }, [applyPreview, locationState, navigate, priceId, user]);

  const refreshPreview = async (
    nextPrice: Price,
    coupon?: ValidatedCoupon | null,
  ) => {
    if (!subscriptionId || !currentPrice) {
      return;
    }

    const direction = comparePlanDirection(currentPrice, nextPrice);
    if (direction !== 'upgrade' && direction !== 'lateral') {
      throw new Error('Selected billing period is not available for this upgrade.');
    }

    const planChangePreview = await billingService.previewPlanChange(
      subscriptionId,
      nextPrice.id,
      coupon?.promotionCode,
    );

    applyPreview(nextPrice, planChangePreview, coupon);
  };

  const handleBillingPeriodChange = async (period: BillingPeriod) => {
    if (!currentPrice || period === billingPeriod || periodSwitching) {
      return;
    }

    const nextPrice = productPrices.find((productPrice) =>
      matchesBillingPeriod(productPrice, period),
    );
    if (!nextPrice || nextPrice.id === price?.id) {
      return;
    }

    const direction = comparePlanDirection(currentPrice, nextPrice);
    if (direction !== 'upgrade' && direction !== 'lateral') {
      setPeriodSwitchError(
        'That billing period is not available for an upgrade from your current plan.',
      );
      return;
    }

    setPeriodSwitching(true);
    setPeriodSwitchError('');

    try {
      await refreshPreview(nextPrice, appliedCoupon);
    } catch (err) {
      setPeriodSwitchError(toUserErrorMessage(err, 'Failed to update billing period'));
    } finally {
      setPeriodSwitching(false);
    }
  };

  const handleApplyCoupon = async (code: string) => {
    if (!price || couponApplying) {
      return;
    }

    setCouponApplying(true);
    setCouponError('');

    try {
      const validated = await billingService.validateCoupon(code);
      await refreshPreview(price, validated);
      setAppliedCoupon(validated);
    } catch (err) {
      setCouponError(toUserErrorMessage(err, 'Coupon code is not available'));
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = async () => {
    if (!price || couponApplying) {
      return;
    }

    setCouponApplying(true);
    setCouponError('');

    try {
      await refreshPreview(price, null);
      setAppliedCoupon(null);
      setDiscountLabel(null);
    } catch (err) {
      setCouponError(toUserErrorMessage(err, 'Failed to remove coupon'));
    } finally {
      setCouponApplying(false);
    }
  };

  if (loading) {
    return <CheckoutSkeleton />;
  }

  if (
    error ||
    !price?.product ||
    !stripePromise ||
    !subscriptionId ||
    !currentPrice ||
    amountDue === null
  ) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <BillingErrorState message={error || 'Unable to load upgrade checkout.'} />
        <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
          Back to plans
        </Button>
      </div>
    );
  }

  const upgradeDirection = comparePlanDirection(currentPrice, price);
  const chargeLooksInvalid =
    amountDue <= 0 && upgradeDirection === 'upgrade';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm lg:grid lg:grid-cols-2">
        <CheckoutOrderSummary
          product={price.product}
          price={price}
          mode="upgrade"
          amountDueToday={amountDue}
          discountAmount={discountAmount}
          discountLabel={discountLabel}
          currentProductName={currentProductName}
          billingPeriod={billingPeriod}
          availablePeriods={availablePeriods}
          onBillingPeriodChange={handleBillingPeriodChange}
          periodSwitching={periodSwitching}
          appliedCoupon={appliedCoupon}
          couponApplying={couponApplying}
          couponError={couponError}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
        />
        <Elements stripe={stripePromise}>
          <CheckoutPaymentForm
            price={price}
            email={email}
            name={name}
            payAmount={amountDue}
            successMessage="Subscription upgraded successfully"
            navigationState={{ upgraded: true }}
            switchError={
              periodSwitchError ||
              (chargeLooksInvalid
                ? 'Unable to calculate the upgrade charge for this billing period. Try another period or refresh the page.'
                : '')
            }
            prepareCheckout={async () => {
              const direction = comparePlanDirection(currentPrice, price);
              if (direction !== 'upgrade' && direction !== 'lateral') {
                throw new Error(
                  'Selected billing period is not available for an upgrade from your current plan.',
                );
              }

              if (amountDue <= 0 && direction === 'upgrade') {
                throw new Error(
                  'Unable to calculate the upgrade charge. Please try another billing period.',
                );
              }

              const checkoutSession =
                await billingService.createUpgradeCheckoutSession(
                  subscriptionId,
                  price.id,
                  appliedCoupon?.promotionCode,
                );

              if (
                !checkoutSession.clientSecret ||
                !checkoutSession.providerSubscriptionId
              ) {
                throw new Error('Checkout is missing required Stripe configuration');
              }

              if (typeof checkoutSession.amountDue === 'number') {
                if (
                  checkoutSession.amountDue <= 0 &&
                  direction === 'upgrade'
                ) {
                  throw new Error(
                    'Unable to calculate the upgrade charge. Please try another billing period.',
                  );
                }
                setAmountDue(checkoutSession.amountDue);
              }

              upgradePreparedRef.current = true;
              upgradeSucceededRef.current = false;

              return {
                clientSecret: checkoutSession.clientSecret,
                providerSubscriptionId: checkoutSession.providerSubscriptionId,
              };
            }}
            onCheckoutFailed={async () => {
              upgradePreparedRef.current = false;
              await billingService.cancelPendingUpgradeCheckout(subscriptionId);
            }}
            onCheckoutSucceeded={() => {
              upgradeSucceededRef.current = true;
              upgradePreparedRef.current = false;
            }}
            onEmailChange={setEmail}
            onNameChange={setName}
          />
        </Elements>
      </div>
    </div>
  );
}
