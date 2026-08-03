/**
 * @fileoverview Maps subscription status values to Badge styling.
 */
import Badge from '../common/Badge';
import { subscriptionBadgeStatus } from '../../utils/billingFormat';

interface SubscriptionStatusBadgeProps {
  status: string;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Displays subscription status with optional scheduled cancellation hint.
 */
export default function SubscriptionStatusBadge({
  status,
  cancelAtPeriodEnd = false,
}: SubscriptionStatusBadgeProps) {
  const label = cancelAtPeriodEnd ? `${status} · Cancels at period end` : status.replace(/_/g, ' ');
  return <Badge status={subscriptionBadgeStatus(status)}>{label}</Badge>;
}
