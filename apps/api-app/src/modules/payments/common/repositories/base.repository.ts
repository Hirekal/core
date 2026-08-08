/**
 * @fileoverview Shared TypeORM repository helpers for payment entities.
 */
import { NotFoundException, Logger } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsRelations,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { LOG_MESSAGES } from '../messages/payment.messages';

export class BaseRepository {
  private static readonly logger = new Logger(BaseRepository.name);

  static async findOneOrFail<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
    notFoundMessage: string,
    relations?: FindOptionsRelations<T>,
  ): Promise<T> {
    try {
      const entity = await repository.findOne({ where, relations });
      if (!entity) {
        throw new NotFoundException(notFoundMessage);
      }
      return entity;
    } catch (error) {
      this.logger.error(LOG_MESSAGES.REPOSITORY.FIND_ONE_OR_FAIL, error);
      throw error;
    }
  }

  static async createAndSave<T extends ObjectLiteral>(
    repository: Repository<T>,
    entityLike: DeepPartial<T>,
  ): Promise<T> {
    try {
      const entity = repository.create(entityLike);
      return await repository.save(entity);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.REPOSITORY.CREATE_AND_SAVE, error);
      throw error;
    }
  }

  static async softRemoveOrFail<T extends ObjectLiteral>(
    repository: Repository<T>,
    where: FindOptionsWhere<T>,
    notFoundMessage: string,
  ): Promise<void> {
    try {
      const entity = await this.findOneOrFail(
        repository,
        where,
        notFoundMessage,
      );
      await repository.softRemove(entity);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.REPOSITORY.SOFT_REMOVE_OR_FAIL, error);
      throw error;
    }
  }
}
