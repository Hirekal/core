/**
 * @fileoverview Stripe-style order summary for custom checkout.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatIntervalShort, formatMoney, type BillingPeriod } from '../../utils/billingFormat';
import type { Price, Product, ValidatedCoupon } from '../../types/billing';
import BillingPeriodToggle from './BillingPeriodToggle';
import Button from '../common/Button';

interface CheckoutOrderSummaryProps {
  product: Product;
  price: Price;
  mode?: 'subscribe' | 'upgrade';
  amountDueToday?: number;
  discountAmount?: number;
  discountLabel?: string | null;
  currentProductName?: string | null;
  billingPeriod?: BillingPeriod;
  availablePeriods?: BillingPeriod[];
  onBillingPeriodChange?: (period: BillingPeriod) => void;
  periodSwitching?: boolean;
  appliedCoupon?: ValidatedCoupon | null;
  couponApplying?: boolean;
  couponError?: string;
  onApplyCoupon?: (code: string) => Promise<void> | void;
  onRemoveCoupon?: () => void;
}

/**
 * Renders the left checkout column with plan, coupon, and total details.
 */
export default function CheckoutOrderSummary({
  product,
  price,
  mode = 'subscribe',
  amountDueToday,
  discountAmount = 0,
  discountLabel = null,
  currentProductName = null,
  billingPeriod,
  availablePeriods,
  onBillingPeriodChange,
  periodSwitching = false,
  appliedCoupon = null,
  couponApplying = false,
  couponError = '',
  onApplyCoupon,
  onRemoveCoupon,
}: CheckoutOrderSummaryProps) {
  const isUpgrade = mode === 'upgrade';
  const totalDue = amountDueToday ?? price.amount;
  const discount = Math.max(discountAmount, 0);
  const lineSubtotal = totalDue + discount;

  const [couponInput, setCouponInput] = useState('');
  const [showCouponField, setShowCouponField] = useState(Boolean(appliedCoupon));

  const handleApply = async () => {
    if (!onApplyCoupon || !couponInput.trim()) {
      return;
    }
    await onApplyCoupon(couponInput.trim());
  };

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

      {onApplyCoupon && (
        <div className="mt-6 space-y-3 border-t border-black/10 pt-6">
          {!showCouponField && !appliedCoupon ? (
            <button
              type="button"
              className="text-sm font-medium text-[#635bff] hover:underline"
              onClick={() => setShowCouponField(true)}
            >
              Add promotion code
            </button>
          ) : appliedCoupon ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-heading">{appliedCoupon.promotionCode}</p>
                <p className="text-muted">
                  {appliedCoupon.discountType === 'PERCENTAGE'
                    ? `${appliedCoupon.discountValue}% off`
                    : `${formatMoney(appliedCoupon.discountValue, price.currency)} off`}
                </p>
              </div>
              {onRemoveCoupon && (
                <button
                  type="button"
                  className="text-sm text-muted hover:text-heading"
                  onClick={onRemoveCoupon}
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="Promotion code"
                  className="min-w-0 flex-1 rounded-md border border-[#e6ebf1] bg-white px-3 py-2 text-sm text-heading placeholder:text-[#8898aa] focus:border-[#635bff] focus:outline-none"
                  disabled={couponApplying}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleApply();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={couponApplying || !couponInput.trim()}
                  onClick={() => void handleApply()}
                >
                  {couponApplying ? 'Applying…' : 'Apply'}
                </Button>
              </div>
              {couponError && (
                <p className="text-sm text-[#df1b41]">{couponError}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3 border-t border-black/10 pt-6 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{isUpgrade ? 'Prorated charge' : 'Subtotal'}</span>
          <span className="text-heading">
            {formatMoney(lineSubtotal, price.currency)}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between gap-4 text-[#0d9488]">
            <span>
              Discount
              {discountLabel || appliedCoupon?.promotionCode
                ? ` (${discountLabel || appliedCoupon?.promotionCode})`
                : ''}
            </span>
            <span>-{formatMoney(discount, price.currency)}</span>
          </div>
        )}
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
