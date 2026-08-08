/**
 * @fileoverview Custom two-column checkout page styled like Stripe Checkout.
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
  matchesBillingPeriod,
  resolveBillingPeriod,
  buildPeriodSavingsMap,
  computeCouponDiscountedAmount,
  type BillingPeriod,
} from '../../utils/billingFormat';
import type { Price, ValidatedCoupon } from '../../types/billing';

async function createCheckoutForPrice(
  priceId: string,
  email: string,
  name?: string,
  couponCode?: string,
  previousProviderSubscriptionId?: string,
) {
  return billingService.createCheckoutSession({
    priceId,
    email,
    name,
    ...(couponCode ? { couponCode } : {}),
    ...(previousProviderSubscriptionId
      ? { previousProviderSubscriptionId }
      : {}),
  });
}

/**
 * Renders a custom checkout layout with plan summary and payment form.
 */
export default function CheckoutPage() {
  const { priceId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationPrice = (location.state as { price?: Price } | null)?.price;

  const [price, setPrice] = useState<Price | null>(locationPrice ?? null);
  const [productPrices, setProductPrices] = useState<Price[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [providerSubscriptionId, setProviderSubscriptionId] = useState<string | null>(
    null,
  );
  const [amountDueToday, setAmountDueToday] = useState<number | null>(
    locationPrice?.amount ?? null,
  );
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
  const totalsRequestIdRef = useRef(0);

  const availablePeriods = useMemo(
    () =>
      BILLING_PERIODS.filter((period) =>
        productPrices.some((productPrice) => matchesBillingPeriod(productPrice, period)),
      ),
    [productPrices],
  );

  const savingsByPeriod = useMemo(
    () => buildPeriodSavingsMap(productPrices),
    [productPrices],
  );

  const discountAmount = useMemo(() => {
    if (!price || amountDueToday == null) {
      return 0;
    }
    return Math.max(price.amount - amountDueToday, 0);
  }, [amountDueToday, price]);

  const applyCheckoutTotals = useCallback(
    (
      loadedPrice: Price,
      checkoutSession: Awaited<ReturnType<typeof createCheckoutForPrice>>,
    ) => {
      setPrice(loadedPrice);
      setProviderSubscriptionId(checkoutSession.providerSubscriptionId);
      setAmountDueToday(
        typeof checkoutSession.amountDue === 'number'
          ? checkoutSession.amountDue
          : loadedPrice.amount,
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

        const prefetch = billingService.takeSubscribeCheckoutPrefetch(
          priceId,
          user.email,
        );

        const loadedPricePromise = prefetch?.price
          ? Promise.resolve(prefetch.price)
          : locationPrice && locationPrice.id === priceId
            ? Promise.resolve(locationPrice)
            : billingService.getPrice(priceId);

        // Prefetch may already have started a session — use it for initial totals.
        // Payment confirmation always creates/refreshes the session on Pay.
        const sessionPromise =
          prefetch?.sessionPromise ??
          createCheckoutForPrice(priceId, user.email, user.name ?? undefined);

        const siblingPricesPromise =
          prefetch?.siblingPricesPromise ??
          loadedPricePromise.then((loadedPrice) =>
            billingService.getPrices(loadedPrice.productId),
          );

        const configPromise = billingService.getCheckoutConfig();

        const [loadedPrice, checkoutSession, siblingPrices, checkoutConfig] =
          await Promise.all([
            loadedPricePromise,
            sessionPromise,
            siblingPricesPromise.catch(() => [] as Price[]),
            configPromise,
          ]);

        if (!checkoutConfig.publishableKey) {
          throw new Error('Checkout is missing required Stripe configuration');
        }

        if (cancelled) {
          return;
        }

        setEmail(user.email);
        setName(user.name ?? '');
        setProductPrices(siblingPrices);
        setStripePromise(loadStripe(checkoutConfig.publishableKey));
        applyCheckoutTotals(loadedPrice, checkoutSession);
        billingService.clearSubscribeCheckoutPrefetch(priceId, user.email);
      } catch (err) {
        if (!cancelled) {
          setError(toUserErrorMessage(err, 'Failed to load checkout'));
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
    };
  }, [applyCheckoutTotals, locationPrice, navigate, priceId, user]);

  /*
   * Updates displayed period/coupon totals without creating a Stripe payment
   * session. Pay creates the incomplete subscription + PaymentIntent once.
   */
  const applyDisplayTotals = useCallback(
    (nextPrice: Price, coupon?: ValidatedCoupon | null) => {
      setPrice(nextPrice);
      setAmountDueToday(
        computeCouponDiscountedAmount(nextPrice.amount, coupon ?? null),
      );

      const period = resolveBillingPeriod(
        nextPrice.interval,
        nextPrice.intervalCount,
      );
      if (period) {
        setBillingPeriod(period);
      }
    },
    [],
  );

  const handleBillingPeriodChange = async (period: BillingPeriod) => {
    if (!user?.email || period === billingPeriod || periodSwitching || couponApplying) {
      return;
    }

    const nextPrice = productPrices.find((productPrice) =>
      matchesBillingPeriod(productPrice, period),
    );
    if (!nextPrice || nextPrice.id === price?.id) {
      return;
    }

    const requestId = ++totalsRequestIdRef.current;
    setPeriodSwitching(true);
    setPeriodSwitchError('');

    try {
      if (requestId !== totalsRequestIdRef.current) {
        return;
      }
      applyDisplayTotals(nextPrice, appliedCoupon);
    } catch (err) {
      if (requestId === totalsRequestIdRef.current) {
        setPeriodSwitchError(toUserErrorMessage(err, 'Failed to update billing period'));
      }
    } finally {
      if (requestId === totalsRequestIdRef.current) {
        setPeriodSwitching(false);
      }
    }
  };

  const handleApplyCoupon = async (code: string) => {
    if (!price || couponApplying || periodSwitching) {
      return;
    }

    const requestId = ++totalsRequestIdRef.current;
    setCouponApplying(true);
    setCouponError('');

    try {
      const validated = await billingService.validateCoupon(code);
      if (requestId !== totalsRequestIdRef.current) {
        return;
      }
      // Display-only estimate from backend-validated coupon metadata.
      // Stripe enforces the real discount when Pay creates the payment session.
      applyDisplayTotals(price, validated);
      setAppliedCoupon(validated);
    } catch (err) {
      if (requestId === totalsRequestIdRef.current) {
        setCouponError(toUserErrorMessage(err, 'Coupon code is not available'));
      }
    } finally {
      if (requestId === totalsRequestIdRef.current) {
        setCouponApplying(false);
      }
    }
  };

  const handleRemoveCoupon = async () => {
    if (!price || couponApplying || periodSwitching) {
      return;
    }

    const requestId = ++totalsRequestIdRef.current;
    setCouponApplying(true);
    setCouponError('');

    try {
      if (requestId !== totalsRequestIdRef.current) {
        return;
      }
      applyDisplayTotals(price, null);
      setAppliedCoupon(null);
    } catch (err) {
      if (requestId === totalsRequestIdRef.current) {
        setCouponError(toUserErrorMessage(err, 'Failed to remove coupon'));
      }
    } finally {
      if (requestId === totalsRequestIdRef.current) {
        setCouponApplying(false);
      }
    }
  };

  if (loading) {
    return <CheckoutSkeleton />;
  }

  if (error || !price?.product || !stripePromise) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <BillingErrorState message={error || 'Unable to load checkout.'} />
          <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
            Back to plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="border-[#e6ebf1] shadow-[4px_0_24px_rgba(15,23,42,0.04)] lg:border-r">
        <CheckoutOrderSummary
          product={price.product}
          price={price}
          amountDueToday={amountDueToday ?? price.amount}
          discountAmount={discountAmount}
          discountLabel={appliedCoupon?.promotionCode ?? null}
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
        <Elements stripe={stripePromise}>
          <CheckoutPaymentForm
            price={price}
            email={email}
            name={name}
            payAmount={amountDueToday ?? price.amount}
            switchError={periodSwitchError}
            disabled={couponApplying || periodSwitching}
            prepareCheckout={async () => {
              if (!user?.email) {
                throw new Error('You need to be signed in to complete checkout.');
              }

              // Pay owns the full payment session: create (with coupon) then confirm.
              const checkoutSession = await createCheckoutForPrice(
                price.id,
                email.trim() || user.email,
                name.trim() || user.name || undefined,
                appliedCoupon?.promotionCode,
                providerSubscriptionId ?? undefined,
              );

              if (
                !checkoutSession.clientSecret ||
                !checkoutSession.providerSubscriptionId
              ) {
                throw new Error('Checkout is missing required Stripe configuration');
              }

              applyCheckoutTotals(price, checkoutSession);

              return {
                clientSecret: checkoutSession.clientSecret,
                providerSubscriptionId: checkoutSession.providerSubscriptionId,
              };
            }}
            onCheckoutFailed={async () => {
              // Incomplete payment session is abandoned; next Pay creates a fresh one.
              setProviderSubscriptionId(null);
            }}
            onEmailChange={setEmail}
            onNameChange={setName}
          />
        </Elements>
      </div>
    </div>
  );
}
