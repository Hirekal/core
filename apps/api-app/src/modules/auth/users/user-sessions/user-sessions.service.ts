/**
 * @fileoverview User session persistence service.
 * Handles session creation, token lookup, revocation, and activity tracking.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RecordStatus } from '../../common/constants/auth.constants';
import { UserSession } from './entities/user-session.entity';
import { CreateUserSessionDto } from './dto/create-user-session.dto';
import { BaseRepository } from '../../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../../common/constants/messages';
import { isSameOrAfterNow, toDate } from '../../common/utils/date.util';

/**
 * Manages authenticated user sessions including token storage and revocation.
 */
@Injectable()
export class UserSessionsService {
  private readonly logger = new Logger(UserSessionsService.name);

  /**
   * Creates the user sessions service with an injected TypeORM repository.
   *
   * @param sessionsRepository - TypeORM repository for user session entities
   */
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionsRepository: Repository<UserSession>,
  ) {}

  /**
   * Persists a new authenticated session for a user.
   *
   * @param sessionDto - Session creation payload with token hashes and expiry
   * @returns Created session entity
   */
  async create(sessionDto: CreateUserSessionDto): Promise<UserSession> {
    try {
      return BaseRepository.createAndSave(this.sessionsRepository, {
        ...sessionDto,
        ipAddress: sessionDto.ipAddress ?? null,
        lastActivityAt: toDate(),
        metadata: sessionDto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SESSION.CREATE_FAILED(sessionDto.userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Finds an active session by its refresh token hash.
   *
   * @param refreshTokenHash - SHA-256 hash of the refresh token
   * @returns Matching active session or null when not found
   */
  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<UserSession | null> {
    try {
      return this.sessionsRepository.findOne({
        where: {
          refreshTokenHash,
          revokedAt: IsNull(),
          status: RecordStatus.ACTIVE,
        },
        relations: { user: true },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SESSION.FIND_BY_REFRESH_FAILED, error);
      throw error;
    }
  }

  /**
   * Finds an active session by its access token hash.
   *
   * @param accessTokenHash - SHA-256 hash of the access token
   * @returns Matching active session or null when not found
   */
  async findByAccessTokenHash(
    accessTokenHash: string,
  ): Promise<UserSession | null> {
    try {
      return this.sessionsRepository.findOne({
        where: {
          accessTokenHash,
          revokedAt: IsNull(),
          status: RecordStatus.ACTIVE,
        },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SESSION.FIND_BY_ACCESS_FAILED, error);
      throw error;
    }
  }

  /**
   * Determines whether a session is currently active and not expired.
   *
   * @param session - Session entity to evaluate
   * @returns True when the session is active and the access token has not expired
   */
  isSessionActive(session: UserSession): boolean {
    if (
      session.revokedAt ||
      (session.status as RecordStatus) !== RecordStatus.ACTIVE
    ) {
      return false;
    }
    return isSameOrAfterNow(session.accessTokenExpiresAt);
  }

  /**
   * Revokes a single session by identifier.
   *
   * @param id - Session identifier
   */
  async revoke(id: string): Promise<void> {
    try {
      const session = await BaseRepository.findOneOrFail(
        this.sessionsRepository,
        { id },
        ERROR_MESSAGES.SESSION.NOT_FOUND,
      );
      session.revokedAt = toDate();
      session.status = RecordStatus.INACTIVE;
      await this.sessionsRepository.save(session);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SESSION.REVOKE_FAILED(id), error);
      throw error;
    }
  }

  /**
   * Revokes all active sessions for a user.
   *
   * @param userId - Target user identifier
   */
  async revokeByUserId(userId: string): Promise<void> {
    try {
      const sessions = await this.sessionsRepository.find({
        where: { userId, revokedAt: IsNull(), status: RecordStatus.ACTIVE },
      });
      for (const session of sessions) {
        session.revokedAt = toDate();
        session.status = RecordStatus.INACTIVE;
      }
      if (sessions.length) {
        await this.sessionsRepository.save(sessions);
      }
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.SESSION.REVOKE_BY_USER_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Updates the last activity timestamp for a session.
   *
   * @param id - Session identifier
   */
  async touch(id: string): Promise<void> {
    try {
      await this.sessionsRepository.update(id, {
        lastActivityAt: toDate(),
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SESSION.TOUCH_FAILED(id), error);
      throw error;
    }
  }
}
