/**
 * @fileoverview Custom two-column checkout page styled like Stripe Checkout.
 */
import { useEffect, useState } from 'react';
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
import type { Price } from '../../types/billing';

/**
 * Renders a custom checkout layout with plan summary and payment form.
 */
export default function CheckoutPage() {
  const { priceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [price, setPrice] = useState<Price | null>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [providerSubscriptionId, setProviderSubscriptionId] = useState<string | null>(
    null,
  );
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        const [loadedPrice, checkoutSession] = await Promise.all([
          billingService.getPrice(priceId),
          billingService.createCheckoutSession({
            priceId,
            email: user.email,
            name: user.name ?? undefined,
          }),
        ]);

        if (!checkoutSession.clientSecret || !checkoutSession.publishableKey) {
          throw new Error('Checkout is missing required Stripe configuration');
        }

        if (!cancelled) {
          setPrice(loadedPrice);
          setEmail(user.email);
          setName(user.name ?? '');
          setClientSecret(checkoutSession.clientSecret);
          setProviderSubscriptionId(checkoutSession.providerSubscriptionId);
          setStripePromise(loadStripe(checkoutSession.publishableKey));
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
  }, [navigate, priceId, user]);

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
        <CheckoutOrderSummary product={price.product} price={price} />
        <Elements stripe={stripePromise}>
          <CheckoutPaymentForm
            price={price}
            email={email}
            name={name}
            clientSecret={clientSecret}
            providerSubscriptionId={providerSubscriptionId}
            onEmailChange={setEmail}
            onNameChange={setName}
          />
        </Elements>
      </div>
    </div>
  );
}
