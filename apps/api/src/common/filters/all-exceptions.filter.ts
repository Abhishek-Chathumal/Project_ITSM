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
 * An `http-errors`-style rejection thrown by Express middleware that runs before Nest's
 * own pipeline — csrf-csrf's "invalid csrf token" (403) and body-parser's malformed-JSON
 * (400) are the two we actually hit. They are not `HttpException`s, so without this they
 * would all collapse into a 500.
 */
interface HttpErrorLike {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
  /** `http-errors` sets this true when the message is safe to return to the client. */
  expose?: unknown;
}

function isHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599;
}

/**
 * Reads the HTTP status off an Express middleware error, if it carries a sane one.
 * Returns undefined for anything else, which is then treated as a genuine 500.
 */
function httpErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const { status, statusCode } = exception as HttpErrorLike;
  if (isHttpStatus(statusCode)) {
    return statusCode;
  }
  return isHttpStatus(status) ? status : undefined;
}

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
    // Middleware rejections (CSRF, malformed JSON) never reach Nest as HttpExceptions, but
    // they are still deliberate 4xx answers — reporting them as 500 both misleads the
    // client and buries real server faults in error-level noise.
    const middlewareStatus = isHttp ? undefined : httpErrorStatus(exception);
    const status = isHttp
      ? exception.getStatus()
      : (middlewareStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    let message: string | object;
    if (isHttp) {
      message = exception.getResponse();
    } else if (middlewareStatus !== undefined && (exception as HttpErrorLike).expose === true) {
      // `expose` is http-errors' own signal that the message carries no internal detail.
      const raw = (exception as HttpErrorLike).message;
      message = typeof raw === 'string' ? raw : 'Request rejected';
    } else {
      message = 'Internal server error';
    }

    if (status >= 500) {
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
