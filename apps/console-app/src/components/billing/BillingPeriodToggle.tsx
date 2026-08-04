/**
 * @fileoverview Pill-style billing interval switcher for pricing plans.
 */
import {
  BILLING_PERIODS,
  getBillingPeriodLabel,
  type BillingPeriod,
} from '../../utils/billingFormat';

interface BillingPeriodToggleProps {
  value: BillingPeriod;
  periods?: BillingPeriod[];
  onChange: (period: BillingPeriod) => void;
}

/**
 * Renders monthly, quarterly, and yearly billing period options.
 */
export default function BillingPeriodToggle({
  value,
  periods = BILLING_PERIODS,
  onChange,
}: BillingPeriodToggleProps) {
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
                    ? 'font-semibold text-[#2563eb]'
                    : 'font-normal text-[#1a1f36] hover:text-[#2563eb]/80'
                }`}
              >
                {getBillingPeriodLabel(period)}
                {period === 'yearly' && (
                  <span className="rounded-md bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] px-2 py-0.5 text-[11px] font-semibold leading-none text-white">
                    Save 50%
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
