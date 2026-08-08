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
import CheckoutPaymentForm, {
  checkoutElementsOptions,
} from '../../components/billing/CheckoutPaymentForm';
import CheckoutSkeleton from '../../components/billing/CheckoutSkeleton';
import { useAuth } from '../../context/AuthContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import {
  BILLING_PERIODS,
  comparePlanDirection,
  isPayableUpgradePeriod,
  matchesBillingPeriod,
  resolveBillingPeriod,
  buildPeriodSavingsMap,
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
  const [unusedCreditEstimate, setUnusedCreditEstimate] = useState(0);
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
  const previewRequestIdRef = useRef(0);

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
        return isPayableUpgradePeriod(
          currentPrice,
          productPrice,
          unusedCreditEstimate,
        );
      }),
    );
  }, [currentPrice, productPrices, unusedCreditEstimate]);

  const savingsByPeriod = useMemo(
    () => buildPeriodSavingsMap(productPrices),
    [productPrices],
  );

  const applyPreview = useCallback(
    (
      loadedPrice: Price,
      planChangePreview: Awaited<ReturnType<typeof billingService.previewPlanChange>>,
      coupon?: ValidatedCoupon | null,
      previousAmountDue?: number | null,
    ) => {
      const direction = planChangePreview.direction;
      if (direction !== 'upgrade' && direction !== 'lateral') {
        throw new Error('Selected plan is not an upgrade from your current plan.');
      }

      const payable = planChangePreview.preview.estimatedAmountPayable;
      let previewDiscount = planChangePreview.preview.discountAmount ?? 0;
      // Derive savings from the payable drop when BE omits discountAmount.
      if (
        coupon &&
        previewDiscount <= 0 &&
        typeof previousAmountDue === 'number' &&
        previousAmountDue > payable
      ) {
        previewDiscount = previousAmountDue - payable;
      }

      setPrice(loadedPrice);
      setAmountDue(payable);
      setDiscountAmount(previewDiscount);
      setDiscountLabel(
        coupon?.promotionCode ??
          planChangePreview.preview.discountLabel ??
          null,
      );
      setUnusedCreditEstimate(
        Math.max(planChangePreview.preview.prorationCredit ?? 0, 0),
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

  const findPayableSiblingPrice = useCallback(
    (
      activeCurrentPrice: Price,
      prices: Price[],
      credit: number,
      preferredPriceId?: string | null,
    ): Price | null => {
      const payable = prices.filter((productPrice) =>
        isPayableUpgradePeriod(activeCurrentPrice, productPrice, credit),
      );
      if (payable.length === 0) {
        return null;
      }

      if (preferredPriceId) {
        const preferred = payable.find((productPrice) => productPrice.id === preferredPriceId);
        if (preferred) {
          return preferred;
        }
      }

      return (
        payable.find((productPrice) => {
          const period = resolveBillingPeriod(
            productPrice.interval,
            productPrice.intervalCount,
          );
          return period === 'yearly';
        }) ??
        payable[payable.length - 1] ??
        null
      );
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

        const activePrices = siblingPrices.filter(
          (productPrice) => productPrice.status === 'ACTIVE',
        );
        const activeCurrentPrice = planChangePreview.currentPlan;
        const credit = Math.max(planChangePreview.preview.prorationCredit ?? 0, 0);

        let checkoutPrice = loadedPrice;
        let checkoutPreview = planChangePreview;

        const selectedIsPayable = isPayableUpgradePeriod(
          activeCurrentPrice,
          loadedPrice,
          credit,
        );
        const selectedLooksUnderpaid =
          planChangePreview.direction === 'upgrade' &&
          planChangePreview.preview.estimatedAmountPayable <= 0;

        if (!selectedIsPayable || selectedLooksUnderpaid) {
          const fallbackPrice = findPayableSiblingPrice(
            activeCurrentPrice,
            activePrices,
            credit,
            null,
          );
          if (!fallbackPrice) {
            throw new Error(
              'No payable upgrade billing period is available for your current plan. Try a higher plan or period from the plans page.',
            );
          }
          if (fallbackPrice.id !== loadedPrice.id) {
            checkoutPrice = fallbackPrice;
            checkoutPreview = await billingService.previewPlanChange(
              resolvedSubscriptionId,
              fallbackPrice.id,
            );
          }
        }

        if (cancelled) {
          return;
        }

        setSubscriptionId(resolvedSubscriptionId);
        setEmail(user.email);
        setName(user.name ?? '');
        setStripePromise(loadStripe(checkoutConfig.publishableKey));
        setCurrentPrice(activeCurrentPrice);
        setProductPrices(activePrices);
        setCurrentProductName(
          checkoutPreview.currentPlan.product?.name ??
            locationState?.currentProductName ??
            subscription?.price?.product?.name ??
            null,
        );
        applyPreview(checkoutPrice, checkoutPreview);
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
  }, [applyPreview, findPayableSiblingPrice, locationState, navigate, priceId, user]);

  const refreshPreview = async (
    nextPrice: Price,
    coupon?: ValidatedCoupon | null,
  ) => {
    if (!subscriptionId || !currentPrice) {
      return;
    }

    if (!isPayableUpgradePeriod(currentPrice, nextPrice, unusedCreditEstimate)) {
      throw new Error('Selected billing period is not available for this upgrade.');
    }

    // Read-only Stripe invoice preview — does not create a PaymentIntent.
    const planChangePreview = await billingService.previewPlanChange(
      subscriptionId,
      nextPrice.id,
      coupon?.promotionCode,
    );

    applyPreview(nextPrice, planChangePreview, coupon, amountDue);
  };

  const handleBillingPeriodChange = async (period: BillingPeriod) => {
    if (!currentPrice || period === billingPeriod || periodSwitching || couponApplying) {
      return;
    }

    const nextPrice = productPrices.find((productPrice) =>
      matchesBillingPeriod(productPrice, period),
    );
    if (!nextPrice || nextPrice.id === price?.id) {
      return;
    }

    if (!isPayableUpgradePeriod(currentPrice, nextPrice, unusedCreditEstimate)) {
      setPeriodSwitchError(
        'That billing period is not available for an upgrade from your current plan.',
      );
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    setPeriodSwitching(true);
    setPeriodSwitchError('');

    try {
      await refreshPreview(nextPrice, appliedCoupon);
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
    } catch (err) {
      if (requestId === previewRequestIdRef.current) {
        setPeriodSwitchError(toUserErrorMessage(err, 'Failed to update billing period'));
      }
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPeriodSwitching(false);
      }
    }
  };

  const handleApplyCoupon = async (code: string) => {
    if (!price || couponApplying || periodSwitching) {
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    setCouponApplying(true);
    setCouponError('');

    try {
      const validated = await billingService.validateCoupon(code);
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
      await refreshPreview(price, validated);
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
      setAppliedCoupon(validated);
    } catch (err) {
      if (requestId === previewRequestIdRef.current) {
        setCouponError(toUserErrorMessage(err, 'Coupon not available'));
      }
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setCouponApplying(false);
      }
    }
  };

  const handleRemoveCoupon = async () => {
    if (!price || couponApplying || periodSwitching) {
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    setCouponApplying(true);
    setCouponError('');

    try {
      await refreshPreview(price, null);
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
      setAppliedCoupon(null);
      setDiscountLabel(null);
    } catch (err) {
      if (requestId === previewRequestIdRef.current) {
        setCouponError(toUserErrorMessage(err, 'Failed to remove coupon'));
      }
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setCouponApplying(false);
      }
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <BillingErrorState message={error || 'Unable to load upgrade checkout.'} />
          <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
            Back to plans
          </Button>
        </div>
      </div>
    );
  }

  const upgradeDirection = comparePlanDirection(currentPrice, price);
  const chargeLooksInvalid =
    amountDue <= 0 && upgradeDirection === 'upgrade';

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="border-[#e6ebf1] shadow-[4px_0_24px_rgba(15,23,42,0.04)] lg:border-r">
        <CheckoutOrderSummary
          product={price.product}
          price={price}
          mode="upgrade"
          amountDueToday={amountDue}
          discountAmount={discountAmount}
          discountLabel={appliedCoupon?.promotionCode ?? discountLabel}
          currentProductName={currentProductName}
          billingPeriod={billingPeriod}
          availablePeriods={availablePeriods}
          savingsByPeriod={savingsByPeriod}
          onBillingPeriodChange={handleBillingPeriodChange}
          periodSwitching={periodSwitching}
          appliedCoupon={appliedCoupon}
          couponApplying={couponApplying}
          couponError={couponError}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
        />
      </div>
      <div className="bg-white">
        <Elements
          key="checkout-elements-custom-billing"
          stripe={stripePromise}
          options={checkoutElementsOptions}
        >
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
            disabled={couponApplying || periodSwitching}
            prepareCheckout={async () => {
              if (
                !isPayableUpgradePeriod(currentPrice, price, unusedCreditEstimate)
              ) {
                throw new Error(
                  'Selected billing period is not available for an upgrade from your current plan.',
                );
              }

              const direction = comparePlanDirection(currentPrice, price);
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
