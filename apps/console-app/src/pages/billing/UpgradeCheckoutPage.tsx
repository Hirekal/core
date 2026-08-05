/**
 * @fileoverview Custom checkout for prorated plan upgrades.
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
 * Renders upgrade checkout with prorated amount and card entry.
 */
export default function UpgradeCheckoutPage() {
  const { priceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [price, setPrice] = useState<Price | null>(null);
  const [currentProductName, setCurrentProductName] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [amountDue, setAmountDue] = useState<number | null>(null);
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

        const subscription = await billingService.getMySubscription();
        if (!subscription) {
          throw new Error('You need an active subscription before upgrading.');
        }

        const [loadedPrice, planChangePreview, checkoutConfig] = await Promise.all([
          billingService.getPrice(priceId),
          billingService.previewPlanChange(subscription.id, priceId),
          billingService.getCheckoutConfig(),
        ]);

        if (planChangePreview.direction !== 'upgrade') {
          throw new Error('Selected plan is not an upgrade from your current plan.');
        }

        if (!checkoutConfig.publishableKey) {
          throw new Error('Checkout is missing required Stripe configuration');
        }

        if (!cancelled) {
          setPrice(loadedPrice);
          setCurrentProductName(subscription.price?.product?.name ?? null);
          setSubscriptionId(subscription.id);
          setEmail(user.email);
          setName(user.name ?? '');
          setAmountDue(planChangePreview.preview.estimatedAmountPayable);
          setStripePromise(loadStripe(checkoutConfig.publishableKey));
        }
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
    };
  }, [navigate, priceId, user]);

  if (loading) {
    return <LoadingSpinner message="Loading upgrade checkout…" />;
  }

  if (
    error ||
    !price?.product ||
    !stripePromise ||
    !subscriptionId ||
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="overflow-hidden rounded-xl border border-[#e6ebf1] bg-white shadow-sm lg:grid lg:grid-cols-2">
        <CheckoutOrderSummary
          product={price.product}
          price={price}
          mode="upgrade"
          amountDueToday={amountDue}
          currentProductName={currentProductName}
        />
        <Elements stripe={stripePromise}>
          <CheckoutPaymentForm
            price={price}
            email={email}
            name={name}
            payAmount={amountDue}
            successMessage="Subscription upgraded successfully"
            navigationState={{ upgraded: true }}
            prepareCheckout={async () => {
              const checkoutSession =
                await billingService.createUpgradeCheckoutSession(
                  subscriptionId,
                  priceId!,
                );

              if (
                !checkoutSession.clientSecret ||
                !checkoutSession.providerSubscriptionId
              ) {
                throw new Error('Checkout is missing required Stripe configuration');
              }

              return {
                clientSecret: checkoutSession.clientSecret,
                providerSubscriptionId: checkoutSession.providerSubscriptionId,
              };
            }}
            onCheckoutFailed={async () => {
              await billingService.cancelPendingUpgradeCheckout(subscriptionId);
            }}
            onEmailChange={setEmail}
            onNameChange={setName}
          />
        </Elements>
      </div>
    </div>
  );
}
