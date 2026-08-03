/**
 * @fileoverview Reusable current subscription summary card.
 */
import { CalendarDays, CreditCard } from 'lucide-react';
import Card from '../common/Card';
import SubscriptionStatusBadge from './SubscriptionStatusBadge';
import PaymentMethodCard from './PaymentMethodCard';
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
}

/**
 * Displays current plan, status, renewal, and payment method overview.
 */
export default function BillingSummaryCard({
  subscription,
  paymentMethod,
  scheduledPlan = null,
  scheduledPlanChangeAt = null,
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
  const nextCharge = scheduledPlan?.price ?? price;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current plan</p>
          <p className="mt-1 text-xl font-semibold text-heading">{product.name}</p>
          <p className="mt-1 text-sm text-muted">
            {formatMoney(price.amount, price.currency)} · {formatIntervalShort(price.interval)}
          </p>
        </div>
        <SubscriptionStatusBadge
          status={subscription.subscriptionStatus}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
        />
      </div>

      {scheduledPlan && scheduledPlanChangeAt && (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-heading">Scheduled plan change</p>
          <p className="mt-1 text-muted">
            Switching to {scheduledPlan.product.name} (
            {formatMoney(scheduledPlan.price.amount, scheduledPlan.price.currency)}{' '}
            {formatIntervalShort(scheduledPlan.price.interval).toLowerCase()}) on{' '}
            {formatDate(scheduledPlanChangeAt)}.
          </p>
        </div>
      )}

      {subscription.cancelAtPeriodEnd && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Subscription ends on {formatDate(subscription.currentPeriodEnd)}. No further
          charges after that date.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl bg-surface p-3">
          <CalendarDays size={18} className="mt-0.5 text-accent" />
          <div>
            <p className="text-xs text-muted">Next billing date</p>
            <p className="text-sm font-medium text-heading">
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-surface p-3">
          <CreditCard size={18} className="mt-0.5 text-accent" />
          <div>
            <p className="text-xs text-muted">Next charge</p>
            <p className="text-sm font-medium text-heading">
              {formatMoney(nextCharge.amount, nextCharge.currency)}
            </p>
          </div>
        </div>
      </div>

      <PaymentMethodCard method={paymentMethod} />
    </Card>
  );
}
