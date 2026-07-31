/**
 * @fileoverview User verification code service.
 * Handles generation, validation, and lifecycle of one-time email and reset codes.
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { UserCode } from './entities/user-code.entity';
import {
  AUTH_CONSTANTS,
  UserCodeType,
} from '../../common/constants/auth.constants';
import { generateCode, hashToken } from '../../common/utils/hash.util';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../../common/constants/messages';
import { addMinutes, isBeforeNow, toDate } from '../../common/utils/date.util';
import { UserCodeCreateResult } from '../../common/interfaces/auth-response.interface';

/**
 * Manages one-time verification and password reset codes for users.
 */
@Injectable()
export class UserCodesService {
  private readonly logger = new Logger(UserCodesService.name);

  /**
   * Creates the user codes service with an injected TypeORM repository.
   *
   * @param codesRepository - TypeORM repository for user code entities
   */
  constructor(
    @InjectRepository(UserCode)
    private readonly codesRepository: Repository<UserCode>,
  ) {}

  /**
   * Generates a new one-time code, invalidating any previous unverified codes of the same type.
   *
   * @param userId - Target user identifier
   * @param type - Code purpose such as email verification or password reset
   * @returns Plain-text code and persisted code entity
   */
  async create(
    userId: string,
    type: UserCodeType,
  ): Promise<UserCodeCreateResult> {
    try {
      const previous = await this.codesRepository.find({
        where: { userId, type, verifiedAt: IsNull() },
      });
      if (previous.length) {
        await this.codesRepository.softRemove(previous);
      }

      const plainCode = generateCode(6);
      const expiresAt = addMinutes(AUTH_CONSTANTS.CODE_EXPIRES_IN_MINUTES);

      const saved = await this.codesRepository.save(
        this.codesRepository.create({
          userId,
          code: hashToken(plainCode),
          type,
          expiresAt,
          attempts: 0,
          metadata: {},
        }),
      );

      return { code: plainCode, entity: saved };
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER_CODE.CREATE_FAILED(userId), error);
      throw error;
    }
  }

  /**
   * Validates a submitted code against stored candidates for a user.
   *
   * @param userId - Target user identifier
   * @param plainCode - Code submitted by the user
   * @param type - Optional code type filter
   * @param consume - When true, marks the code as verified on success
   * @returns Verified user code entity
   */
  async verify(
    userId: string,
    plainCode: string,
    type?: UserCodeType,
    consume = true,
  ): Promise<UserCode> {
    try {
      const hashed = hashToken(String(plainCode).trim());

      const where: FindOptionsWhere<UserCode> = {
        userId,
        code: hashed,
        verifiedAt: IsNull(),
      };

      if (type) {
        where.type = type;
      }

      const candidates = await this.codesRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });

      if (!candidates.length) {
        throw new BadRequestException(ERROR_MESSAGES.USER_CODE.INVALID);
      }

      const codeEntity = candidates[0];

      if (isBeforeNow(codeEntity.expiresAt)) {
        throw new BadRequestException(ERROR_MESSAGES.USER_CODE.EXPIRED);
      }

      if (codeEntity.attempts >= AUTH_CONSTANTS.MAX_CODE_ATTEMPTS) {
        throw new BadRequestException(ERROR_MESSAGES.USER_CODE.MAX_ATTEMPTS);
      }

      codeEntity.attempts += 1;
      if (consume) {
        codeEntity.verifiedAt = toDate();
      }

      return this.codesRepository.save(codeEntity);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER_CODE.VERIFY_FAILED(userId), error);
      throw error;
    }
  }

  /**
   * Marks a user code as verified without consuming attempt logic.
   *
   * @param id - User code identifier
   */
  async markVerified(id: string): Promise<void> {
    try {
      await this.codesRepository.update(id, { verifiedAt: toDate() });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.USER_CODE.MARK_VERIFIED_FAILED(id), error);
      throw error;
    }
  }
}
