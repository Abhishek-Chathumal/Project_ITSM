import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

/**
 * Catch-all exception handler (Article VII: fail safe, not silent). Every unhandled
 * error is logged with full detail server-side and mapped to a sanitized JSON body —
 * never a leaked stack trace, but never a silently swallowed failure either.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ id?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp ? exception.getResponse() : 'Internal server error';

    if (!isHttp || status >= 500) {
      this.logger.error({ err: exception, requestId: request.id }, 'Unhandled exception');
    } else {
      this.logger.warn({ requestId: request.id, status }, 'Request rejected');
    }

    response
      .status(status)
      .json(
        typeof message === 'string'
          ? { statusCode: status, message, requestId: request.id }
          : { statusCode: status, ...message, requestId: request.id },
      );
  }
}
