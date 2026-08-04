/**
 * @fileoverview In-memory cache for payment catalog list responses.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PAYMENT_CONSTANTS } from '../common/constants/payment.constants';

interface CatalogCacheEntry {
  payload: unknown;
  expiresAt: number;
}

@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);
  private readonly cache = new Map<string, CatalogCacheEntry>();
  private readonly productCachePrefix = 'catalog:products';
  private readonly priceCachePrefix = 'catalog:prices';

  /*
   * Returns a cached payload when fresh; otherwise loads and stores it.
   */
  async getOrLoad<T>(
    cacheKey: string,
    loader: () => Promise<T>,
    ttlMs: number = PAYMENT_CONSTANTS.CATALOG_CACHE_TTL_MS,
    refresh = false,
  ): Promise<T> {
    try {
      if (!refresh) {
        const cachedEntry = this.cache.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
          return cachedEntry.payload as T;
        }
      }

      const payload = await loader();
      this.cache.set(cacheKey, {
        payload,
        expiresAt: Date.now() + ttlMs,
      });
      return payload;
    } catch (error) {
      this.logger.warn(
        `Catalog cache miss for ${cacheKey}, loading directly`,
        error,
      );
      return loader();
    }
  }

  /*
   * Clears cached product list entries.
   */
  invalidateProducts(): void {
    this.invalidateByPrefix(this.productCachePrefix);
  }

  /*
   * Clears cached price list entries.
   */
  invalidatePrices(): void {
    this.invalidateByPrefix(this.priceCachePrefix);
  }

  /*
   * Clears all cached product and price list entries.
   */
  invalidateAll(): void {
    try {
      this.cache.clear();
    } catch (error) {
      this.logger.warn('Failed to clear catalog cache', error);
    }
  }

  /*
   * Removes cache entries matching a key prefix.
   */
  private invalidateByPrefix(prefix: string): void {
    try {
      for (const cacheKey of this.cache.keys()) {
        if (cacheKey.startsWith(prefix)) {
          this.cache.delete(cacheKey);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate catalog cache prefix ${prefix}`, error);
    }
  }
}
