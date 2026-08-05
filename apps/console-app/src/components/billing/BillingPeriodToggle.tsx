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
}: BillingPeriodToggleProps) {
  if (variant === 'radio') {
    return (
      <div className="overflow-hidden rounded-md border border-[#e6ebf1] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1f36] text-white">
            <CalendarDays size={18} />
          </div>
          <h2 className="text-sm font-medium text-heading">Billing period</h2>
        </div>
        <div className="space-y-0.5" role="radiogroup" aria-label="Billing period">
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
                className={`flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
                <span className="flex flex-1 items-center gap-2 text-sm font-medium text-[#1a1f36]">
                  {getBillingPeriodLabel(period)}
                  {period === 'yearly' && (
                    <span className="rounded-md bg-[#1a1f36] px-2 py-0.5 text-[11px] font-semibold leading-none text-white">
                      Save 50%
                    </span>
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
