/**
 * @fileoverview Payment provider HTTP endpoints.
 */
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { PaymentProvidersService } from './payment-providers.service';

@ApiTags('Payment Providers')
@Auth()
@Controller('payments/providers')
export class PaymentProvidersController {
  constructor(
    private readonly paymentProvidersService: PaymentProvidersService,
  ) {}

  /*
   * Lists all configured payment providers (e.g. Stripe).
   */
  @Get()
  @ApiOperation({ summary: 'List payment providers' })
  findAll() {
    return this.paymentProvidersService.findAll();
  }

  /*
   * Returns a payment provider by internal ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get payment provider by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentProvidersService.findById(id);
  }
}
