/**
 * @fileoverview Payments HTTP endpoints.
 */
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/common/decorators/auth.decorator';
import { CurrentUser } from '../auth/common/decorators/current-user.decorator';
import { User } from '../auth/users/entities/user.entity';
import { PaymentsService } from './payments.service';
import { PaymentCustomersService } from './payment-customers/payment-customers.service';
import { CreatePaymentCustomerDto } from './payment-customers/dto/create-payment-customer.dto';
import { CreateCheckoutSessionDto } from './common/dto/create-checkout-session.dto';
import { CreateBillingPortalSessionDto } from './common/dto/create-billing-portal-session.dto';
import { AttachPaymentMethodDto } from './common/dto/attach-payment-method.dto';

@ApiTags('Payments')
@Auth()
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentCustomersService: PaymentCustomersService,
  ) {}

  /*
   * Creates or links a payment provider customer for the authenticated user.
   */
  @Post('customers')
  @ApiOperation({ summary: 'Create payment customer' })
  async createCustomer(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentCustomerDto,
  ) {
    try {
      return await this.paymentsService.createCustomer(user.id, dto);
    } catch (error) {
      this.logger.error(`createCustomer failed for user ${user.id}`, error);
      throw error;
    }
  }

  /*
   * Returns the authenticated user's payment customer record for a provider.
   */
  @Get('customers/me')
  @ApiOperation({ summary: 'Get my payment customer' })
  @ApiQuery({ name: 'paymentProviderId', format: 'uuid' })
  async getMyCustomer(
    @CurrentUser() user: User,
    @Query('paymentProviderId', ParseUUIDPipe) paymentProviderId: string,
  ) {
    try {
      return await this.paymentCustomersService.findByUserAndPaymentProviderId(
        user.id,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(`getMyCustomer failed for user ${user.id}`, error);
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
  @ApiOperation({ summary: 'Create embedded checkout session' })
  async createCheckout(
    @CurrentUser() user: User,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    try {
      return await this.paymentsService.createCheckoutSession(user.id, dto);
    } catch (error) {
      this.logger.error(`createCheckout failed for user ${user.id}`, error);
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
        user.id,
        sessionId,
      );
    } catch (error) {
      this.logger.error(
        `getCheckoutSession failed for user ${user.id}, session ${sessionId}`,
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
        user.id,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `createBillingPortal failed for user ${user.id}`,
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
      return await this.paymentsService.attachPaymentMethod(user.id, dto);
    } catch (error) {
      this.logger.error(
        `attachPaymentMethod failed for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Lists saved payment methods for the authenticated user and provider.
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
        user.id,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(`listPaymentMethods failed for user ${user.id}`, error);
      throw error;
    }
  }

  /*
   * Lists invoices for the authenticated user.
   */
  @Get('invoices/me')
  @ApiOperation({ summary: 'List my invoices' })
  async listMyInvoices(@CurrentUser() user: User) {
    try {
      return await this.paymentsService.listInvoicesForUser(user.id);
    } catch (error) {
      this.logger.error(`listMyInvoices failed for user ${user.id}`, error);
      throw error;
    }
  }

  /*
   * Lists invoices from the payment provider for the authenticated user.
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
        user.id,
        paymentProviderId,
      );
    } catch (error) {
      this.logger.error(`listInvoices failed for user ${user.id}`, error);
      throw error;
    }
  }

  /*
   * Returns a payment customer record by internal ID.
   */
  @Get('customers/:id')
  @ApiOperation({ summary: 'Get payment customer by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.paymentCustomersService.findOne(id);
    } catch (error) {
      this.logger.error(`getCustomer failed for id ${id}`, error);
      throw error;
    }
  }
}
