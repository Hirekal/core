/**
 * @fileoverview User persistence and lookup service.
 * Handles CRUD operations, email lookup, and password sanitization for user entities.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  SYSTEM_ROLES,
  UserStatus,
} from '../common/constants/auth.constants';
import { hashPassword } from '../common/utils/hash.util';
import { BaseRepository } from '../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../common/constants/messages';
import { toDate } from '../common/utils/date.util';
import { RolesService } from '../roles/roles.service';
import { UserRolesService } from './user-roles/user-roles.service';

/**
 * Manages user records including creation, lookup, updates, and soft deletion.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  /**
   * Creates the users service with an injected TypeORM repository.
   *
   * @param usersRepository - TypeORM repository for user entities
   * @param rolesService - Role lookup service
   * @param userRolesService - User-role assignment service
   */
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly userRolesService: UserRolesService,
  ) {}

  /**
   * Creates a new user within an organization and assigns a system role.
   *
   * @param dto - User creation payload
   * @param organizationId - Owning organization identifier
   * @param createdBy - Optional identifier of the creating user
   * @returns Sanitized created user
   */
  async create(
    dto: CreateUserDto,
    organizationId: string,
    createdBy?: string,
  ): Promise<User> {
    try {
      const existing = await this.usersRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          ERROR_MESSAGES.USER.EMAIL_ALREADY_REGISTERED,
        );
      }

      const roleName = dto.role ?? SYSTEM_ROLES.RECRUITER;
      const role = await this.rolesService.findByName(roleName, null);
      if (!role) {
        throw new BadRequestException(ERROR_MESSAGES.ROLE.NOT_FOUND);
      }

      const saved = await BaseRepository.createAndSave(this.usersRepository, {
        organizationId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        password: await hashPassword(dto.password),
        status: UserStatus.ACTIVE,
        emailVerified: dto.emailVerified ?? false,
        createdBy: createdBy ?? dto.createdBy ?? null,
        metadata: dto.metadata ?? {},
      });

      await this.userRolesService.assign(
        saved.id,
        role.id,
        createdBy ?? dto.createdBy,
      );

      return this.findOne(saved.id);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.CREATE_FAILED(dto.email), error);
      throw error;
    }
  }

  /**
   * Lists users, optionally scoped to an organization.
   *
   * @param organizationId - Optional organization filter
   * @returns Sanitized users ordered by creation date descending
   */
  async findAll(organizationId?: string): Promise<User[]> {
    try {
      const users = await this.usersRepository.find({
        where: organizationId ? { organizationId } : {},
        relations: { userRoles: { role: true } },
        order: { createdAt: 'DESC' },
      });
      return users.map((user) => this.sanitize(user));
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.LIST_FAILED, error);
      throw error;
    }
  }

  /**
   * Finds a single user by identifier with relations loaded.
   *
   * @param id - User identifier
   * @returns Sanitized user with organization and roles
   */
  async findOne(id: string): Promise<User> {
    try {
      const user = await BaseRepository.findOneOrFail(
        this.usersRepository,
        { id },
        ERROR_MESSAGES.USER.NOT_FOUND,
        { organization: true, userRoles: { role: true } },
      );
      return this.sanitize(user);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.FIND_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Finds a user by email address.
   *
   * @param email - Email address to look up
   * @param withPassword - When true, returns the entity including the password hash
   * @returns Matching user or null when not found
   */
  async findByEmail(email: string, withPassword = false): Promise<User | null> {
    try {
      const user = await this.usersRepository.findOne({
        where: { email: email.toLowerCase() },
        relations: {
          organization: true,
          userRoles: { role: true },
        },
      });
      if (!user) {
        return null;
      }
      return withPassword ? user : this.sanitize(user);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.FIND_BY_EMAIL_FAILED(email), error);
      throw error;
    }
  }

  /**
   * Updates mutable fields on an existing user.
   *
   * @param id - User identifier
   * @param dto - Partial update payload
   * @returns Sanitized updated user
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    try {
      const user = await BaseRepository.findOneOrFail(
        this.usersRepository,
        { id },
        ERROR_MESSAGES.USER.NOT_FOUND,
      );

      if (dto.email && dto.email.toLowerCase() !== user.email) {
        const existing = await this.usersRepository.findOne({
          where: { email: dto.email.toLowerCase() },
        });
        if (existing) {
          throw new ConflictException(
            ERROR_MESSAGES.USER.EMAIL_ALREADY_REGISTERED,
          );
        }
        user.email = dto.email.toLowerCase();
      }

      if (dto.name !== undefined) user.name = dto.name;
      if (dto.status !== undefined) user.status = dto.status;
      if (dto.emailVerified !== undefined)
        user.emailVerified = dto.emailVerified;
      if (dto.metadata !== undefined) user.metadata = dto.metadata;
      if (dto.updatedBy !== undefined) user.updatedBy = dto.updatedBy;
      if (dto.password) {
        user.password = await hashPassword(dto.password);
      }

      const saved = await this.usersRepository.save(user);
      return this.sanitize(saved);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.UPDATE_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Soft-deletes a user by identifier.
   *
   * @param id - User identifier
   */
  async remove(id: string): Promise<void> {
    try {
      await BaseRepository.softRemoveOrFail(
        this.usersRepository,
        { id },
        ERROR_MESSAGES.USER.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.REMOVE_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Records the current timestamp as the user's last login time.
   *
   * @param id - User identifier
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.usersRepository.update(id, { lastLoginAt: toDate() });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER.UPDATE_LAST_LOGIN_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Removes the password field from a user entity before returning it.
   *
   * @param user - User entity that may contain a password hash
   * @returns User object without the password field
   */
  sanitize(user: User): User {
    const { password, ...sanitizedUser } = user;
    void password;
    return sanitizedUser as User;
  }
}
