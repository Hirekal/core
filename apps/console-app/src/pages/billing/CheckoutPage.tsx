/**
 * @fileoverview Embedded Stripe Checkout page using backend session secret.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PaymentSummary from '../../components/billing/PaymentSummary';
import BillingErrorState from '../../components/billing/BillingErrorState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { Price } from '../../types/billing';

/**
 * Renders embedded Stripe Checkout once the backend session is created.
 */
export default function CheckoutPage() {
  const { priceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [price, setPrice] = useState<Price | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(
    null,
  );
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!priceId) {
      navigate('/billing/plans', { replace: true });
      return;
    }

    const loadPrice = async () => {
      try {
        setLoadingPrice(true);
        const loadedPrice = await billingService.getPrice(priceId);
        setPrice(loadedPrice);
      } catch (err) {
        setError(toUserErrorMessage(err, 'Failed to load checkout'));
      } finally {
        setLoadingPrice(false);
      }
    };

    void loadPrice();
  }, [priceId, navigate]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await billingService.getCheckoutConfig();
        setStripePromise(loadStripe(config.publishableKey));
      } catch (err) {
        setError(toUserErrorMessage(err, 'Failed to load checkout'));
      }
    };

    void loadConfig();
  }, []);

  const returnUrl = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  }, []);

  /*
   * Validates checkout contact fields before creating a Stripe session.
   */
  const validate = () => {
    try {
      const errors: { name?: string; email?: string } = {};
      if (!name.trim()) errors.name = 'Name is required';
      if (!email.trim()) errors.email = 'Email is required';
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    } catch (error) {
      return false;
    }
  };

  /*
   * Requests an embedded checkout session from the backend API.
   */
  const handleStartCheckout = async (event?: FormEvent) => {
    event?.preventDefault();
    setError('');
    if (!priceId || !validate()) return;

    setCreatingSession(true);
    try {
      const session = await billingService.createCheckoutSession({
        priceId,
        email: email.trim(),
        name: name.trim(),
        returnUrl,
      });

      if (!session.clientSecret || !session.publishableKey) {
        throw new Error('Checkout session is missing required Stripe configuration');
      }

      if (!stripePromise) {
        setStripePromise(loadStripe(session.publishableKey));
      }

      setClientSecret(session.clientSecret);
    } catch (err) {
      const message = toUserErrorMessage(err, 'Failed to start checkout');
      setError(message);
      showError(err, 'Failed to start checkout');
    } finally {
      setCreatingSession(false);
    }
  };

  if (loadingPrice) {
    return <LoadingSpinner message="Loading checkout…" />;
  }

  if (error && !price?.product) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BillingErrorState message={error} />
        <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
          Back to plans
        </Button>
      </div>
    );
  }

  if (!price?.product) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BillingErrorState message="Selected plan is unavailable." />
        <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
          Back to plans
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Checkout"
        description="Complete your subscription securely"
        breadcrumbs={[
          { to: '/billing/plans', label: 'Plans' },
          { label: 'Checkout' },
        ]}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {!clientSecret ? (
            <form onSubmit={handleStartCheckout} className="space-y-6">
              <Card>
                <h3 className="text-sm font-semibold text-heading">Customer information</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    error={fieldErrors.name}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    error={fieldErrors.email}
                    required
                  />
                </div>
              </Card>

              {error && <BillingErrorState message={error} />}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => navigate('/billing/plans')}
                >
                  Back to plans
                </Button>
                <Button type="submit" disabled={creatingSession || !stripePromise}>
                  {creatingSession ? 'Preparing checkout…' : 'Continue to payment'}
                </Button>
              </div>
            </form>
          ) : (
            stripePromise && (
              <Card padding={false} className="overflow-hidden">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </Card>
            )
          )}
        </div>

        <div className="lg:col-span-2">
          <PaymentSummary product={price.product} price={price} />
        </div>
      </div>
    </div>
  );
}
