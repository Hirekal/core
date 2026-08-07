/**
 * @fileoverview Stripe-style order summary for custom checkout.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Loader2 } from 'lucide-react';
import {
  formatIntervalShort,
  formatMoney,
  getProductFeatures,
  type BillingPeriod,
} from '../../utils/billingFormat';
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
  const features = getProductFeatures(product.metadata);

  const handleApply = async () => {
    if (!onApplyCoupon || !couponInput.trim()) {
      return;
    }
    await onApplyCoupon(couponInput.trim());
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#f6f9fc] px-6 py-12 text-base sm:px-8 sm:py-14 lg:px-10 lg:py-16 xl:px-12">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col lg:ml-auto lg:mr-0 lg:max-w-2xl">
      <div className="relative flex items-center gap-2.5">
        <Link
          to="/billing/plans"
          className="absolute right-full top-1/2 mr-1 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-heading"
          aria-label="Back to plans"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1f36] text-base font-semibold text-white">
          H
        </div>
        <span className="text-lg font-semibold text-heading">Hirekal</span>
      </div>

      {isUpgrade ? (
        <div className="mt-5">
          <p className="text-sm text-muted">Upgrade to</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight text-heading">
            {product.name}
          </p>
          <p className="mt-1 text-base text-muted">
            {formatMoney(price.amount, price.currency)}{' '}
            {formatIntervalShort(price.interval, price.intervalCount ?? 1)
              .replace(/^Per /i, '')
              .toLowerCase()}
            , billed going forward
          </p>
        </div>
      ) : null}

      {onBillingPeriodChange &&
        billingPeriod &&
        availablePeriods &&
        availablePeriods.length > 0 && (
        <div className={isUpgrade ? 'mt-4' : 'mt-5'}>
          <BillingPeriodToggle
            variant="radio"
            value={billingPeriod}
            periods={availablePeriods}
            onChange={onBillingPeriodChange}
            disabled={periodSwitching || couponApplying}
          />
        </div>
      )}

      <div className="mt-5 space-y-2 border-t border-black/10 pt-4">
        {isUpgrade && currentProductName && (
          <div className="flex items-start justify-between gap-4 text-base">
            <span className="text-muted">Current plan</span>
            <span className="font-medium text-heading">{currentProductName}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-medium text-heading">{product.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              {formatIntervalShort(price.interval, price.intervalCount ?? 1)} subscription
            </p>
          </div>
          <p className="text-base font-medium text-heading">
            {formatMoney(price.amount, price.currency)}
          </p>
        </div>
      </div>

      {features.length > 0 && (
        <div className="mt-4 border-t border-black/10 pt-4">
          <p className="text-sm font-semibold text-heading">What's included</p>
          <ul className="mt-3 space-y-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                <Check size={16} className="mt-0.5 shrink-0 text-[#635bff]" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onApplyCoupon && (
        <div className="mt-4 space-y-2 border-t border-black/10 pt-4">
          {!showCouponField && !appliedCoupon ? (
            <button
              type="button"
              className="text-base font-medium text-[#635bff] hover:underline"
              onClick={() => setShowCouponField(true)}
            >
              Add promotion code
            </button>
          ) : appliedCoupon ? (
            <div className="space-y-2">
              <div
                className={`rounded-md border border-[#99f6e4] bg-[#f0fdfa] px-3 py-2.5 ${
                  couponApplying ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2
                      size={18}
                      className="shrink-0 text-[#0d9488]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[#0f766e]">
                        Coupon applied
                        <span className="ml-1.5 font-medium text-heading">
                          {appliedCoupon.promotionCode}
                        </span>
                        {couponDiscountLabel && (
                          <span className="ml-1 font-normal text-muted">
                            · {couponDiscountLabel}
                          </span>
                        )}
                      </p>
                      {discount > 0 && (
                        <p className="mt-0.5 text-sm font-medium text-[#0d9488]">
                          You save {formatMoney(discount, price.currency)} today
                        </p>
                      )}
                    </div>
                  </div>
                  {onRemoveCoupon && (
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1.5 text-base text-muted hover:text-heading disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={couponApplying}
                      onClick={onRemoveCoupon}
                    >
                      {couponApplying ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          Removing…
                        </>
                      ) : (
                        'Remove'
                      )}
                    </button>
                  )}
                </div>
              </div>
              {couponError && (
                <p className="text-base text-[#df1b41]">{couponError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                  placeholder="Promotion code"
                  className="min-w-0 flex-1 rounded-md border border-[#e6ebf1] bg-white px-3 py-2.5 text-base text-heading placeholder:text-[#8898aa] focus:border-[#635bff] focus:outline-none"
                  disabled={couponApplying}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleApply();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setCouponInput('');
                      setShowCouponField(false);
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
                  {couponApplying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Applying…
                    </>
                  ) : (
                    'Apply'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={couponApplying}
                  onClick={() => {
                    setCouponInput('');
                    setShowCouponField(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {couponError && (
                <p className="text-base text-[#df1b41]">{couponError}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-base">
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
        <div className="flex items-center justify-between gap-4 pt-1 text-lg font-semibold text-heading">
          <span>Total due today</span>
          <span>{formatAmount(totalDue)}</span>
        </div>
      </div>

      <p className="mt-auto pt-10 text-xs text-muted">
        Powered by{' '}
        <span className="font-medium text-heading">stripe</span>
        <span className="mx-2 text-[#c7cdd6]">|</span>
        <a
          href="https://stripe.com/legal/consumer"
          target="_blank"
          rel="noreferrer"
          className="hover:text-heading"
        >
          Terms
        </a>{' '}
        <a
          href="https://stripe.com/privacy"
          target="_blank"
          rel="noreferrer"
          className="hover:text-heading"
        >
          Privacy
        </a>
      </p>
      </div>
    </div>
  );
}
