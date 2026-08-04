/**
 * @fileoverview Price catalog HTTP endpoints.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { PricesService } from './prices.service';
import { CreatePriceDto } from './dto/create-price.dto';

@ApiTags('Prices')
@Auth()
@Controller('payments/prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  /*
   * Creates a price in the provider and persists the local catalog record.
   */
  @Post()
  @ApiOperation({ summary: 'Create price' })
  create(@Body() dto: CreatePriceDto) {
    return this.pricesService.create(dto);
  }

  /*
   * Lists prices, optionally filtered by product ID.
   */
  @Get()
  @ApiOperation({ summary: 'List prices' })
  @ApiQuery({ name: 'productId', format: 'uuid', required: false })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'Set to true to bypass cache and reload from database',
  })
  findAll(
    @Query('productId', new ParseUUIDPipe({ optional: true }))
    productId?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.pricesService.findAll(productId, refresh === 'true');
  }

  /*
   * Returns a single price by internal ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get price by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pricesService.findOne(id);
  }
}
