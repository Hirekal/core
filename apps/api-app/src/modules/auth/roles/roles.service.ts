/**
 * @fileoverview Role persistence service.
 * Handles CRUD operations and name-based lookup for system and organization roles.
 */
import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { BaseRepository } from '../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../common/constants/messages';

/**
 * Manages role records including creation, lookup, updates, and soft deletion.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  /**
   * Creates the roles service with an injected TypeORM repository.
   *
   * @param rolesRepository - TypeORM repository for role entities
   */
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  /**
   * Creates a new role scoped to an organization or as a system role.
   *
   * @param dto - Role creation payload
   * @returns Persisted role entity
   */
  async create(dto: CreateRoleDto): Promise<Role> {
    try {
      const existing = await this.rolesRepository.findOne({
        where: {
          name: dto.name,
          organizationId: dto.organizationId ? dto.organizationId : IsNull(),
        },
      });
      if (existing) {
        throw new ConflictException(ERROR_MESSAGES.ROLE.ALREADY_EXISTS);
      }

      return BaseRepository.createAndSave(this.rolesRepository, {
        organizationId: dto.organizationId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        isSystem: dto.isSystem ?? false,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.CREATE_FAILED(dto.name), error);
      throw error;
    }
  }

  /**
   * Lists roles, optionally scoped to an organization.
   *
   * @param organizationId - Optional organization filter
   * @returns Roles ordered by creation date descending
   */
  async findAll(organizationId?: string): Promise<Role[]> {
    try {
      return this.rolesRepository.find({
        where: organizationId ? { organizationId } : {},
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.LIST_FAILED, error);
      throw error;
    }
  }

  /**
   * Finds a single role by identifier.
   *
   * @param id - Role identifier
   * @returns Matching role entity
   */
  async findOne(id: string): Promise<Role> {
    try {
      return BaseRepository.findOneOrFail(
        this.rolesRepository,
        { id },
        ERROR_MESSAGES.ROLE.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.FIND_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Finds a role by name within an organization or at the system level.
   *
   * @param name - Role name to look up
   * @param organizationId - Organization scope, or null for system roles
   * @returns Matching role or null when not found
   */
  async findByName(
    name: string,
    organizationId?: string | null,
  ): Promise<Role | null> {
    try {
      return this.rolesRepository.findOne({
        where: {
          name,
          organizationId:
            organizationId === null || organizationId === undefined
              ? IsNull()
              : organizationId,
        },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.FIND_BY_NAME_FAILED(name), error);
      throw error;
    }
  }

  /**
   * Updates mutable fields on an existing role.
   *
   * @param id - Role identifier
   * @param dto - Partial update payload
   * @returns Updated role entity
   */
  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    try {
      const role = await this.findOne(id);
      Object.assign(role, dto);
      return this.rolesRepository.save(role);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.UPDATE_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Soft-deletes a role by identifier.
   *
   * @param id - Role identifier
   */
  async remove(id: string): Promise<void> {
    try {
      const role = await this.findOne(id);
      await this.rolesRepository.softRemove(role);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ROLE.REMOVE_FAILED(id), error);
      throw error;
    }
  }
}
