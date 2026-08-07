/**
 * @fileoverview Stripe-style order summary for custom checkout.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Tag } from 'lucide-react';
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
  const totalDue =
    amountDueToday != null ? amountDueToday : isUpgrade ? null : price.amount;
  const discount = Math.max(discountAmount, 0);
  const lineSubtotal =
    totalDue == null ? null : Math.max(totalDue + discount, 0);
  const formatAmount = (amount: number | null) =>
    amount == null ? 'Calculating…' : formatMoney(amount, price.currency);
  const couponDiscountLabel =
    appliedCoupon == null
      ? null
      : appliedCoupon.discountType === 'PERCENTAGE'
        ? `${appliedCoupon.discountValue}% off`
        : `${formatMoney(appliedCoupon.discountValue, price.currency)} off`;

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
        {isUpgrade ? (
          <>
            <p className="text-sm text-muted">Upgrade to</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
              {product.name}
            </p>
            <p className="mt-2 text-sm text-muted">
              {formatMoney(price.amount, price.currency)}{' '}
              {formatIntervalShort(price.interval, price.intervalCount ?? 1)
                .replace(/^Per /i, '')
                .toLowerCase()}
              , billed going forward
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Subscribe to</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
              {formatMoney(totalDue ?? price.amount, price.currency)}
            </p>
            <p className="mt-1 text-sm text-muted">
              per{' '}
              {formatIntervalShort(price.interval, price.intervalCount ?? 1)
                .replace(/^Per /i, '')
                .toLowerCase()}
            </p>
          </>
        )}
      </div>

      {onBillingPeriodChange &&
        billingPeriod &&
        availablePeriods &&
        availablePeriods.length > 0 && (
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
            <div className="rounded-md border border-[#99f6e4] bg-[#f0fdfa] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-[#0d9488]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0f766e]">
                      Coupon applied
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-heading">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Tag size={13} className="text-[#0d9488]" aria-hidden />
                        {appliedCoupon.promotionCode}
                      </span>
                      {couponDiscountLabel && (
                        <span className="text-muted">· {couponDiscountLabel}</span>
                      )}
                    </p>
                    {discount > 0 && (
                      <p className="mt-1 text-sm font-medium text-[#0d9488]">
                        You save {formatMoney(discount, price.currency)} today
                      </p>
                    )}
                  </div>
                </div>
                {onRemoveCoupon && (
                  <button
                    type="button"
                    className="shrink-0 text-sm text-muted hover:text-heading"
                    onClick={onRemoveCoupon}
                  >
                    Remove
                  </button>
                )}
              </div>
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

      <div className="mt-6 space-y-3 border-t border-black/10 pt-6 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">{isUpgrade ? 'Prorated charge' : 'Subtotal'}</span>
          <span className="text-heading">{formatAmount(lineSubtotal)}</span>
        </div>
        {discount > 0 && totalDue != null && (
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
          <span>{formatAmount(totalDue)}</span>
        </div>
      </div>

      <p className="mt-auto pt-8 text-xs text-muted">
        Powered by <span className="font-medium text-heading">stripe</span>
      </p>
    </div>
  );
}
