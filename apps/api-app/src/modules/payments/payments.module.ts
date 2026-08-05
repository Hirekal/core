/**
 * @fileoverview NestJS module wiring for payments.
 */
import {
  DynamicModule,
  InjectionToken,
  Module,
  Provider,
  Type,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PAYMENTS_ENTITIES } from './common/constants/payment.entities';
import {
  PAYMENTS_MODULE_OPTIONS,
  PaymentsModuleOptions,
} from './common/interfaces/payments-module-options.interface';
import { PaymentsController } from './payments.controller';
import { ProductsController } from './products/products.controller';
import { PricesController } from './prices/prices.controller';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { PaymentProvidersController } from './payment-providers/payment-providers.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaymentProvidersService } from './payment-providers/payment-providers.service';
import { PaymentCustomersService } from './payment-customers/payment-customers.service';
import { ProductsService } from './products/products.service';
import { PricesService } from './prices/prices.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { PaymentsRecordService } from './payments-record/payments-record.service';
import { PaymentMethodsService } from './payment-methods/payment-methods.service';
import { InvoicesService } from './invoices/invoices.service';
import { WebhookEventsService } from './webhooks/webhook-events.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import { StripeService } from './providers/stripe/stripe.service';
import { StripeProvider } from './providers/stripe/stripe.provider';
import { StripeWebhookHandler } from './providers/stripe/stripe.webhook';
import { WebhookProcessorService } from './webhooks/webhook-processor.service';
import { CatalogCacheService } from './catalog/catalog-cache.service';
import { User } from '../auth/users/entities/user.entity';

export interface PaymentsModuleAsyncOptions {
  imports?: Array<Type<unknown> | DynamicModule>;
  inject?: unknown[];
  useFactory: (
    ...args: unknown[]
  ) => PaymentsModuleOptions | Promise<PaymentsModuleOptions>;
  global?: boolean;
}

@Module({})
export class PaymentsModule {
  static forRoot(options: PaymentsModuleOptions): DynamicModule {
    return this.forRootAsync({
      useFactory: () => options,
    });
  }

  static forRootAsync(options: PaymentsModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: PAYMENTS_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as InjectionToken[],
    };

    return {
      module: PaymentsModule,
      global: options.global ?? true,
      imports: [
        ...(options.imports ?? []),
        TypeOrmModule.forFeature([...PAYMENTS_ENTITIES, User]),
      ],
      controllers: [
        PaymentsController,
        ProductsController,
        PricesController,
        SubscriptionsController,
        PaymentProvidersController,
        WebhooksController,
      ],
      providers: [
        optionsProvider,
        PaymentsService,
        PaymentProvidersService,
        PaymentCustomersService,
        ProductsService,
        PricesService,
        SubscriptionsService,
        PaymentsRecordService,
        PaymentMethodsService,
        InvoicesService,
        WebhookEventsService,
        PaymentProviderRegistry,
        StripeService,
        StripeProvider,
        StripeWebhookHandler,
        WebhookProcessorService,
        CatalogCacheService,
      ],
      exports: [
        PAYMENTS_MODULE_OPTIONS,
        PaymentsService,
        PaymentProvidersService,
        PaymentCustomersService,
        ProductsService,
        PricesService,
        SubscriptionsService,
        PaymentsRecordService,
        PaymentMethodsService,
        InvoicesService,
        WebhookEventsService,
        PaymentProviderRegistry,
        CatalogCacheService,
        TypeOrmModule,
      ],
    };
  }
}
