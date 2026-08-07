/**
 * @fileoverview Pricing plan card for the plans grid.
 */
import { Check, Sparkles } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  formatIntervalShort,
  formatMoney,
} from '../../utils/billingFormat';
import type { BillingPlan } from '../../types/billing';

interface PlanCardProps {
  plan: BillingPlan;
  isCurrent: boolean;
  isScheduled?: boolean;
  scheduleNote?: string | null;
  actionLabel: string;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  hideAction?: boolean;
  onAction: () => void;
}

/**
 * Renders a single plan with features and primary action button.
 */
export default function PlanCard({
  plan,
  isCurrent,
  isScheduled = false,
  scheduleNote = null,
  actionLabel,
  actionDisabled = false,
  actionLoading = false,
  hideAction = false,
  onAction,
}: PlanCardProps) {
  const { product, price, features, recommended } = plan;

  return (
    <Card
      className={`relative flex h-full flex-col ${
        recommended && !isCurrent && !isScheduled ? 'border-accent/40 ring-1 ring-accent/20' : ''
      } ${isCurrent ? 'border-accent bg-accent/[0.04] ring-2 ring-accent/30' : ''} ${
        isScheduled ? 'border-accent/50 bg-accent/[0.03] ring-1 ring-accent/20' : ''
      }`}
    >
      {recommended && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge status="success">
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} />
              Popular
            </span>
          </Badge>
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-heading">{product.name}</h3>
            <p className="mt-1 text-sm text-muted">{product.description}</p>
          </div>
          {isCurrent && <Badge status="active">Current</Badge>}
          {isScheduled && <Badge status="success">Scheduled</Badge>}
        </div>

        {isCurrent && scheduleNote && (
          <p className="mt-3 text-xs text-muted">{scheduleNote}</p>
        )}
        {isScheduled && scheduleNote && (
          <p className="mt-3 text-xs text-muted">{scheduleNote}</p>
        )}

        <div className="mt-5">
          <p className="text-3xl font-semibold tabular-nums text-heading">
            {formatMoney(price.amount, price.currency)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatIntervalShort(price.interval, price.intervalCount ?? 1)}
          </p>
        </div>

        <ul className="mt-6 space-y-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-muted">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {!hideAction && (
      <div className="mt-8">
        <Button
          className="w-full"
          variant={recommended && !isCurrent && !isScheduled ? 'primary' : 'secondary'}
          disabled={isCurrent || isScheduled || actionDisabled}
          onClick={onAction}
        >
          {actionLoading
            ? 'Processing…'
            : isCurrent
              ? 'Subscribed'
              : isScheduled
                ? 'Scheduled'
                : actionLabel}
        </Button>
        {isScheduled && (
          <p className="mt-2 text-center text-xs text-muted">
            This plan starts on the scheduled date
          </p>
        )}
      </div>
      )}
    </Card>
  );
}
