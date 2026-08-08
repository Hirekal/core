/**
 * @fileoverview Inline error state with optional retry for billing pages.
 */
import Button from '../common/Button';

interface BillingErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Renders a friendly billing error with an optional retry action.
 */
export default function BillingErrorState({ message, onRetry }: BillingErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
