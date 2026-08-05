/**
 * @fileoverview Subscription HTTP endpoints.
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
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { SYSTEM_ROLES } from '../../auth/common/constants/auth.constants';
import { User } from '../../auth/users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { SUCCESS_MESSAGES } from '../common/messages/payment.messages';

@ApiTags('Subscriptions')
@Auth(SYSTEM_ROLES.ADMIN)
@Controller('payments/subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /*
   * Creates a subscription for a customer and syncs provider state locally.
   */
  @Post()
  @ApiOperation({ summary: 'Create subscription' })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateSubscriptionDto,
  ) {
    try {
      return await this.subscriptionsService.create(dto, user.organizationId);
    } catch (error) {
      this.logger.error('create subscription failed', error);
      throw error;
    }
  }

  /*
   * Public callback after a successful hosted checkout redirect.
   */
  @Public()
  @Get('checkout/success')
  @ApiOperation({ summary: 'Checkout success callback' })
  @ApiQuery({ name: 'session_id', required: false })
  checkoutSuccess(@Query('session_id') sessionId?: string) {
    try {
      return {
        message: SUCCESS_MESSAGES.CHECKOUT.SUCCESS,
        sessionId: sessionId ?? null,
      };
    } catch (error) {
      this.logger.error('checkoutSuccess callback failed', error);
      throw error;
    }
  }

  /*
   * Public callback when the user cancels hosted checkout.
   */
  @Public()
  @Get('checkout/cancel')
  @ApiOperation({ summary: 'Checkout cancel callback' })
  checkoutCancel() {
    try {
      return {
        message: SUCCESS_MESSAGES.CHECKOUT.CANCELED,
      };
    } catch (error) {
      this.logger.error('checkoutCancel callback failed', error);
      throw error;
    }
  }

  /*
   * Returns the authenticated organization's latest subscription record.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get my subscription' })
  async findMine(@CurrentUser() user: User) {
    try {
      return await this.subscriptionsService.findLatestByOrganizationId(
        user.organizationId,
      );
    } catch (error) {
      this.logger.error(
        `findMine failed for organization ${user.organizationId}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Returns a subscription by internal ID with related customer and price.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.subscriptionsService.findOneForOrganization(
        id,
        user.organizationId,
      );
    } catch (error) {
      this.logger.error(`findOne failed for subscription ${id}`, error);
      throw error;
    }
  }

  /*
   * Cancels a subscription immediately or at the end of the billing period.
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    try {
      return await this.subscriptionsService.cancel(
        id,
        dto.cancelAtPeriodEnd ?? true,
        user.organizationId,
      );
    } catch (error) {
      this.logger.error(`cancel failed for subscription ${id}`, error);
      throw error;
    }
  }

  /*
   * Resumes a subscription that was scheduled to cancel at period end.
   */
  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async resume(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.subscriptionsService.resume(id, user.organizationId);
    } catch (error) {
      this.logger.error(`resume failed for subscription ${id}`, error);
      throw error;
    }
  }

  /*
   * Previews proration and invoice impact before an immediate plan change.
   */
  @Post(':id/plan-change/preview')
  @ApiOperation({ summary: 'Preview plan change' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async previewPlanChange(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    try {
      const planChangePreview =
        await this.subscriptionsService.previewPlanChange(
          id,
          dto.priceId,
          user.organizationId,
          dto.couponCode,
        );
      return {
        currentPlan: planChangePreview.currentPlan,
        newPlan: planChangePreview.newPlan,
        direction: planChangePreview.direction,
        preview: planChangePreview.preview,
      };
    } catch (error) {
      this.logger.error(
        `previewPlanChange failed for subscription ${id}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Cancels a pending scheduled downgrade on the provider subscription.
   */
  @Post(':id/cancel-scheduled-change')
  @ApiOperation({ summary: 'Cancel scheduled plan change' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancelScheduledChange(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      const subscription =
        await this.subscriptionsService.cancelScheduledChange(
          id,
          user.organizationId,
        );
      return {
        message: this.subscriptionsService.getSuccessMessage(
          'cancelScheduledChange',
        ),
        data: subscription,
      };
    } catch (error) {
      this.logger.error(
        `cancelScheduledChange failed for subscription ${id}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Upgrades the subscription to a higher plan with immediate proration.
   */
  @Post(':id/upgrade/checkout')
  @ApiOperation({ summary: 'Create upgrade checkout session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async createUpgradeCheckout(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    try {
      return await this.subscriptionsService.createUpgradeCheckout(
        user.organizationId,
        id,
        dto.priceId,
        dto.couponCode,
      );
    } catch (error) {
      this.logger.error(`createUpgradeCheckout failed for subscription ${id}`, error);
      throw error;
    }
  }

  @Post(':id/upgrade/checkout/cancel')
  @ApiOperation({ summary: 'Revert an unpaid upgrade checkout' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async cancelPendingUpgradeCheckout(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.subscriptionsService.cancelPendingUpgradeCheckout(
        user.organizationId,
        id,
      );
    } catch (error) {
      this.logger.error(
        `cancelPendingUpgradeCheckout failed for subscription ${id}`,
        error,
      );
      throw error;
    }
  }

  @Post(':id/upgrade')
  @ApiOperation({ summary: 'Upgrade subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async upgrade(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    try {
      const subscription = await this.subscriptionsService.upgrade(
        id,
        dto.priceId,
        user.organizationId,
      );
      return {
        message: SUCCESS_MESSAGES.SUBSCRIPTION.UPGRADED,
        data: subscription,
      };
    } catch (error) {
      this.logger.error(`upgrade failed for subscription ${id}`, error);
      throw error;
    }
  }

  /*
   * Schedules a downgrade to take effect at the next billing period.
   */
  @Post(':id/downgrade')
  @ApiOperation({ summary: 'Downgrade subscription' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async downgrade(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSubscriptionPlanDto,
  ) {
    try {
      const subscription = await this.subscriptionsService.downgrade(
        id,
        dto.priceId,
        user.organizationId,
      );
      return {
        message: SUCCESS_MESSAGES.SUBSCRIPTION.DOWNGRADED,
        data: subscription,
      };
    } catch (error) {
      this.logger.error(`downgrade failed for subscription ${id}`, error);
      throw error;
    }
  }
}
