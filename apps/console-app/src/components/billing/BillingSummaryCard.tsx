/**
 * @fileoverview Reusable current subscription summary card.
 */
import Button from '../common/Button';
import Card from '../common/Card';
import SubscriptionStatusBadge from './SubscriptionStatusBadge';
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

  return (
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
          <dt className="text-xs text-muted">Next billing date</dt>
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

      {subscription.cancelAtPeriodEnd && (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
          Cancels on {formatDate(subscription.currentPeriodEnd)}.
        </p>
      )}

      {manageable && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            {onChangePlan && (
              <Button variant="secondary" size="sm" disabled={processing} onClick={onChangePlan}>
                Change plan
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {hasScheduledDowngrade && onCancelScheduledChange && (
              <Button
                variant="secondary"
                size="sm"
                disabled={processing}
                onClick={onCancelScheduledChange}
              >
                Cancel schedule
              </Button>
            )}
            {subscription.cancelAtPeriodEnd
              ? onResume && (
                  <Button size="sm" disabled={processing} onClick={onResume}>
                    Resume subscription
                  </Button>
                )
              : onCancel && (
                  <Button variant="danger" size="sm" disabled={processing} onClick={onCancel}>
                    Cancel subscription
                  </Button>
                )}
          </div>
        </div>
      )}
    </Card>
  );
}
