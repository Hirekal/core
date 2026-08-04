/**
 * @fileoverview Price catalog and provider synchronization service.
 */
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Price } from './entities/price.entity';
import { CreatePriceDto } from './dto/create-price.dto';
import { ProductsService } from '../products/products.service';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
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
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    @InjectRepository(Price)
    private readonly pricesRepository: Repository<Price>,
    private readonly productsService: ProductsService,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly catalogCacheService: CatalogCacheService,
  ) {}

  /*
   * Creates a price on the provider and persists the local catalog record.
   */
  async create(dto: CreatePriceDto): Promise<Price> {
    try {
      const product = await this.productsService.findOne(dto.productId);
      const provider = await this.paymentProvidersService.findById(
        dto.paymentProviderId,
      );

      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerProductId =
        (product.metadata?.providerProductId as string | undefined) ??
        (
          await paymentProvider.createProduct({
            name: product.name,
            description: product.description ?? undefined,
            metadata: { productCode: product.code },
          })
        ).providerProductId;

      const providerPrice = await paymentProvider.createPrice({
        providerProductId,
        currency: dto.currency,
        amount: dto.amount,
        interval: dto.interval?.toLowerCase(),
        intervalCount: dto.intervalCount,
        metadata: { productCode: product.code },
      });

      const existingPrice = await this.pricesRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerPriceId: providerPrice.providerPriceId,
        },
      });
      if (existingPrice) {
        throw new ConflictException(ERROR_MESSAGES.PRICE.ALREADY_EXISTS);
      }

      if (!product.metadata?.providerProductId) {
        product.metadata = {
          ...(product.metadata ?? {}),
          providerProductId,
        };
        await this.productsService.update(product.id, {
          metadata: product.metadata,
        });
      }

      const price = await BaseRepository.createAndSave(this.pricesRepository, {
        productId: product.id,
        paymentProviderId: provider.id,
        providerPriceId: providerPrice.providerPriceId,
        currency: dto.currency.toUpperCase(),
        amount: dto.amount,
        interval: dto.interval ?? null,
        intervalCount: dto.intervalCount ?? null,
        status: RecordStatus.ACTIVE,
        metadata: dto.metadata ?? {},
      });
      await this.catalogCacheService.invalidatePrices();
      return price;
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRICE.CREATE_FAILED(dto.productId), error);
      throw error;
    }
  }

  /*
   * Lists prices with product and provider relations, optionally by product.
   */
  async findAll(productId?: string, refresh = false): Promise<Price[]> {
    try {
      const cacheKey = productId
        ? PAYMENT_CATALOG_CACHE_KEYS.pricesByProduct(productId)
        : PAYMENT_CATALOG_CACHE_KEYS.PRICES_ALL;

      return this.catalogCacheService.getOrLoad(
        cacheKey,
        () =>
          this.pricesRepository.find({
            where: productId ? { productId } : {},
            relations: { product: true, paymentProvider: true },
            order: { createdAt: 'DESC' },
          }),
        PAYMENT_CONSTANTS.CATALOG_CACHE_TTL_MS,
        refresh,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRICE.LIST_FAILED, error);
      throw error;
    }
  }

  /*
   * Returns a single record by internal ID or throws if not found.
   */
  async findOne(id: string): Promise<Price> {
    try {
      return BaseRepository.findOneOrFail(
        this.pricesRepository,
        { id },
        ERROR_MESSAGES.PRICE.NOT_FOUND,
        { product: true, paymentProvider: true },
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PRICE.FIND_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Finds a local price record matching a provider price ID.
   */
  async findByProviderPriceId(
    providerPriceId: string,
    providerCode: string,
  ): Promise<Price | null> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      return this.pricesRepository.findOne({
        where: { providerPriceId, paymentProviderId: provider.id },
        relations: { product: true, paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PRICE.FIND_FAILED(`${providerCode}:${providerPriceId}`),
        error,
      );
      throw error;
    }
  }
}
