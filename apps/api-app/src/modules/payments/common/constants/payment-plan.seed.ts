/**
 * @fileoverview Default payment plan catalog for database seeding.
 * Edit names, prices, features, and metadata here, then run migrations.
 */
import { PriceInterval } from '../enums/payment.enums';

export interface PaymentPlanPriceSeed {
  /** Stable local key stored in metadata.seedCode. */
  code: string;
  /** Stripe price ID (e.g. price_1ABC...). */
  providerPriceId: string;
  currency: string;
  /** Major currency unit (e.g. 29 = $29.00). */
  amount: number;
  interval: PriceInterval;
  intervalCount?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentPlanProductSeed {
  code: string;
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
  prices: PaymentPlanPriceSeed[];
}

export const PAYMENT_PLAN_SEED: PaymentPlanProductSeed[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'For small teams getting started with structured hiring.',
    metadata: {
      sortOrder: 1,
      recommended: false,
      features: [
        'Up to 3 active jobs',
        '100 applicants per job',
        'Standard pipeline stages',
        'Email notifications',
        'Public apply links',
      ],
    },
    prices: [
      {
        code: 'STARTER_MONTHLY',
        providerPriceId: 'price_1U0IihJCYGyYR7NPLchIpMub',
        currency: 'USD',
        amount: 29,
        interval: PriceInterval.MONTH,
        intervalCount: 1,
        metadata: { billingLabel: 'Billed monthly' },
      },
    ],
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'For growing teams that need automation and collaboration.',
    metadata: {
      sortOrder: 2,
      recommended: true,
      features: [
        'Up to 25 active jobs',
        'Unlimited applicants',
        'Custom pipeline stages',
        'Email automation',
        'Webhook integrations',
        'Team member access',
        'Video application questions',
      ],
    },
    prices: [
      {
        code: 'PROFESSIONAL_MONTHLY',
        providerPriceId: 'price_1U0Ik0JCYGyYR7NPGONUGLy4',
        currency: 'USD',
        amount: 79,
        interval: PriceInterval.MONTH,
        intervalCount: 1,
        metadata: { billingLabel: 'Billed monthly' },
      },
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For organizations with advanced hiring workflows at scale.',
    metadata: {
      sortOrder: 3,
      recommended: false,
      features: [
        'Unlimited active jobs',
        'Unlimited applicants',
        'Advanced pipeline & automation',
        'Priority support',
        'Custom branding',
        'Dedicated onboarding',
        'API access',
      ],
    },
    prices: [
      {
        code: 'ENTERPRISE_MONTHLY',
        providerPriceId: 'price_1U0IkuJCYGyYR7NPbirll4tz',
        currency: 'USD',
        amount: 199,
        interval: PriceInterval.MONTH,
        intervalCount: 1,
        metadata: { billingLabel: 'Billed monthly' },
      },
    ],
  },
];
