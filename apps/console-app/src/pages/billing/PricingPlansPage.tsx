/**
 * @fileoverview Pricing plans page with subscribe, upgrade, and downgrade actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import PlanCard from '../../components/billing/PlanCard';
import BillingSkeleton from '../../components/billing/BillingSkeleton';
import BillingErrorState from '../../components/billing/BillingErrorState';
import ConfirmationModal from '../../components/billing/ConfirmationModal';
import BillingPeriodToggle from '../../components/billing/BillingPeriodToggle';
import BillingSummaryCard from '../../components/billing/BillingSummaryCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import { persistSubscriptionSession } from '../../utils/billingStorage';
import {
  comparePriceTier,
  formatMoney,
  getBillingPeriodLabel,
  getScheduledPlanChangeAt,
  getScheduledPlanPriceId,
  isBillableSubscription,
  matchesBillingPeriod,
  resolveBillingPeriod,
  type BillingPeriod,
} from '../../utils/billingFormat';
import { formatDate } from '../../utils/formatDate';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { BillingPlan, PaymentMethod, PlanChangePreview, Subscription } from '../../types/billing';

/**
 * Displays catalog plans and handles plan change actions.
 */
export default function PricingPlansPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const checkoutState = location.state as
    | { subscription?: Subscription; subscribed?: boolean }
    | null;

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionPriceId, setActionPriceId] = useState<string | null>(null);
  const [confirmDowngradePlan, setConfirmDowngradePlan] = useState<BillingPlan | null>(null);
  const [confirmUpgradePlan, setConfirmUpgradePlan] = useState<BillingPlan | null>(null);
  const [upgradePreview, setUpgradePreview] = useState<PlanChangePreview | null>(null);
  const [upgradePreviewLoading, setUpgradePreviewLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showChangePlans, setShowChangePlans] = useState(false);
  const subscriptionPeriodSyncedRef = useRef(false);
  const plansSectionRef = useRef<HTMLDivElement>(null);

  /*
   * Loads catalog plans, subscription state, and default payment method.
   */
  const loadData = useCallback(
    async (
      retrySubscription = false,
      fallbackSubscription: Subscription | null = null,
    ) => {
      try {
        const [catalog, latestSubscription] = await Promise.all([
          billingService.getBillingPlans(),
          billingService.getMySubscription(),
        ]);
        setPlans(catalog);

        let resolvedSubscription = isBillableSubscription(latestSubscription)
          ? latestSubscription
          : null;

        if (
          !resolvedSubscription &&
          fallbackSubscription &&
          isBillableSubscription(fallbackSubscription)
        ) {
          resolvedSubscription = fallbackSubscription;
        }

        if (!resolvedSubscription && retrySubscription) {
          for (let attempt = 0; attempt < 5; attempt += 1) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 1000);
            });
            const polledSubscription = await billingService.getMySubscription();
            if (isBillableSubscription(polledSubscription)) {
              resolvedSubscription = polledSubscription;
              break;
            }
          }
        }

        if (resolvedSubscription) {
          setSubscription(resolvedSubscription);
          persistSubscriptionSession(
            resolvedSubscription.id,
            resolvedSubscription.paymentProviderId,
            resolvedSubscription.customerId,
          );

          const methods = await billingService.getPaymentMethods(
            resolvedSubscription.paymentProviderId,
          );
          setPaymentMethod(
            methods.find((method) => method.isDefault) ?? methods[0] ?? null,
          );
        } else {
          setSubscription(null);
          setPaymentMethod(null);
        }
      } catch (error) {
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    const retrySubscription = Boolean(checkoutState?.subscribed);
    const fallbackSubscription = checkoutState?.subscription ?? null;

    setLoading(true);
    setError('');
    loadData(retrySubscription, fallbackSubscription)
      .catch((err) => setError(toUserErrorMessage(err, 'Failed to load pricing plans')))
      .finally(() => setLoading(false));

    if (retrySubscription) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [checkoutState?.subscribed, checkoutState?.subscription, loadData, location.pathname, navigate]);

  const currentPlan = useMemo(() => {
    if (!subscription?.priceId) return null;
    return plans.find((plan) => plan.price.id === subscription.priceId) ?? null;
  }, [plans, subscription?.priceId]);

  useEffect(() => {
    if (subscriptionPeriodSyncedRef.current) {
      return;
    }

    const activePrice = subscription?.price ?? currentPlan?.price;
    if (!activePrice) {
      return;
    }

    const activePeriod = resolveBillingPeriod(
      activePrice.interval,
      activePrice.intervalCount,
    );
    if (activePeriod) {
      setBillingPeriod(activePeriod);
      subscriptionPeriodSyncedRef.current = true;
    }
  }, [subscription?.priceId, subscription?.price, currentPlan?.price]);

  useEffect(() => {
    if (!confirmUpgradePlan || !subscription) {
      setUpgradePreview(null);
      return;
    }

    let cancelled = false;
    setUpgradePreviewLoading(true);
    billingService
      .previewPlanChange(subscription.id, confirmUpgradePlan.price.id)
      .then((preview) => {
        if (!cancelled) {
          setUpgradePreview(preview);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUpgradePreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUpgradePreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [confirmUpgradePlan, subscription]);

  const visiblePlans = useMemo(
    () =>
      plans
        .filter((plan) => matchesBillingPeriod(plan.price, billingPeriod))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.price.amount - b.price.amount),
    [plans, billingPeriod],
  );

  const subscriptionForDisplay = useMemo(() => {
    if (!subscription) return subscription;

    const matchedPlan =
      currentPlan ?? plans.find((plan) => plan.price.id === subscription.priceId) ?? null;

    if (!matchedPlan) {
      return subscription;
    }

    return {
      ...subscription,
      price: {
        ...matchedPlan.price,
        product: matchedPlan.product,
      },
    };
  }, [subscription, currentPlan, plans]);

  const currentPriceId = subscription?.priceId ?? null;

  /*
   * Resolves the CTA label for a plan card based on current subscription tier.
   */
  const getActionLabel = useCallback(
    (plan: BillingPlan): string => {
      if (!currentPlan?.price) return 'Subscribe';
      const direction = comparePriceTier(currentPlan.price, plan.price);
      if (direction === 'upgrade') return 'Upgrade';
      if (direction === 'downgrade') return 'Downgrade';
      return 'Subscribe';
    },
    [currentPlan],
  );

  /*
   * Applies an immediate upgrade or schedules a downgrade through the billing API.
   */
  const applyPlanChange = async (plan: BillingPlan): Promise<boolean> => {
    if (!subscription || !currentPlan?.price) return false;

    setActionPriceId(plan.price.id);
    try {
      const direction = comparePriceTier(currentPlan.price, plan.price);
      if (direction === 'downgrade') {
        const updated = await billingService.downgradeSubscription(
          subscription.id,
          plan.price.id,
        );
        showSuccess('Downgrade scheduled for the next billing cycle');
        setSubscription(updated);
        persistSubscriptionSession(updated.id, updated.paymentProviderId, updated.customerId);
        return true;
      }
      return false;
    } catch (err) {
      showError(err, 'Failed to change plan');
      return false;
    } finally {
      setActionPriceId(null);
    }
  };

  /*
   * Routes subscribe, upgrade preview, or downgrade actions for a plan card.
   */
  const handlePlanAction = async (plan: BillingPlan) => {
    try {
      if (plan.price.id === currentPriceId) return;

      if (!subscription) {
        navigate(`/billing/checkout/${plan.price.id}`);
        return;
      }

      const activePrice = currentPlan?.price ?? subscription.price;
      if (!activePrice) return;

      const direction = comparePriceTier(activePrice, plan.price);
      if (direction === 'upgrade') {
        setConfirmUpgradePlan(plan);
        return;
      }

      if (direction === 'downgrade') {
        setConfirmDowngradePlan(plan);
        return;
      }

      await applyPlanChange(plan);
    } catch (err) {
      showError(err, 'Failed to change plan');
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!confirmDowngradePlan) return;
    const success = await applyPlanChange(confirmDowngradePlan);
    if (success) {
      setConfirmDowngradePlan(null);
    }
  };

  const handleConfirmUpgrade = () => {
    if (!confirmUpgradePlan) return;
    const priceId = confirmUpgradePlan.price.id;
    setConfirmUpgradePlan(null);
    setUpgradePreview(null);
    navigate(`/billing/upgrade/checkout/${priceId}`);
  };

  const upgradeConfirmMessage = useMemo(() => {
    if (!confirmUpgradePlan || !currentPlan) {
      return '';
    }

    const chargeText = upgradePreview?.preview
      ? `Your card will be charged ${formatMoney(
          upgradePreview.preview.estimatedAmountPayable,
          upgradePreview.preview.currency,
        )} today for the prorated difference.`
      : 'Your card will be charged a prorated amount today.';

    return `You're upgrading from ${currentPlan.product.name} to ${confirmUpgradePlan.product.name}. ${chargeText} You'll enter your card details on the next step to complete the upgrade.`;
  }, [confirmUpgradePlan, currentPlan, upgradePreview]);

  const handleCancel = async () => {
    if (!subscription) return;
    setProcessing(true);
    try {
      const updated = await billingService.cancelSubscription(subscription.id, true);
      setSubscription(updated);
      setCancelOpen(false);
      showSuccess('Subscription will cancel at the end of the billing period');
    } catch (err) {
      showError(err, 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelScheduledChange = async () => {
    if (!subscription) return;
    setProcessing(true);
    try {
      const updated = await billingService.cancelScheduledPlanChange(subscription.id);
      setSubscription(updated);
      showSuccess('Scheduled plan change cancelled');
    } catch (err) {
      showError(err, 'Failed to cancel scheduled change');
    } finally {
      setProcessing(false);
    }
  };

  const scheduledPlanPriceId = getScheduledPlanPriceId(subscription);
  const scheduledPlanChangeAt = getScheduledPlanChangeAt(subscription);
  const scheduledPlan = useMemo(() => {
    if (!scheduledPlanPriceId) return null;
    return plans.find((plan) => plan.price.id === scheduledPlanPriceId) ?? null;
  }, [plans, scheduledPlanPriceId]);

  const headerDescription = useMemo(() => {
    if (!subscription) return 'Choose a plan that fits your hiring needs';
    return 'Compare plans and change your subscription';
  }, [subscription]);

  const planName =
    subscriptionForDisplay?.price?.product?.name ??
    scheduledPlan?.product.name ??
    'your current plan';

  const shouldShowPlans = !subscription || showChangePlans;
  const hidePlanActions = Boolean(subscription?.cancelAtPeriodEnd);

  const handleChangePlan = () => {
    setShowChangePlans((visible) => {
      if (!visible) {
        window.requestAnimationFrame(() => {
          plansSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
      return !visible;
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader title="Pricing Plans" description="Loading plans…" breadcrumbs={[{ to: '/billing/plans', label: 'Billing' }, { label: 'Plans' }]} />
        <div className="mt-8">
          <BillingSkeleton rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Pricing Plans"
        description={headerDescription}
        breadcrumbs={[
          { to: '/billing/plans', label: 'Billing' },
          { label: 'Plans' },
        ]}
      />

      {error && <BillingErrorState message={error} onRetry={() => loadData()} />}

      {subscription && (
        <BillingSummaryCard
          subscription={subscriptionForDisplay}
          paymentMethod={paymentMethod}
          scheduledPlan={scheduledPlan}
          scheduledPlanChangeAt={scheduledPlan ? scheduledPlanChangeAt : null}
          manageable
          processing={processing}
          changePlansVisible={showChangePlans}
          onChangePlan={subscription ? handleChangePlan : undefined}
          onCancel={() => setCancelOpen(true)}
          onCancelScheduledChange={handleCancelScheduledChange}
        />
      )}

      {plans.length === 0 && !error ? (
        <BillingErrorState message="No pricing plans are available yet." />
      ) : shouldShowPlans ? (
        <>
          <div ref={plansSectionRef}>
            <BillingPeriodToggle value={billingPeriod} onChange={setBillingPeriod} />
          </div>

          {visiblePlans.length === 0 ? (
            <BillingErrorState message={`No ${getBillingPeriodLabel(billingPeriod).toLowerCase()} plans are available yet.`} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
            const isCurrent = plan.price.id === currentPriceId;
            const isScheduled = Boolean(
              scheduledPlanPriceId && plan.price.id === scheduledPlanPriceId,
            );
            let scheduleNote: string | null = null;
            if (isCurrent && scheduledPlan && scheduledPlanChangeAt) {
              scheduleNote = `Active until ${formatDate(scheduledPlanChangeAt)}, then switching to ${scheduledPlan.product.name}.`;
            } else if (isScheduled && scheduledPlanChangeAt) {
              scheduleNote = `Starts on ${formatDate(scheduledPlanChangeAt)}. You keep your current plan until then.`;
            }

            return (
              <PlanCard
                key={plan.price.id}
                plan={plan}
                isCurrent={isCurrent}
                isScheduled={isScheduled}
                scheduleNote={scheduleNote}
                actionLabel={getActionLabel(plan)}
                actionDisabled={
                  isCurrent ||
                  isScheduled ||
                  (Boolean(actionPriceId) && actionPriceId !== plan.price.id)
                }
                actionLoading={actionPriceId === plan.price.id}
                hideAction={hidePlanActions}
                onAction={() => handlePlanAction(plan)}
              />
            );
          })}
            </div>
          )}
        </>
      ) : null}

      {!subscription && !loading && plans.length > 0 && (
        <p className="text-center text-sm text-muted">
          Signed in as {user?.email}. Select a plan to continue to checkout.
        </p>
      )}

      <ConfirmationModal
        isOpen={Boolean(confirmUpgradePlan)}
        title="Upgrade plan"
        message={upgradeConfirmMessage}
        confirmLabel="Continue to checkout"
        confirmVariant="primary"
        loading={upgradePreviewLoading}
        onConfirm={handleConfirmUpgrade}
        onClose={() => {
          setConfirmUpgradePlan(null);
          setUpgradePreview(null);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(confirmDowngradePlan)}
        title="Downgrade plan"
        message={
          confirmDowngradePlan && currentPlan && subscription
            ? `You're switching from ${currentPlan.product.name} to ${confirmDowngradePlan.product.name}. The downgrade takes effect on ${formatDate(subscription.currentPeriodEnd)}. You'll keep your current plan and features until then.`
            : ''
        }
        confirmLabel="Schedule downgrade"
        confirmVariant="primary"
        loading={Boolean(actionPriceId)}
        onConfirm={handleConfirmDowngrade}
        onClose={() => setConfirmDowngradePlan(null)}
      />

      <ConfirmationModal
        isOpen={cancelOpen}
        title="Cancel subscription"
        message={`Your ${planName} subscription will remain active until ${formatDate(subscription?.currentPeriodEnd ?? '')}. After that date, you will lose access to paid features. You can resume anytime before then.`}
        confirmLabel="Cancel at period end"
        loading={processing}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
