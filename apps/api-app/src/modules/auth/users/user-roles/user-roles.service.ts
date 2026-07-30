/**
 * @fileoverview User-role assignment service.
 * Handles assigning roles to users and managing user-role associations.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserRole } from './entities/user-role.entity';
import { BaseRepository } from '../../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../../common/constants/messages';

/**
 * Manages user-to-role assignments including creation, lookup, and removal.
 */
@Injectable()
export class UserRolesService {
  private readonly logger = new Logger(UserRolesService.name);

  /**
   * Creates the user roles service with an injected TypeORM repository.
   *
   * @param userRolesRepository - TypeORM repository for user-role entities
   */
  constructor(
    @InjectRepository(UserRole)
    private readonly userRolesRepository: Repository<UserRole>,
  ) {}

  /**
   * Assigns a role to a user, returning the existing assignment when present.
   *
   * @param userId - Target user identifier
   * @param roleId - Role identifier to assign
   * @param assignedBy - Optional identifier of the assigning user
   * @returns Created or existing user-role assignment
   */
  async assign(
    userId: string,
    roleId: string,
    assignedBy?: string,
  ): Promise<UserRole> {
    try {
      const existing = await this.userRolesRepository.findOne({
        where: { userId, roleId, deletedAt: IsNull() },
      });
      if (existing) {
        return existing;
      }

      return BaseRepository.createAndSave(this.userRolesRepository, {
        userId,
        roleId,
        assignedBy: assignedBy ?? null,
        metadata: {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.USER_ROLE.ASSIGN_FAILED(roleId, userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Lists all role assignments for a user with role relations loaded.
   *
   * @param userId - Target user identifier
   * @returns User-role assignments for the user
   */
  async findByUser(userId: string): Promise<UserRole[]> {
    try {
      return this.userRolesRepository.find({
        where: { userId },
        relations: { role: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.USER_ROLE.FIND_BY_USER_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Soft-deletes a user-role assignment by identifier.
   *
   * @param id - User-role assignment identifier
   */
  async remove(id: string): Promise<void> {
    try {
      await BaseRepository.softRemoveOrFail(
        this.userRolesRepository,
        { id },
        ERROR_MESSAGES.USER_ROLE.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER_ROLE.REMOVE_FAILED(id), error);
      throw error;
    }
  }
}
