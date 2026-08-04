/**
 * @fileoverview Product catalog service.
 */
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { RecordStatus } from '../common/enums/payment.enums';
import {
  PAYMENT_CATALOG_CACHE_KEYS,
  PAYMENT_CONSTANTS,
} from '../common/constants/payment.constants';
import { CatalogCacheService } from '../catalog/catalog-cache.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly catalogCacheService: CatalogCacheService,
  ) {}

  /*
   * Creates a product in the local catalog after validating unique code.
   */
  async create(dto: CreateProductDto): Promise<Product> {
    try {
      const existingProduct = await this.productsRepository.findOne({
        where: { code: dto.code.toUpperCase() },
      });
      if (existingProduct) {
        throw new ConflictException(ERROR_MESSAGES.PRODUCT.CODE_ALREADY_EXISTS);
      }

      const product = await BaseRepository.createAndSave(
        this.productsRepository,
        {
          name: dto.name,
          code: dto.code.toUpperCase(),
          description: dto.description ?? null,
          status: dto.status ?? RecordStatus.ACTIVE,
          metadata: dto.metadata ?? {},
        },
      );
      this.catalogCacheService.invalidateProducts();
      this.catalogCacheService.invalidatePrices();
      return product;
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRODUCT.CREATE_FAILED(dto.code), error);
      throw error;
    }
  }

  /*
   * Lists all products ordered by newest first.
   */
  async findAll(refresh = false): Promise<Product[]> {
    try {
      return this.catalogCacheService.getOrLoad(
        PAYMENT_CATALOG_CACHE_KEYS.PRODUCTS_ALL,
        () => this.productsRepository.find({ order: { createdAt: 'DESC' } }),
        PAYMENT_CONSTANTS.CATALOG_CACHE_TTL_MS,
        refresh,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRODUCT.LIST_FAILED, error);
      throw error;
    }
  }

  /*
   * Returns a single record by internal ID or throws if not found.
   */
  async findOne(id: string): Promise<Product> {
    try {
      return BaseRepository.findOneOrFail(
        this.productsRepository,
        { id },
        ERROR_MESSAGES.PRODUCT.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRODUCT.FIND_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Updates an existing record locally and on the payment provider when applicable.
   */
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    try {
      const product = await this.findOne(id);
      Object.assign(product, dto);
      const updatedProduct = await this.productsRepository.save(product);
      this.catalogCacheService.invalidateProducts();
      this.catalogCacheService.invalidatePrices();
      return updatedProduct;
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRODUCT.UPDATE_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Soft-deletes a record by internal ID.
   */
  async remove(id: string): Promise<void> {
    try {
      await BaseRepository.softRemoveOrFail(
        this.productsRepository,
        { id },
        ERROR_MESSAGES.PRODUCT.NOT_FOUND,
      );
      this.catalogCacheService.invalidateProducts();
      this.catalogCacheService.invalidatePrices();
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRODUCT.REMOVE_FAILED(id), error);
      throw error;
    }
  }
}
