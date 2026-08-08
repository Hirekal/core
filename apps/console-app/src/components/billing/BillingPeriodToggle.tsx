/**
 * @fileoverview Billing interval switcher for pricing and checkout.
 */
import { CalendarDays } from 'lucide-react';
import {
  BILLING_PERIODS,
  getBillingPeriodLabel,
  type BillingPeriod,
} from '../../utils/billingFormat';

interface BillingPeriodToggleProps {
  value: BillingPeriod;
  periods?: BillingPeriod[];
  onChange: (period: BillingPeriod) => void;
  variant?: 'pill' | 'radio';
  disabled?: boolean;
  /** Actual % saved vs monthly for each period (e.g. { yearly: 17 }). */
  savingsByPeriod?: Partial<Record<BillingPeriod, number>>;
  /** Radio-variant header title (defaults to "Billing period"). */
  title?: string;
  /** Optional right-side label in the radio header (e.g. plan price). */
  titleRight?: string;
}

/**
 * Renders monthly, quarterly, and yearly billing period options.
 */
export default function BillingPeriodToggle({
  value,
  periods = BILLING_PERIODS,
  onChange,
  variant = 'pill',
  disabled = false,
  savingsByPeriod = {},
  title = 'Billing period',
  titleRight,
}: BillingPeriodToggleProps) {
  const renderSavingsBadge = (
    period: BillingPeriod,
    className: string,
  ) => {
    if (period !== 'yearly') {
      return null;
    }
    const savings = savingsByPeriod[period];
    if (savings == null || savings <= 0) {
      return null;
    }
    return <span className={className}>Save {savings}%</span>;
  };

  if (variant === 'radio') {
    return (
      <div className="overflow-hidden rounded-md border border-[#e6ebf1] bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a1f36] text-white">
            <CalendarDays size={16} />
          </div>
          <h2 className="min-w-0 flex-1 truncate text-base font-medium text-heading">
            {title}
          </h2>
          {titleRight ? (
            <span className="shrink-0 text-base font-medium tabular-nums text-heading">
              {titleRight}
            </span>
          ) : null}
        </div>
        <div className="space-y-0" role="radiogroup" aria-label={title}>
          {periods.map((period) => {
            const isActive = value === period;

            return (
              <button
                key={period}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={disabled}
                onClick={() => onChange(period)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive ? 'bg-[#f6f9fc]' : 'hover:bg-[#f6f9fc]/70'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isActive ? 'border-[#1a1f36]' : 'border-[#e6ebf1]'
                  }`}
                >
                  {isActive && <span className="h-2.5 w-2.5 rounded-full bg-[#1a1f36]" />}
                </span>
                <span className="flex flex-1 items-center gap-2 text-base font-medium text-[#1a1f36]">
                  {getBillingPeriodLabel(period)}
                  {renderSavingsBadge(
                    period,
                    'rounded-md bg-[#1a1f36] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white',
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div
        className="inline-flex items-stretch overflow-hidden rounded-full border border-[#e6ebf1] bg-white shadow-sm"
        role="tablist"
        aria-label="Billing period"
      >
        {periods.map((period, index) => {
          const isActive = value === period;

          return (
            <div key={period} className="flex items-stretch">
              {index > 0 && (
                <div className="w-px self-stretch bg-[#e6ebf1]" aria-hidden="true" />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(period)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-accent'
                    : 'font-normal text-[#1a1f36] hover:text-accent/80'
                }`}
              >
                {getBillingPeriodLabel(period)}
                {renderSavingsBadge(
                  period,
                  'rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold leading-none text-white',
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
