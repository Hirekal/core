/**
 * @fileoverview Payment webhook HTTP endpoints.
 */
import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../auth/common/decorators/public.decorator';
import { WebhookProcessorService } from './webhook-processor.service';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../common/messages/payment.messages';

@ApiTags('Webhooks')
@Controller('payments/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhookProcessorService: WebhookProcessorService,
  ) {}

  /*
   * Receives signed webhook events from a payment provider and processes them.
   */
  @Public()
  @Post(':providerCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive payment provider webhook' })
  @ApiParam({ name: 'providerCode' })
  @ApiHeader({ name: 'stripe-signature', required: false })
  async handleWebhook(
    @Param('providerCode') providerCode: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') stripeSignature?: string,
  ) {
    try {
      const signature = stripeSignature ?? '';
      const payload = this.resolveWebhookPayload(req);

      await this.webhookProcessorService.process(
        providerCode,
        payload,
        signature,
      );
      return { message: SUCCESS_MESSAGES.WEBHOOK.RECEIVED };
    } catch (error) {
      this.logger.error(`Webhook failed for provider ${providerCode}`, error);
      throw error;
    }
  }

  /*
   * Resolves the raw request body required for Stripe signature verification.
   */
  private resolveWebhookPayload(req: RawBodyRequest<Request>): Buffer {
    try {
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        return req.body;
      }

      if (req.rawBody instanceof Buffer && req.rawBody.length > 0) {
        return req.rawBody;
      }

      throw new BadRequestException(ERROR_MESSAGES.WEBHOOK.MISSING_PAYLOAD);
    } catch (error) {
      this.logger.error('Failed to resolve webhook payload', error);
      throw error;
    }
  }
}
