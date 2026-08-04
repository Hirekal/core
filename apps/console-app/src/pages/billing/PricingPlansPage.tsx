/**
 * @fileoverview Pricing plans page with subscribe, upgrade, and downgrade actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import PlanCard from '../../components/billing/PlanCard';
import BillingSkeleton from '../../components/billing/BillingSkeleton';
import BillingErrorState from '../../components/billing/BillingErrorState';
import BillingPeriodToggle from '../../components/billing/BillingPeriodToggle';
import BillingSummaryCard from '../../components/billing/BillingSummaryCard';
import SubscriptionStatusBadge from '../../components/billing/SubscriptionStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import { persistSubscriptionSession } from '../../utils/billingStorage';
import {
  comparePriceTier,
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
import type { BillingPlan, PaymentMethod, Subscription } from '../../types/billing';

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
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const subscriptionPeriodSyncedRef = useRef(false);

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

  const visiblePlans = useMemo(
    () =>
      plans
        .filter((plan) => matchesBillingPeriod(plan.price, billingPeriod))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.price.amount - b.price.amount),
    [plans, billingPeriod],
  );

  const subscriptionForDisplay = useMemo(() => {
    if (!subscription || !currentPlan) return subscription;
    return {
      ...subscription,
      price: {
        ...currentPlan.price,
        product: currentPlan.product,
      },
    };
  }, [subscription, currentPlan]);

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
  const applyPlanChange = async (plan: BillingPlan) => {
    if (!subscription || !currentPlan?.price) return;

    setActionPriceId(plan.price.id);
    try {
      const direction = comparePriceTier(currentPlan.price, plan.price);
      let updated: Subscription;
      if (direction === 'upgrade') {
        updated = await billingService.upgradeSubscription(subscription.id, plan.price.id);
        showSuccess('Subscription upgraded successfully');
      } else if (direction === 'downgrade') {
        updated = await billingService.downgradeSubscription(subscription.id, plan.price.id);
        showSuccess('Downgrade scheduled for the next billing cycle');
      } else {
        return;
      }
      setSubscription(updated);
      persistSubscriptionSession(updated.id, updated.paymentProviderId, updated.customerId);
    } catch (err) {
      showError(err, 'Failed to change plan');
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
        navigate(`/billing/upgrade/${plan.price.id}`);
        return;
      }

      await applyPlanChange(plan);
    } catch (err) {
      showError(err, 'Failed to change plan');
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader title="Pricing Plans" description="Loading plans…" />
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
          { to: '/jobs', label: 'Jobs' },
          { label: 'Billing' },
          { label: 'Plans' },
        ]}
        actions={
          subscription ? (
            <SubscriptionStatusBadge
              status={subscription.subscriptionStatus}
              cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
            />
          ) : null
        }
      />

      {error && <BillingErrorState message={error} onRetry={() => loadData()} />}

      {subscription && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-heading">Your subscription</h2>
              <p className="mt-1 text-sm text-muted">
                Review billing details and manage your current plan
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/billing/subscription')}
            >
              Manage subscription
            </Button>
          </div>
          <BillingSummaryCard
            subscription={subscriptionForDisplay}
            paymentMethod={paymentMethod}
            scheduledPlan={scheduledPlan}
            scheduledPlanChangeAt={scheduledPlan ? scheduledPlanChangeAt : null}
          />
        </section>
      )}

      {plans.length === 0 && !error ? (
        <BillingErrorState message="No pricing plans are available yet." />
      ) : (
        <>
          <BillingPeriodToggle value={billingPeriod} onChange={setBillingPeriod} />

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
                onAction={() => handlePlanAction(plan)}
              />
            );
          })}
            </div>
          )}
        </>
      )}

      {!subscription && !loading && plans.length > 0 && (
        <p className="text-center text-sm text-muted">
          Signed in as {user?.email}. Select a plan to continue to checkout.
        </p>
      )}
    </div>
  );
}
