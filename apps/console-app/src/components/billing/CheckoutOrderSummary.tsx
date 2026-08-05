/**
 * @fileoverview Stripe-style order summary for custom checkout.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatIntervalShort, formatMoney, type BillingPeriod } from '../../utils/billingFormat';
import type { Price, Product } from '../../types/billing';
import BillingPeriodToggle from './BillingPeriodToggle';

interface CheckoutOrderSummaryProps {
  product: Product;
  price: Price;
  mode?: 'subscribe' | 'upgrade';
  amountDueToday?: number;
  currentProductName?: string | null;
  billingPeriod?: BillingPeriod;
  availablePeriods?: BillingPeriod[];
  onBillingPeriodChange?: (period: BillingPeriod) => void;
  periodSwitching?: boolean;
}

/**
 * Renders the left checkout column with plan and total details.
 */
export default function CheckoutOrderSummary({
  product,
  price,
  mode = 'subscribe',
  amountDueToday,
  currentProductName = null,
  billingPeriod,
  availablePeriods,
  onBillingPeriodChange,
  periodSwitching = false,
}: CheckoutOrderSummaryProps) {
  const isUpgrade = mode === 'upgrade';
  const totalDue = amountDueToday ?? price.amount;

  return (
    <div className="flex h-full flex-col bg-[#f6f9fc] px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex items-center gap-3">
        <Link
          to="/billing/plans"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-heading"
          aria-label="Back to plans"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1f36] text-sm font-semibold text-white">
          H
        </div>
        <span className="text-base font-semibold text-heading">Hirekal</span>
      </div>

      <div className="mt-10">
        <p className="text-sm text-muted">{isUpgrade ? 'Upgrade to' : 'Subscribe to'}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
          {formatMoney(totalDue, price.currency)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {isUpgrade
            ? 'Prorated amount due today'
            : `per ${formatIntervalShort(price.interval, price.intervalCount ?? 1).replace('Per ', '').toLowerCase()}`}
        </p>
      </div>

      {!isUpgrade && onBillingPeriodChange && billingPeriod && availablePeriods && (
        <div className="mt-6">
          <BillingPeriodToggle
            variant="radio"
            value={billingPeriod}
            periods={availablePeriods}
            onChange={onBillingPeriodChange}
            disabled={periodSwitching}
          />
        </div>
      )}

      <div className="mt-10 space-y-4 border-t border-black/10 pt-6">
        {isUpgrade && currentProductName && (
          <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted">Current plan</span>
            <span className="font-medium text-heading">{currentProductName}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-heading">{product.name}</p>
            <p className="mt-1 text-sm text-muted">
              {formatIntervalShort(price.interval, price.intervalCount ?? 1)} subscription
            </p>
          </div>
          <p className="text-sm font-medium text-heading">
            {formatMoney(price.amount, price.currency)}
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-3 border-t border-black/10 pt-6 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{isUpgrade ? 'Prorated charge' : 'Subtotal'}</span>
          <span className="text-heading">{formatMoney(totalDue, price.currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-semibold text-heading">
          <span>Total due today</span>
          <span>{formatMoney(totalDue, price.currency)}</span>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted">
        Powered by <span className="font-medium text-heading">stripe</span>
      </p>
    </div>
  );
}
