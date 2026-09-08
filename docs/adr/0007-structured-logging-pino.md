# ADR-0007: Structured logging via pino, with a catch-all exception filter

**Status:** Accepted
**Relates to:** Constitution Part X (Observability), Article VII (Fail Safe, Not Silent)

## Context

Article VII requires automation and integration failures — and by extension, any backend failure — to be logged visibly to admins; nothing may fail silently. Part X's stack table names structured JSON logging as the baseline observability requirement.

## Decision

- **`nestjs-pino`** (wrapping `pino` + `pino-http`) replaces Nest's default logger app-wide (`app.useLogger(app.get(Logger))` in `main.ts`). Every request/response is logged as a JSON line automatically, in production; pretty-printed only in development (`NODE_ENV` check) for local readability.
- **`AllExceptionsFilter`** (a global `APP_FILTER`) is the single place an unhandled exception is turned into a client response: 5xx and non-HTTP exceptions are logged at `error` level with the full error object and a request id; 4xx are logged at `warn`. The client always receives a sanitized `{ statusCode, message, requestId }` body — full stack traces never leak over the wire, but nothing is ever swallowed without a log line either.

## Consequences

- Every future module's errors are automatically captured by the same filter — no module needs its own try/catch-and-log boilerplate for the "don't fail silently" requirement.
- The `requestId` on both the log line and the error response lets an admin correlate a user-reported error with the exact server-side log entry.
- Log lines are JSON on stdout, which Docker captures natively — no log-shipping agent is required in Phase 0 (Article VIII), while remaining straightforward to pipe into a log aggregator later without changing application code.
