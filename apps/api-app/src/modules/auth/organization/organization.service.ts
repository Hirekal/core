/**
 * @fileoverview Organization persistence service.
 * Handles CRUD operations for tenant organization records.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationStatus } from '../common/constants/auth.constants';
import { BaseRepository } from '../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../common/constants/messages';

/**
 * Manages organization records including creation, lookup, updates, and soft deletion.
 */
@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  /**
   * Creates the organization service with an injected TypeORM repository.
   *
   * @param organizationRepository - TypeORM repository for organization entities
   */
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Creates a new organization record.
   *
   * @param dto - Organization creation payload
   * @returns Persisted organization entity
   */
  async create(dto: CreateOrganizationDto): Promise<Organization> {
    try {
      return BaseRepository.createAndSave(this.organizationRepository, {
        ...dto,
        status: dto.status ?? OrganizationStatus.ACTIVE,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.ORGANIZATION.CREATE_FAILED(dto.name),
        error,
      );
      throw error;
    }
  }

  /**
   * Lists all organizations ordered by creation date descending.
   *
   * @returns All organization records
   */
  async findAll(): Promise<Organization[]> {
    try {
      return this.organizationRepository.find({
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ORGANIZATION.LIST_FAILED, error);
      throw error;
    }
  }

  /**
   * Finds a single organization by identifier.
   *
   * @param id - Organization identifier
   * @returns Matching organization entity
   */
  async findOne(id: string): Promise<Organization> {
    try {
      return BaseRepository.findOneOrFail(
        this.organizationRepository,
        { id },
        ERROR_MESSAGES.ORGANIZATION.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ORGANIZATION.FIND_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Updates mutable fields on an existing organization.
   *
   * @param id - Organization identifier
   * @param dto - Partial update payload
   * @returns Updated organization entity
   */
  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    try {
      const organization = await this.findOne(id);
      Object.assign(organization, dto);
      return this.organizationRepository.save(organization);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ORGANIZATION.UPDATE_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Soft-deletes an organization by identifier.
   *
   * @param id - Organization identifier
   */
  async remove(id: string): Promise<void> {
    try {
      await BaseRepository.softRemoveOrFail(
        this.organizationRepository,
        { id },
        ERROR_MESSAGES.ORGANIZATION.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.ORGANIZATION.REMOVE_FAILED(id), error);
      throw error;
    }
  }
}
