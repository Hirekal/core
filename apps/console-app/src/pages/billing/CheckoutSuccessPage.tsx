/**
 * @fileoverview Checkout success confirmation page.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/formatDate';
import { formatIntervalShort, formatMoney } from '../../utils/billingFormat';
import * as billingService from '../../services/billingService';
import { persistSubscriptionSession, readBillingSession } from '../../utils/billingStorage';
import type { Subscription } from '../../types/billing';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 10;

/**
 * Shows payment success details after checkout completes.
 */
export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const storedSubscriptionId = readBillingSession().subscriptionId;

    if (!sessionId && !storedSubscriptionId) {
      navigate('/billing/plans', { replace: true });
      return;
    }

    let attempts = 0;
    let cancelled = false;

    /**
     * Polls checkout session status until the webhook-synced subscription is available.
     */
    const resolveSubscription = async () => {
      if (sessionId) {
        const status = await billingService.getCheckoutSessionStatus(sessionId);
        if (status.subscription) {
          if (!cancelled) {
            setSubscription(status.subscription);
            persistSubscriptionSession(
              status.subscription.id,
              status.subscription.paymentProviderId,
              status.subscription.customerId,
            );
            setLoading(false);
          }
          return true;
        }
      }

      if (storedSubscriptionId) {
        const sub = await billingService.getSubscription(storedSubscriptionId);
        if (!cancelled) {
          setSubscription(sub);
          setLoading(false);
        }
        return true;
      }

      return false;
    };

    const poll = async () => {
      try {
        const resolved = await resolveSubscription();
        if (resolved || cancelled) {
          if (!resolved && !cancelled) {
            setLoading(false);
          }
          return;
        }

        attempts += 1;
        if (attempts < MAX_POLL_ATTEMPTS) {
          window.setTimeout(poll, POLL_INTERVAL_MS);
        } else if (!cancelled) {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  if (loading) {
    return <LoadingSpinner message="Confirming subscription…" />;
  }

  const productName = subscription?.price?.product?.name ?? 'Your plan';

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Payment successful" description="Your subscription is now active" />

      <Card className="mt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-heading">Subscription activated</h2>
        <p className="mt-2 text-sm text-muted">
          You are subscribed to <span className="font-medium text-heading">{productName}</span>
          {subscription?.price &&
            ` at ${formatMoney(subscription.price.amount, subscription.price.currency)} ${formatIntervalShort(subscription.price.interval, subscription.price.intervalCount ?? 1).toLowerCase()}`}
          .
        </p>
        {subscription?.currentPeriodEnd && (
          <p className="mt-2 text-sm text-muted">
            Next billing date:{' '}
            <span className="font-medium text-heading">
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate('/jobs')}>Go to dashboard</Button>
          <Button variant="secondary" onClick={() => navigate('/billing/subscription')}>
            Go to subscription
          </Button>
        </div>
      </Card>
    </div>
  );
}
