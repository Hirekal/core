/**
 * @fileoverview Reusable current subscription summary card.
 */
import Button from '../common/Button';
import { useState } from 'react';
import Card from '../common/Card';
import SubscriptionStatusBadge from './SubscriptionStatusBadge';
import ConfirmationModal from './ConfirmationModal';
import {
  formatIntervalShort,
  formatMoney,
} from '../../utils/billingFormat';
import { formatDate } from '../../utils/formatDate';
import type { BillingPlan, PaymentMethod, Subscription } from '../../types/billing';

interface BillingSummaryCardProps {
  subscription: Subscription | null;
  paymentMethod: PaymentMethod | null;
  scheduledPlan?: BillingPlan | null;
  scheduledPlanChangeAt?: string | null;
  manageable?: boolean;
  processing?: boolean;
  changePlansVisible?: boolean;
  onChangePlan?: () => void;
  onCancel?: () => void;
  onResume?: () => void;
  onCancelScheduledChange?: () => void;
}

/**
 * Displays current plan, status, renewal, and payment method overview.
 */
export default function BillingSummaryCard({
  subscription,
  paymentMethod,
  scheduledPlan = null,
  scheduledPlanChangeAt = null,
  manageable = false,
  processing = false,
  changePlansVisible = false,
  onChangePlan,
  onCancel,
  onResume,
  onCancelScheduledChange,
}: BillingSummaryCardProps) {
  if (!subscription?.price?.product) {
    return (
      <Card>
        <p className="text-sm text-muted">No active subscription</p>
      </Card>
    );
  }

  const product = subscription.price.product;
  const price = subscription.price;
  const hasScheduledDowngrade = Boolean(subscription.metadata?.pendingDowngradePriceId);
  const paymentMethodLabel = paymentMethod
    ? `${paymentMethod.brand?.toUpperCase() ?? 'CARD'} ···· ${paymentMethod.last4 ?? '****'}`
    : 'No payment method';
  const showChangePlan = Boolean(onChangePlan) && !subscription.cancelAtPeriodEnd;
  const changePlanDisabled = processing;
  const changePlanLabel = changePlansVisible
    ? 'Hide plans'
    : scheduledPlan
      ? 'Show plans'
      : 'Change plan';
  const showCancelSchedule = Boolean(hasScheduledDowngrade && onCancelScheduledChange);
  const showCancel = Boolean(!subscription.cancelAtPeriodEnd && onCancel);
  const showActions = manageable && (showChangePlan || showCancelSchedule || showCancel);
  const [cancelScheduledOpen, setCancelScheduledOpen] = useState(false);

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-heading">{product.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              {formatMoney(price.amount, price.currency)} ·{' '}
              {formatIntervalShort(price.interval, price.intervalCount ?? 1)}
            </p>
          </div>
          <SubscriptionStatusBadge
            status={subscription.subscriptionStatus}
            cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          />
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">
              {subscription.cancelAtPeriodEnd ? 'Cancels on' : 'Next billing date'}
            </dt>
            <dd className="mt-0.5 font-medium text-heading">
              {formatDate(subscription.currentPeriodEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Payment method</dt>
            <dd className="mt-0.5 font-medium text-heading">{paymentMethodLabel}</dd>
          </div>
        </dl>

        {scheduledPlan && scheduledPlanChangeAt && (
          <p className="mt-3 text-sm text-muted">
            Switching to {scheduledPlan.product.name} on {formatDate(scheduledPlanChangeAt)}.
          </p>
        )}

        {/* When subscription is scheduled to cancel at period end we show that
            information in the billing date row above, so avoid duplicating it here. */}

        {showActions && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {showChangePlan && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={changePlanDisabled}
                  onClick={onChangePlan}
                >
                  {changePlanLabel}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {showCancelSchedule && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={processing}
                  onClick={() => setCancelScheduledOpen(true)}
                >
                  Cancel schedule
                </Button>
              )}
              {showCancel && (
                <Button variant="danger" size="sm" disabled={processing} onClick={onCancel}>
                  Cancel subscription
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
      <ConfirmationModal
        isOpen={cancelScheduledOpen}
        title="Cancel scheduled change"
        message={`Cancel the scheduled plan change to ${scheduledPlan?.product.name ?? 'the new plan'}? Your subscription will remain on the current plan.`}
        confirmLabel="Cancel scheduled change"
        loading={processing}
        onConfirm={() => {
          setCancelScheduledOpen(false);
          if (onCancelScheduledChange) onCancelScheduledChange();
        }}
        onClose={() => setCancelScheduledOpen(false)}
      />
    </>
  );
}
