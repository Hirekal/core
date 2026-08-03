/**
 * @fileoverview Product catalog HTTP endpoints.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@Auth()
@Controller('payments/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /*
   * Creates a product in the provider and persists the local catalog record.
   */
  @Post()
  @ApiOperation({ summary: 'Create product' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  /*
   * Lists all products in the local catalog.
   */
  @Get()
  @ApiOperation({ summary: 'List products' })
  findAll() {
    return this.productsService.findAll();
  }

  /*
   * Returns a single product by internal ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  /*
   * Updates product metadata locally and on the payment provider.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  /*
   * Soft-deletes a product from the local catalog.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
