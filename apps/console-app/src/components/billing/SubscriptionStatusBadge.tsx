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
  const label = cancelAtPeriodEnd
    ? 'Cancels at period end'
    : status.replace(/_/g, ' ');
  const badgeStatus = cancelAtPeriodEnd ? 'warning' : subscriptionBadgeStatus(status);

  return <Badge status={badgeStatus}>{label}</Badge>;
}
