/**
 * @fileoverview Displays a saved card payment method summary.
 */
import { CreditCard } from 'lucide-react';
import Card from '../common/Card';
import type { PaymentMethod } from '../../types/billing';

interface PaymentMethodCardProps {
  method: PaymentMethod | null;
}

/**
 * Renders default payment method details or an empty placeholder.
 */
export default function PaymentMethodCard({ method }: PaymentMethodCardProps) {
  if (!method) {
    return (
      <Card className="flex items-center gap-3">
        <div className="rounded-lg bg-hover p-2 text-muted">
          <CreditCard size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-heading">No payment method</p>
          <p className="text-xs text-muted">Add a card during checkout</p>
        </div>
      </Card>
    );
  }

  const brand = method.brand ? method.brand.toUpperCase() : 'CARD';
  return (
    <Card className="flex items-center gap-3">
      <div className="rounded-lg bg-accent/10 p-2 text-accent">
        <CreditCard size={18} />
      </div>
      <div>
        <p className="text-sm font-medium text-heading">
          {brand} ···· {method.last4 ?? '****'}
        </p>
        <p className="text-xs text-muted">
          Expires {method.expMonth ?? '--'}/{method.expYear ?? '--'}
          {method.isDefault ? ' · Default' : ''}
        </p>
      </div>
    </Card>
  );
}
