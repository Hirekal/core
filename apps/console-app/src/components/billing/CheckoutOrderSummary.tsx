/**
 * @fileoverview Stripe-style order summary for custom checkout.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import {
  formatIntervalShort,
  formatMoney,
  computeCouponDiscountedAmount,
  type BillingPeriod,
} from '../../utils/billingFormat';
import type { Price, Product, ValidatedCoupon } from '../../types/billing';
import BillingPeriodToggle from './BillingPeriodToggle';

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
  savingsByPeriod?: Partial<Record<BillingPeriod, number>>;
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
  billingPeriod,
  availablePeriods,
  onBillingPeriodChange,
  periodSwitching = false,
  appliedCoupon = null,
  couponApplying = false,
  couponError = '',
  onApplyCoupon,
  onRemoveCoupon,
  savingsByPeriod,
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

  // Prefer parent-provided discount. On upgrade, never invent savings from
  // catalog plan price — coupons apply to today's prorated payable.
  const couponSaveToday = (() => {
    if (!appliedCoupon) {
      return 0;
    }
    if (discount > 0) {
      return discount;
    }
    if (totalDue != null && lineSubtotal != null && lineSubtotal > totalDue) {
      return lineSubtotal - totalDue;
    }
    if (isUpgrade) {
      return 0;
    }
    return Math.max(
      price.amount - computeCouponDiscountedAmount(price.amount, appliedCoupon),
      0,
    );
  })();

  const [couponInput, setCouponInput] = useState('');
  const [showCouponField, setShowCouponField] = useState(false);

  useEffect(() => {
    if (appliedCoupon) {
      setCouponInput('');
      setShowCouponField(false);
    }
  }, [appliedCoupon]);

  const handleApply = async () => {
    if (!onApplyCoupon || !couponInput.trim()) {
      return;
    }
    // Coupons are case-insensitive; normalize before validate/apply.
    await onApplyCoupon(couponInput.trim().toUpperCase());
  };

  const toggleCouponAccordion = () => {
    setShowCouponField((current) => {
      if (current) {
        setCouponInput('');
      }
      return !current;
    });
  };

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#f6f9fc] px-6 py-12 text-base sm:px-8 sm:py-14 lg:px-16 lg:py-16 xl:px-20">
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

      {onBillingPeriodChange &&
        billingPeriod &&
        availablePeriods &&
        availablePeriods.length > 0 && (
        <div className="mt-5">
          <BillingPeriodToggle
            variant="radio"
            value={billingPeriod}
            periods={availablePeriods}
            onChange={onBillingPeriodChange}
            disabled={periodSwitching || couponApplying}
            savingsByPeriod={savingsByPeriod}
            title={product.name}
            titleRight={formatMoney(price.amount, price.currency)}
          />
        </div>
      )}

      {!(onBillingPeriodChange && billingPeriod && availablePeriods?.length) ? (
        <div className="mt-5 space-y-2 border-t border-black/10 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-medium text-heading">{product.name}</p>
              <p className="mt-0.5 text-sm text-muted">
                {formatIntervalShort(price.interval, price.intervalCount ?? 1)}{' '}
                subscription
              </p>
            </div>
            <p className="text-base font-medium text-heading">
              {formatMoney(price.amount, price.currency)}
            </p>
          </div>
        </div>
      ) : null}

      {onApplyCoupon && (
        <div className="mt-4 space-y-2 border-t border-black/10 pt-4">
          {appliedCoupon ? (
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
                      {couponSaveToday > 0 && (
                        <p className="mt-0.5 text-sm font-medium text-[#0d9488]">
                          You save {formatMoney(couponSaveToday, price.currency)} today
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
            <div>
              <button
                type="button"
                id="checkout-coupon-trigger"
                className="inline-flex items-center gap-1.5 text-left text-base font-medium text-[#635bff] hover:underline"
                aria-expanded={showCouponField}
                aria-controls="checkout-coupon-panel"
                onClick={toggleCouponAccordion}
              >
                <span>Apply coupon</span>
                <ChevronRight
                  size={18}
                  aria-hidden
                  className={`shrink-0 text-[#635bff] transition-transform duration-200 ease-out ${
                    showCouponField ? 'rotate-90' : 'rotate-0'
                  }`}
                />
              </button>

              <div
                id="checkout-coupon-panel"
                role="region"
                aria-labelledby="checkout-coupon-trigger"
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  showCouponField ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div
                  className={
                    showCouponField ? 'overflow-visible' : 'overflow-hidden'
                  }
                >
                  <div className="space-y-1.5 pt-3">
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value)}
                        placeholder="Coupon code"
                        className="min-w-0 flex-1 rounded-md border border-[#e6ebf1] bg-white px-3 py-2.5 text-base leading-normal text-heading placeholder:text-[#8898aa] focus:border-[#e6ebf1] focus:outline-none"
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
                      <button
                        type="button"
                        disabled={couponApplying || !couponInput.trim()}
                        className="inline-flex h-auto shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-white px-4 py-2.5 text-base font-medium leading-normal text-heading transition-colors hover:bg-[#f6f9fc] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-base text-[#df1b41]">{couponError}</p>
                    )}
                  </div>
                </div>
              </div>
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

      {/* Temporarily hidden
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
      */}
      </div>
    </div>
  );
}
