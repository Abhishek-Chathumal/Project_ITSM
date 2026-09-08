import { type ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status?: number;
  body?: Record<string, unknown>;
}

function makeHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ id: 'req-1' }),
    }),
  } as unknown as ArgumentsHost;
}

/** Shape of the error csrf-csrf throws — an `http-errors` ForbiddenError, not an HttpException. */
function csrfError() {
  return Object.assign(new Error('invalid csrf token'), {
    code: 'EBADCSRFTOKEN',
    status: 403,
    statusCode: 403,
    expose: true,
  });
}

describe('AllExceptionsFilter', () => {
  let logger: PinoLogger;
  let warn: jest.Mock;
  let error: jest.Mock;

  beforeEach(() => {
    warn = jest.fn();
    error = jest.fn();
    logger = { setContext: jest.fn(), warn, error } as unknown as PinoLogger;
  });

  it('maps a Nest HttpException to its own status', () => {
    const captured: CapturedResponse = {};
    new AllExceptionsFilter(logger).catch(new BadRequestException('bad input'), makeHost(captured));

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ statusCode: 400, requestId: 'req-1' });
    expect(error).not.toHaveBeenCalled();
  });

  // Regression: middleware runs outside Nest's pipeline, so its rejections arrive as plain
  // http-errors. Treating them as 500 told the client the server was broken when in fact the
  // request was deliberately refused — and buried genuine faults under error-level noise.
  it('honours the status on an http-errors rejection thrown by middleware (CSRF)', () => {
    const captured: CapturedResponse = {};
    new AllExceptionsFilter(logger).catch(csrfError(), makeHost(captured));

    expect(captured.status).toBe(HttpStatus.FORBIDDEN);
    expect(captured.body).toMatchObject({
      statusCode: 403,
      message: 'invalid csrf token',
      requestId: 'req-1',
    });
  });

  it('logs a 4xx middleware rejection as a warning, not an unhandled exception', () => {
    new AllExceptionsFilter(logger).catch(csrfError(), makeHost({}));

    expect(warn).toHaveBeenCalledWith({ requestId: 'req-1', status: 403 }, 'Request rejected');
    expect(error).not.toHaveBeenCalled();
  });

  it('withholds the message of a non-exposable middleware error', () => {
    const captured: CapturedResponse = {};
    const internal = Object.assign(new Error('connection string: postgres://secret'), {
      status: 400,
      expose: false,
    });
    new AllExceptionsFilter(logger).catch(internal, makeHost(captured));

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body?.message).toBe('Internal server error');
  });

  it('still reports an unrecognised error as a logged 500', () => {
    const captured: CapturedResponse = {};
    new AllExceptionsFilter(logger).catch(new Error('boom'), makeHost(captured));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'req-1',
    });
    expect(error).toHaveBeenCalled();
  });

  it('does not mistake a bogus status on an error for an HTTP status', () => {
    const captured: CapturedResponse = {};
    const weird = Object.assign(new Error('nope'), { status: 42, expose: true });
    new AllExceptionsFilter(logger).catch(weird, makeHost(captured));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body?.message).toBe('Internal server error');
  });

  it('reports a 5xx middleware error as an error-level log', () => {
    const captured: CapturedResponse = {};
    const upstream = Object.assign(new Error('bad gateway'), { status: 502, expose: true });
    new AllExceptionsFilter(logger).catch(upstream, makeHost(captured));

    expect(captured.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(error).toHaveBeenCalled();
  });
});
