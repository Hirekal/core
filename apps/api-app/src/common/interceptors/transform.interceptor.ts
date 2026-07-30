/**
 * @fileoverview Global success response interceptor.
 * Wraps successful controller responses in the standard API envelope.
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response.interface';
import { SUCCESS_MESSAGES, LOG_MESSAGES } from '../constants/messages';

/**
 * Interceptor that normalizes successful HTTP responses.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  private readonly logger = new Logger(TransformInterceptor.name);

  /**
   * Wraps plain controller return values in `{ success, message, data }`.
   *
   * @param _context - Nest execution context
   * @param next - Remaining handler chain
   * @returns Observable API response envelope
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((responseBody: T) => {
        try {
          if (
            responseBody &&
            typeof responseBody === 'object' &&
            'success' in responseBody &&
            'message' in responseBody
          ) {
            return responseBody as ApiResponse<T>;
          }
          return {
            success: true,
            message: SUCCESS_MESSAGES.COMMON.OK,
            data: responseBody,
          };
        } catch (error) {
          this.logger.error(LOG_MESSAGES.INTERCEPTOR.MAP_FAILED, error);
          throw error;
        }
      }),
    );
  }
}
