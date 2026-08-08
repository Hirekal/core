/**
 * @fileoverview Prorated plan change billing summary.
 */
import Card from '../common/Card';
import { formatIntervalShort, formatMoney } from '../../utils/billingFormat';
import { formatDate } from '../../utils/formatDate';
import type { PlanChangePreview, Price, Product } from '../../types/billing';

interface PlanChangeSummaryProps {
  currentProduct: Product;
  currentPrice: Price;
  newProduct: Product;
  newPrice: Price;
  preview: PlanChangePreview['preview'];
}

/**
 * Shows proration breakdown for an immediate plan upgrade.
 */
export default function PlanChangeSummary({
  currentProduct,
  currentPrice,
  newProduct,
  newPrice,
  preview,
}: PlanChangeSummaryProps) {
  const currency = preview.currency || newPrice.currency;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-heading">Billing summary</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Current plan</dt>
          <dd className="font-medium text-heading">
            {currentProduct.name} · {formatMoney(currentPrice.amount, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">New plan</dt>
          <dd className="font-medium text-heading">
            {newProduct.name} · {formatMoney(newPrice.amount, currency)}
            {preview.prorationCharge > 0 ? (
              <div className="text-xs text-muted">-
                {formatMoney(preview.prorationCharge, currency)} deducted
              </div>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Billing interval</dt>
          <dd className="font-medium text-heading">
            {formatIntervalShort(newPrice.interval, newPrice.intervalCount ?? 1)}
          </dd>
        </div>
        {preview.prorationCredit > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Credit for unused time</dt>
            <dd className="font-medium text-heading">
              -{formatMoney(preview.prorationCredit, currency)}
            </dd>
          </div>
        )}
        {preview.prorationCharge > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Prorated charge for upgrade</dt>
            <dd className="font-medium text-heading">-
              {formatMoney(preview.prorationCharge, currency)}
            </dd>
          </div>
        )}
        <div className="border-t border-border pt-3 flex justify-between gap-4">
          <dt className="font-semibold text-heading">Due today</dt>
          <dd className="font-semibold text-heading">
            {formatMoney(preview.estimatedAmountPayable, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <dt className="text-muted">Next full charge</dt>
          <dd className="text-muted">
            {formatMoney(newPrice.amount, currency)} on {formatDate(preview.currentPeriodEnd)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
