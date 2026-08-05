/**
 * @fileoverview Custom two-column checkout page styled like Stripe Checkout.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import BillingErrorState from '../../components/billing/BillingErrorState';
import CheckoutOrderSummary from '../../components/billing/CheckoutOrderSummary';
import CheckoutPaymentForm from '../../components/billing/CheckoutPaymentForm';
import { useAuth } from '../../context/AuthContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import {
  BILLING_PERIODS,
  matchesBillingPeriod,
  resolveBillingPeriod,
  type BillingPeriod,
} from '../../utils/billingFormat';
import type { Price, ValidatedCoupon } from '../../types/billing';

async function createCheckoutForPrice(
  priceId: string,
  email: string,
  name?: string,
  couponCode?: string,
) {
  return billingService.createCheckoutSession({
    priceId,
    email,
    name,
    ...(couponCode ? { couponCode } : {}),
  });
}

/**
 * Renders a custom checkout layout with plan summary and payment form.
 */
export default function CheckoutPage() {
  const { priceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [price, setPrice] = useState<Price | null>(null);
  const [productPrices, setProductPrices] = useState<Price[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [providerSubscriptionId, setProviderSubscriptionId] = useState<string | null>(
    null,
  );
  const [amountDueToday, setAmountDueToday] = useState<number | null>(null);
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

  const availablePeriods = useMemo(
    () =>
      BILLING_PERIODS.filter((period) =>
        productPrices.some((productPrice) => matchesBillingPeriod(productPrice, period)),
      ),
    [productPrices],
  );

  const discountAmount = useMemo(() => {
    if (!price || amountDueToday == null) {
      return 0;
    }
    return Math.max(price.amount - amountDueToday, 0);
  }, [amountDueToday, price]);

  const applyCheckoutSession = useCallback(
    (loadedPrice: Price, checkoutSession: Awaited<ReturnType<typeof createCheckoutForPrice>>) => {
      if (!checkoutSession.clientSecret || !checkoutSession.publishableKey) {
        throw new Error('Checkout is missing required Stripe configuration');
      }

      setPrice(loadedPrice);
      setClientSecret(checkoutSession.clientSecret);
      setProviderSubscriptionId(checkoutSession.providerSubscriptionId);
      setStripePromise(loadStripe(checkoutSession.publishableKey));
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

        const loadedPrice = await billingService.getPrice(priceId);
        const siblingPrices = await billingService.getPrices(loadedPrice.productId);
        const checkoutSession = await createCheckoutForPrice(
          priceId,
          user.email,
          user.name ?? undefined,
        );

        if (!cancelled) {
          setProductPrices(siblingPrices);
          setEmail(user.email);
          setName(user.name ?? '');
          applyCheckoutSession(loadedPrice, checkoutSession);
        }
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
  }, [applyCheckoutSession, navigate, priceId, user]);

  const recreateCheckout = async (
    nextPrice: Price,
    coupon?: ValidatedCoupon | null,
  ) => {
    if (!user?.email) {
      return;
    }

    const checkoutSession = await createCheckoutForPrice(
      nextPrice.id,
      user.email,
      user.name ?? undefined,
      coupon?.promotionCode,
    );
    applyCheckoutSession(nextPrice, checkoutSession);
  };

  const handleBillingPeriodChange = async (period: BillingPeriod) => {
    if (!user?.email || period === billingPeriod || periodSwitching) {
      return;
    }

    const nextPrice = productPrices.find((productPrice) =>
      matchesBillingPeriod(productPrice, period),
    );
    if (!nextPrice || nextPrice.id === price?.id) {
      return;
    }

    setPeriodSwitching(true);
    setPeriodSwitchError('');

    try {
      const loadedPrice = await billingService.getPrice(nextPrice.id);
      await recreateCheckout(loadedPrice, appliedCoupon);
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
      await recreateCheckout(price, validated);
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
      await recreateCheckout(price, null);
      setAppliedCoupon(null);
    } catch (err) {
      setCouponError(toUserErrorMessage(err, 'Failed to remove coupon'));
    } finally {
      setCouponApplying(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading checkout…" />;
  }

  if (error || !price?.product || !clientSecret || !stripePromise || !providerSubscriptionId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <BillingErrorState message={error || 'Unable to load checkout.'} />
        <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
          Back to plans
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm lg:grid lg:grid-cols-2">
        <CheckoutOrderSummary
          product={price.product}
          price={price}
          amountDueToday={amountDueToday ?? price.amount}
          discountAmount={discountAmount}
          discountLabel={appliedCoupon?.promotionCode ?? null}
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
        <Elements key={clientSecret} stripe={stripePromise}>
          <CheckoutPaymentForm
            price={price}
            email={email}
            name={name}
            clientSecret={clientSecret}
            providerSubscriptionId={providerSubscriptionId}
            payAmount={amountDueToday ?? price.amount}
            switchError={periodSwitchError}
            onEmailChange={setEmail}
            onNameChange={setName}
          />
        </Elements>
      </div>
    </div>
  );
}
