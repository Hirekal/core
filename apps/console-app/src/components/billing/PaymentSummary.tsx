/**
 * @fileoverview Checkout billing summary breakdown.
 */
import Card from '../common/Card';
import { formatIntervalShort, formatMoney } from '../../utils/billingFormat';
import type { Price, Product } from '../../types/billing';

interface PaymentSummaryProps {
  product: Product;
  price: Price;
  taxAmount?: number | null;
}

/**
 * Shows selected plan, interval, tax, and total for checkout.
 */
export default function PaymentSummary({ product, price, taxAmount = null }: PaymentSummaryProps) {
  const tax = taxAmount ?? 0;
  const total = price.amount + tax;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-heading">Billing summary</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Plan</dt>
          <dd className="font-medium text-heading">{product.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Billing interval</dt>
          <dd className="font-medium text-heading">{formatIntervalShort(price.interval)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Amount</dt>
          <dd className="font-medium text-heading">
            {formatMoney(price.amount, price.currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Tax</dt>
          <dd className="font-medium text-heading">
            {taxAmount == null ? 'Calculated at payment' : formatMoney(tax, price.currency)}
          </dd>
        </div>
        <div className="border-t border-border pt-3 flex justify-between gap-4">
          <dt className="font-semibold text-heading">Total</dt>
          <dd className="font-semibold text-heading">
            {taxAmount == null
              ? formatMoney(price.amount, price.currency)
              : formatMoney(total, price.currency)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
