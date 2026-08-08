/**
 * @fileoverview Checkout failed or cancelled page.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

/**
 * Displays payment failure messaging with retry and back actions.
 */
export default function CheckoutFailedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { message?: string; priceId?: string } | null) ?? {};
  const message = state.message ?? 'Your payment was cancelled or could not be completed.';

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Payment failed" description="We could not complete your checkout" />

      <Card className="mt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <XCircle size={28} />
        </div>
        <p className="mt-4 text-sm text-muted">{message}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {state.priceId ? (
            <Button onClick={() => navigate(`/billing/checkout/${state.priceId}`)}>
              Retry payment
            </Button>
          ) : (
            <Button onClick={() => navigate('/billing/plans')}>Retry payment</Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
            Back to plans
          </Button>
        </div>
      </Card>
    </div>
  );
}
