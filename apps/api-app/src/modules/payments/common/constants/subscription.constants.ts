/**
 * @fileoverview Subscription metadata keys and changeable status constants.
 */
export const SUBSCRIPTION_METADATA_KEYS = {
  PENDING_DOWNGRADE_PRICE_ID: 'pendingDowngradePriceId',
  PENDING_DOWNGRADE_PROVIDER_PRICE_ID: 'pendingDowngradeProviderPriceId',
  PROVIDER_SCHEDULE_ID: 'providerScheduleId',
  SCHEDULED_PLAN_CHANGE_AT: 'scheduledPlanChangeAt',
} as const;

export const CHANGEABLE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'] as const;
