/**
 * @fileoverview Entity name constants used by the payments module.
 */
import { PaymentProvider } from '../../payment-providers/entities/payment-provider.entity';
import { PaymentCustomer } from '../../payment-customers/entities/payment-customer.entity';
import { Product } from '../../products/entities/product.entity';
import { Price } from '../../prices/entities/price.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { Payment } from '../../payments-record/entities/payment.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { WebhookEvent } from '../../webhooks/entities/webhook-event.entity';
import { Coupon } from '../../coupons/entities/coupon.entity';
import { CouponRedemption } from '../../coupons/entities/coupon-redemption.entity';

export const PAYMENTS_ENTITIES = [
  PaymentProvider,
  PaymentCustomer,
  Product,
  Price,
  Subscription,
  Payment,
  PaymentMethod,
  Invoice,
  WebhookEvent,
  Coupon,
  CouponRedemption,
];
