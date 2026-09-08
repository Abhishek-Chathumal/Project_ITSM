# ADR-0012: The exception filter honours HTTP statuses raised by Express middleware

**Status:** Accepted
**Relates to:** Constitution Article VII (Fail Safe, Not Silent), Part V.7 (CSRF)

## Context

`AllExceptionsFilter` classified every exception by a single test: `instanceof
HttpException`. Anything else became `500 Internal Server Error`, logged at `error` level
as `"Unhandled exception"`.

That is correct for genuine faults, but the CSRF protection does not run inside Nest's
pipeline. `main.ts` installs it as Express middleware (`app.use(doubleCsrfProtection)`),
and on rejection `csrf-csrf` raises an `http-errors` `ForbiddenError`:

```js
{ code: 'EBADCSRFTOKEN', status: 403, statusCode: 403, expose: true }
```

It carries the right status, but it is not an `HttpException` — so a request with a
missing or stale CSRF token was answered with **500**, and logged as an unhandled server
fault. Confirmed against a running container, not inferred:

```
POST /api/v1/auth/login  (no X-CSRF-Token)  ->  HTTP 500
{"level":50,...,"err":{"type":"ForbiddenError","message":"invalid csrf token",
 "code":"EBADCSRFTOKEN","status":403,"expose":true},"msg":"Unhandled exception"}
```

The request was still refused, so this was never a hole — the protection failed closed.
The damage was to signalling and to observability:

- A client cannot distinguish "your CSRF token is stale, fetch a new one and retry" from
  "the server is broken". This matters here specifically: a Phase 0 bug was a CSRF token
  going stale after `session.regenerate()` on login, and the frontend's recovery path
  keys off the status it gets back.
- Every stale token produced an `error`-level log with a stack trace. Article VII wants
  failures loud, but routine 4xx traffic logged as unhandled 500s is noise that buries
  the real ones.

## Decision

The filter reads the `http-errors` convention when the exception is not an
`HttpException`: an integer `statusCode`/`status` within 400–599 is honoured as the
response status, and the error's `message` is returned **only** when `expose === true`,
which is `http-errors`' own signal that the text carries no internal detail. Anything
else remains a logged, sanitized 500. Log level follows the resolved status rather than
the exception's type, so 4xx is a `warn` and 5xx is an `error`.

Rejected alternatives:

- **Convert the CSRF error at the middleware site.** Fixes one caller. The same class of
  error arrives from any Express-level middleware — `body-parser`'s malformed-JSON 400 is
  already in the stack — so the filter is the right place.
- **Trust `statusCode` unconditionally.** An arbitrary thrown object with a `status`
  property would then steer the response. The integer-and-range check plus the `expose`
  gate keeps the trust narrow.

## Consequences

- A missing or invalid CSRF token now returns **403** carrying `invalid csrf token`, and
  malformed JSON returns **400**. Verified end to end against both the prod and dev
  stacks, including through the Vite dev proxy.
- `error`-level logs once again mean a genuine server fault.
- The filter has unit coverage for the first time (7 cases), including the regression
  itself, the `expose: false` path that must withhold a message, and a bogus out-of-range
  status that must still yield 500.
- **A middleware error's `requestId` is absent** from the response body, because the
  rejection happens before `nestjs-pino` assigns `req.id`. Nest-level errors are
  unaffected. Left as-is; worth revisiting if middleware rejections ever need tracing.
