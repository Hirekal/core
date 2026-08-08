/**
 * @fileoverview Subscription management page with cancel and resume actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import BillingSummaryCard from '../../components/billing/BillingSummaryCard';
import BillingErrorState from '../../components/billing/BillingErrorState';
import ConfirmationModal from '../../components/billing/ConfirmationModal';
import SubscriptionStatusBadge from '../../components/billing/SubscriptionStatusBadge';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import {
  readBillingSession,
  persistSubscriptionSession,
} from '../../utils/billingStorage';
import { formatDate } from '../../utils/formatDate';
import { formatIntervalShort, getScheduledPlanChangeAt, getScheduledPlanPriceId } from '../../utils/billingFormat';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { BillingPlan, PaymentMethod, Subscription } from '../../types/billing';

/**
 * Displays subscription details and lifecycle management actions.
 */
export default function ManageSubscriptionPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [scheduledPlan, setScheduledPlan] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false);

  /*
   * Loads subscription details and the default saved payment method.
   */
  const loadData = useCallback(async () => {
    try {
      let sub = await billingService.getMySubscription();

      if (!sub) {
        const session = readBillingSession();
        if (session.subscriptionId) {
          try {
            sub = await billingService.getSubscription(session.subscriptionId);
          } catch {
            sub = null;
          }
        }
      }

      if (!sub) {
        setSubscription(null);
        return;
      }

      setSubscription(sub);
      persistSubscriptionSession(sub.id, sub.paymentProviderId, sub.customerId);

      const scheduledPriceId = getScheduledPlanPriceId(sub);
      const [methods, scheduledPrice] = await Promise.all([
        billingService.getPaymentMethods(sub.paymentProviderId),
        scheduledPriceId
          ? billingService.getPrice(scheduledPriceId)
          : Promise.resolve(null),
      ]);
      setPaymentMethod(
        methods.find((method) => method.isDefault) ?? methods[0] ?? null,
      );

      if (scheduledPrice) {
        setScheduledPlan({
          product: scheduledPrice.product!,
          price: scheduledPrice,
          features: [],
          recommended: false,
          sortOrder: 0,
        });
      } else {
        setScheduledPlan(null);
      }
    } catch (error) {
      throw error;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadData()
      .catch((err) => setError(toUserErrorMessage(err, 'Failed to load subscription')))
      .finally(() => setLoading(false));
  }, [loadData]);

  /*
   * Schedules cancellation at the end of the current billing period.
   */
  const handleCancel = async () => {
    if (!subscription) return;
    setProcessing(true);
    try {
      const updated = await billingService.cancelSubscription(subscription.id, true);
      setSubscription(updated);
      setCancelOpen(false);
      showSuccess('Subscription will cancel at the end of the billing period');
    } catch (err) {
      showError(err, 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  /*
   * Cancels a pending scheduled downgrade before it takes effect.
   */
  const handleCancelScheduledChange = async () => {
    if (!subscription) return;
    setProcessing(true);
    try {
      const updated = await billingService.cancelScheduledPlanChange(subscription.id);
      setSubscription(updated);
      showSuccess('Scheduled plan change cancelled');
    } catch (err) {
      showError(err, 'Failed to cancel scheduled change');
    } finally {
      setProcessing(false);
    }
  };

  /*
   * Opens Stripe Billing Portal to update the default payment method.
   */
  const handleUpdatePaymentMethod = async () => {
    if (!subscription) return;

    setUpdatingPaymentMethod(true);
    try {
      const session = await billingService.createBillingPortalSession({
        paymentProviderId: subscription.paymentProviderId,
        returnUrl: window.location.href,
      });
      window.location.assign(session.url);
    } catch (err) {
      showError(err, 'Failed to open payment method settings');
      setUpdatingPaymentMethod(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading subscription…" />;
  }

  if (!subscription) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="Subscription" description="Manage your billing subscription" breadcrumbs={[{ to: '/billing/plans', label: 'Billing' }, { label: 'Subscription' }]} />
        <BillingErrorState message={error || 'You do not have a subscription yet.'} />
        <Button onClick={() => navigate('/billing/plans')}>View pricing plans</Button>
      </div>
    );
  }

  const isEnded =
    subscription.subscriptionStatus === 'CANCELED' ||
    subscription.subscriptionStatus === 'INCOMPLETE' ||
    subscription.subscriptionStatus === 'UNPAID';

  const hasScheduledDowngrade = Boolean(
    subscription.metadata?.pendingDowngradePriceId,
  );
  const planName =
    subscription.price?.product?.name ??
    scheduledPlan?.product.name ??
    'your current plan';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader
        title="Subscription"
        description="Manage your plan, billing cycle, and renewal"
        breadcrumbs={[
          { to: '/billing/plans', label: 'Billing' },
          { label: 'Subscription' },
        ]}
        actions={
          <SubscriptionStatusBadge
            status={subscription.subscriptionStatus}
            cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          />
        }
      />

      {error && <BillingErrorState message={error} onRetry={loadData} />}

      {subscription.cancelAtPeriodEnd && !isEnded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Your subscription is scheduled to cancel on{' '}
          {formatDate(subscription.currentPeriodEnd)}.
        </div>
      )}

      {isEnded && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          This subscription ended
          {subscription.canceledAt
            ? ` on ${formatDate(subscription.canceledAt)}`
            : subscription.currentPeriodEnd
              ? ` on ${formatDate(subscription.currentPeriodEnd)}`
              : ''}
          . Choose a new plan to subscribe again.
        </div>
      )}

      {hasScheduledDowngrade && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          A plan downgrade is scheduled for the next billing cycle.
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            disabled={processing}
            onClick={handleCancelScheduledChange}
          >
            Cancel scheduled change
          </Button>
        </div>
      )}

      <BillingSummaryCard
        subscription={subscription}
        paymentMethod={paymentMethod}
        scheduledPlan={scheduledPlan}
        scheduledPlanChangeAt={
          scheduledPlan ? getScheduledPlanChangeAt(subscription) : null
        }
      />

      {!isEnded && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={updatingPaymentMethod}
            onClick={handleUpdatePaymentMethod}
          >
            {updatingPaymentMethod ? 'Opening…' : 'Update payment method'}
          </Button>
        </div>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-heading">Subscription details</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted">Billing cycle</dt>
            <dd className="mt-1 font-medium text-heading">
              {formatIntervalShort(
                subscription.price?.interval ?? null,
                subscription.price?.intervalCount ?? 1,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Subscription start</dt>
            <dd className="mt-1 font-medium text-heading">
              {formatDate(subscription.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Renewal date</dt>
            <dd className="mt-1 font-medium text-heading">
              {formatDate(subscription.currentPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Next billing date</dt>
            <dd className="mt-1 font-medium text-heading">
              {formatDate(subscription.currentPeriodEnd)}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {isEnded ? (
          <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
            Subscribe again
          </Button>
        ) : !subscription.cancelAtPeriodEnd ? (
          <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
            {scheduledPlan ? 'Show plans' : 'Change plan'}
          </Button>
        ) : null}
        {!isEnded && !subscription.cancelAtPeriodEnd && (
            <Button variant="danger" disabled={processing} onClick={() => setCancelOpen(true)}>
              Cancel subscription
            </Button>
          )}
        <Button variant="ghost" onClick={() => navigate('/payments')}>
          View payments
        </Button>
      </div>

      <ConfirmationModal
        isOpen={cancelOpen}
        title="Cancel subscription"
        message={`Your ${planName} subscription will remain active until ${formatDate(
          subscription.currentPeriodEnd,
        )}. After that date, you will lose access to paid features.`}
        confirmLabel="Cancel at period end"
        loading={processing}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
