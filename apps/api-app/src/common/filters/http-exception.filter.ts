/**
 * @fileoverview Global HTTP exception filter.
 * Converts thrown errors into the standard API error response envelope.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../constants/messages';

/**
 * Catch-all exception filter applied to every HTTP route.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Formats any thrown exception into a consistent JSON error response.
   *
   * @param exception - Uncaught error or HttpException
   * @param host - Nest arguments host for the current request
   */
  catch(exception: unknown, host: ArgumentsHost) {
    try {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();

      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      const exceptionResponse =
        exception instanceof HttpException ? exception.getResponse() : null;

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>)?.message ??
            (exception instanceof Error
              ? exception.message
              : ERROR_MESSAGES.COMMON.INTERNAL_SERVER_ERROR));

      const body: ApiResponse = {
        success: false,
        message: Array.isArray(message)
          ? message.join(', ')
          : typeof message === 'string'
            ? message
            : JSON.stringify(message),
        error: exceptionResponse ?? undefined,
      };

      if (response.headersSent) {
        return;
      }

      response.status(status).json(body);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.FILTER.CATCH_FAILED, error);
      throw error;
    }
  }
}
