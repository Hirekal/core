import {
  DeepPartial,
  FindManyOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { nowMs } from '../utils/timestamp.util';

export interface SoftDeletable {
  deletedAt?: number | null;
}

/**
 * Generic repository wrapper with common CRUD and soft-delete helpers.
 */
export class BaseRepository<T extends ObjectLiteral & SoftDeletable> {
  constructor(protected readonly repository: Repository<T>) {}

  /**
   * Persist a new entity row.
   */
  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  /**
   * Find a single entity by primary key.
   */
  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  /**
   * Find entities matching optional TypeORM find options.
   */
  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  /**
   * Apply partial updates to an entity by id.
   */
  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as never);
    return this.findById(id);
  }

  /**
   * Soft-delete by setting deletedAt when the column exists.
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, {
      deletedAt: nowMs(),
    } as never);
  }
}
