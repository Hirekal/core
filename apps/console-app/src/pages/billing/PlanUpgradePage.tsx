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
import { persistSubscriptionSession } from '../../utils/billingStorage';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { PaymentMethod, PlanChangePreview } from '../../types/billing';

/**
 * Shows prorated upgrade cost and confirms the plan change.
 */
export default function PlanUpgradePage() {
  const { priceId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentProviderId, setPaymentProviderId] = useState<string | null>(null);
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
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

      setSubscriptionId(subscription.id);
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

  /*
   * Confirms the prorated upgrade and charges the saved payment method.
   */
  const handleConfirmUpgrade = async () => {
    if (!subscriptionId || !priceId) return;

    setProcessing(true);
    try {
      const updated = await billingService.upgradeSubscription(subscriptionId, priceId);
      persistSubscriptionSession(updated.id, updated.paymentProviderId, updated.customerId);
      showSuccess('Subscription upgraded successfully');
      navigate('/billing/plans', { replace: true, state: { upgraded: true } });
    } catch (err) {
      showError(err, 'Failed to upgrade subscription');
    } finally {
      setProcessing(false);
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
              Prorated upgrades charge your card on file automatically — you do not
              re-enter card details unless you subscribed with a different flow or need
              to update your payment method.
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
                  disabled={processing || updatingPaymentMethod}
                  onClick={handleUpdatePaymentMethod}
                >
                  {updatingPaymentMethod ? 'Opening…' : 'Use a different card'}
                </Button>
              )}
            </div>
            {!paymentMethod && (
              <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                Add a card during initial checkout before upgrading. Subscribe to a plan
                first if you do not have a saved payment method.
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                disabled={processing || !paymentMethod}
                onClick={handleConfirmUpgrade}
              >
                {processing ? 'Processing…' : 'Confirm and pay'}
              </Button>
              <Button variant="secondary" disabled={processing} onClick={() => navigate('/billing/plans')}>
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
