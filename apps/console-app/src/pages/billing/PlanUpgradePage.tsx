/**
 * @fileoverview Plan upgrade checkout with proration preview.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import BillingErrorState from '../../components/billing/BillingErrorState';
import PlanChangeSummary from '../../components/billing/PlanChangeSummary';
import PaymentMethodCard from '../../components/billing/PaymentMethodCard';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { PaymentMethod, PlanChangePreview } from '../../types/billing';

/**
 * Shows prorated upgrade cost and confirms the plan change.
 */
export default function PlanUpgradePage() {
  const { priceId } = useParams();
  const navigate = useNavigate();
  const { showError } = useToast();

  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentProviderId, setPaymentProviderId] = useState<string | null>(null);
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /*
   * Loads upgrade proration preview and validates the selected plan direction.
   */
  const loadPreview = useCallback(async () => {
    try {
      if (!priceId) {
        navigate('/billing/plans', { replace: true });
        return;
      }

      const subscription = await billingService.getMySubscription();
      if (!subscription) {
        navigate('/billing/plans', { replace: true });
        return;
      }

      const planChangePreview = await billingService.previewPlanChange(
        subscription.id,
        priceId,
      );

      if (planChangePreview.direction !== 'upgrade') {
        navigate('/billing/plans', { replace: true });
        return;
      }

      setPreview(planChangePreview);
      setPaymentProviderId(subscription.paymentProviderId);

      const methods = await billingService.getPaymentMethods(
        subscription.paymentProviderId,
      );
      setPaymentMethod(methods.find((method) => method.isDefault) ?? methods[0] ?? null);
    } catch (error) {
      throw error;
    }
  }, [navigate, priceId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadPreview()
      .catch((err) => setError(toUserErrorMessage(err, 'Failed to load upgrade preview')))
      .finally(() => setLoading(false));
  }, [loadPreview]);

  /*
   * Opens Stripe Billing Portal so the user can add or change their default card.
   */
  const handleUpdatePaymentMethod = async () => {
    if (!paymentProviderId) return;

    setUpdatingPaymentMethod(true);
    try {
      const session = await billingService.createBillingPortalSession({
        paymentProviderId: paymentProviderId,
        returnUrl: window.location.href,
      });
      window.location.assign(session.url);
    } catch (err) {
      showError(err, 'Failed to open payment method settings');
      setUpdatingPaymentMethod(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Calculating prorated amount…" />;
  }

  if (error || !preview?.newPlan.product || !preview.currentPlan.product) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BillingErrorState message={error || 'Unable to load upgrade preview.'} />
        <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
          Back to plans
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Upgrade plan"
        description="Review your prorated charge before confirming"
        breadcrumbs={[
          { to: '/billing/plans', label: 'Billing' },
          { label: 'Upgrade' },
        ]}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-heading">Confirm upgrade</h3>
            <p className="mt-2 text-sm text-muted">
              Review the prorated charge below, then continue to checkout to enter
              your card details and complete the upgrade.
            </p>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Payment method for today&apos;s charge
              </p>
              <PaymentMethodCard method={paymentMethod} />
              {paymentProviderId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  disabled={updatingPaymentMethod}
                  onClick={handleUpdatePaymentMethod}
                >
                  {updatingPaymentMethod ? 'Opening…' : 'Use a different card'}
                </Button>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate(`/billing/upgrade/checkout/${priceId}`)}>
                Continue to payment
              </Button>
              <Button variant="secondary" onClick={() => navigate('/billing/plans')}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <PlanChangeSummary
            currentProduct={preview.currentPlan.product}
            currentPrice={preview.currentPlan}
            newProduct={preview.newPlan.product}
            newPrice={preview.newPlan}
            preview={preview.preview}
          />
        </div>
      </div>
    </div>
  );
}
