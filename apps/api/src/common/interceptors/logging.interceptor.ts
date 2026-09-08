import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';

/** Thin request-completion log on top of pino-http's own access logging (Article VII). */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          { method: request.method, url: request.url, durationMs: Date.now() - start },
          'Request handled',
        );
      }),
    );
  }
}
