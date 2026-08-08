/**
 * @fileoverview Payments HTTP endpoints.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/common/decorators/auth.decorator';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { SYSTEM_ROLES } from '../auth/common/constants/auth.constants';
import { User } from '../auth/users/entities/user.entity';
import { PaymentsService } from './payments.service';
import { PaymentCustomersService } from './payment-customers/payment-customers.service';
import { CreatePaymentCustomerDto } from './payment-customers/dto/create-payment-customer.dto';
import { UpdatePaymentCustomerDto } from './payment-customers/dto/update-payment-customer.dto';
import { CreateCheckoutSessionDto } from './common/dto/create-checkout-session.dto';
import { CreateBillingPortalSessionDto } from './common/dto/create-billing-portal-session.dto';
import { AttachPaymentMethodDto } from './common/dto/attach-payment-method.dto';
import { SyncCheckoutSubscriptionDto } from './common/dto/sync-checkout-subscription.dto';
import { CatalogCacheService } from './catalog/catalog-cache.service';
import { ERROR_MESSAGES } from './common/messages/payment.messages';

@ApiTags('Payments')
@Auth(SYSTEM_ROLES.ADMIN)
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly catalogCacheService: CatalogCacheService,
  ) {}

  /*
   * Creates or links a payment provider customer for the authenticated organization.
   */
  @Post('customers')
  @ApiOperation({ summary: 'Create payment customer' })
  async createCustomer(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentCustomerDto,
  ) {
    try {
      return await this.paymentsService.createCustomer(
        user.organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `createCustomer failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Returns the authenticated organization's payment customer record for a provider.
   */
  @Get('customers/me')
  @ApiOperation({ summary: 'Get my payment customer' })
  @ApiQuery({ name: 'paymentProviderId', format: 'uuid' })
  async getMyCustomer(
    @CurrentUser() user: User,
    @Query('paymentProviderId', ParseUUIDPipe) paymentProviderId: string,
  ) {
    try {
      return await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
        user.organizationId,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(
        `getMyCustomer failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Updates the authenticated organization's payment customer for a provider.
   */
  @Patch('customers/me')
  @ApiOperation({ summary: 'Update my payment customer' })
  @ApiQuery({ name: 'paymentProviderId', format: 'uuid' })
  async updateMyCustomer(
    @CurrentUser() user: User,
    @Query('paymentProviderId', ParseUUIDPipe) paymentProviderId: string,
    @Body() dto: UpdatePaymentCustomerDto,
  ) {
    try {
      const customer =
        await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
          user.organizationId,
          paymentProviderId,
        );
      if (!customer) {
        throw new ForbiddenException(ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND);
      }

      return await this.paymentCustomersService.update(customer.id, dto);
    } catch (error) {
      this.logger.error(
        `updateMyCustomer failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Returns Stripe publishable key and config for embedded checkout.
   */
  @Get('checkout/config')
  @ApiOperation({ summary: 'Get embedded checkout config' })
  getCheckoutConfig() {
    try {
      return this.paymentsService.getCheckoutConfig();
    } catch (error) {
      this.logger.error('getCheckoutConfig failed', error);
      throw error;
    }
  }

  /*
   * Creates an embedded checkout session returning client secret and publishable key.
   */
  @Post('checkout')
  @ApiOperation({ summary: 'Create checkout payment intent for custom checkout UI' })
  async createCheckout(
    @CurrentUser() user: User,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    try {
      return await this.paymentsService.createCheckoutSession(
        user.organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `createCheckout failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Syncs local subscription state after custom checkout payment succeeds.
   */
  @Post('checkout/sync')
  @ApiOperation({ summary: 'Sync subscription after custom checkout payment' })
  async syncCheckoutSubscription(
    @CurrentUser() user: User,
    @Body() dto: SyncCheckoutSubscriptionDto,
  ) {
    try {
      return await this.paymentsService.syncCheckoutSubscription(
        user.organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `syncCheckoutSubscription failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Returns checkout session completion status and linked subscription if synced.
   */
  @Get('checkout/session')
  @ApiOperation({ summary: 'Get checkout session status' })
  @ApiQuery({ name: 'session_id', required: true })
  async getCheckoutSession(
    @CurrentUser() user: User,
    @Query('session_id') sessionId: string,
  ) {
    try {
      return await this.paymentsService.getCheckoutSessionStatus(
        user.organizationId,
        sessionId,
      );
    } catch (error) {
      this.logger.error(
        `getCheckoutSession failed for organization ${user.organizationId}, session ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Opens the provider billing portal so the user can manage payment details.
   */
  @Post('billing-portal')
  @ApiOperation({ summary: 'Create billing portal session' })
  async createBillingPortal(
    @CurrentUser() user: User,
    @Body() dto: CreateBillingPortalSessionDto,
  ) {
    try {
      return await this.paymentsService.createBillingPortalSession(
        user.organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `createBillingPortal failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Attaches a provider payment method and sets it as the customer default.
   */
  @Post('payment-methods')
  @ApiOperation({ summary: 'Attach payment method' })
  async attachPaymentMethod(
    @CurrentUser() user: User,
    @Body() dto: AttachPaymentMethodDto,
  ) {
    try {
      return await this.paymentsService.attachPaymentMethod(
        user.organizationId,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `attachPaymentMethod failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Lists saved payment methods for the authenticated organization and provider.
   */
  @Get('payment-methods')
  @ApiOperation({ summary: 'List payment methods' })
  @ApiQuery({ name: 'paymentProviderId', format: 'uuid' })
  async listPaymentMethods(
    @CurrentUser() user: User,
    @Query('paymentProviderId', ParseUUIDPipe) paymentProviderId: string,
  ) {
    try {
      return await this.paymentsService.listPaymentMethods(
        user.organizationId,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(
        `listPaymentMethods failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Lists invoices for the authenticated organization.
   */
  @Get('invoices/me')
  @ApiOperation({ summary: 'List my invoices' })
  async listMyInvoices(@CurrentUser() user: User) {
    try {
      return await this.paymentsService.listInvoicesForOrganization(
        user.organizationId,
      );
    } catch (error) {
      this.logger.error(
        `listMyInvoices failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Lists invoices from the payment provider for the authenticated organization.
   */
  @Get('invoices')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'paymentProviderId', format: 'uuid' })
  async listInvoices(
    @CurrentUser() user: User,
    @Query('paymentProviderId', ParseUUIDPipe) paymentProviderId: string,
  ) {
    try {
      return await this.paymentsService.listInvoices(
        user.organizationId,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(
        `listInvoices failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Clears in-memory product and price list cache.
   */
  @Post('catalog/cache/clear')
  @ApiOperation({ summary: 'Clear payment catalog cache' })
  clearCatalogCache() {
    try {
      this.catalogCacheService.invalidateAll();
      return { cleared: true };
    } catch (error) {
      this.logger.error('clearCatalogCache failed', error);
      throw error;
    }
  }

  /*
   * Returns a payment customer record by internal ID.
   */
  @Get('customers/:id')
  @ApiOperation({ summary: 'Get payment customer by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getCustomer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      const customer = await this.paymentCustomersService.findOne(id);
      if (customer.organizationId !== user.organizationId) {
        throw new ForbiddenException(ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND);
      }
      return customer;
    } catch (error) {
      this.logger.error(`getCustomer failed for id ${id}`, error);
      throw error;
    }
  }
}
