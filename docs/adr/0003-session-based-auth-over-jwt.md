# ADR-0003: Session-based auth (httpOnly cookie + Redis) over JWT bearer tokens

**Status:** Accepted
**Relates to:** Constitution Part V.1, V.7 (ADR-001 default recommendation), Article IV, VII

## Context

Part V.7 flags the access-token strategy as an open decision (ADR-001) with a stated default recommendation: httpOnly cookie sessions for the first-party web app, with separate long-lived API keys reserved for service accounts/integrations. Part V.1 requires local auth to always work without a mandatory third-party dependency (Article VIII); SSO/OIDC/SAML/LDAP are explicitly deferred to Phase 3 (P2) but must not be architecturally blocked.

## Decision

- Local auth only in Phase 0: email + argon2id-hashed password.
- Sessions are stored in **Redis** (`express-session` + `connect-redis`), referenced by an `itsm.sid` httpOnly, `sameSite=lax` cookie — not a signed-cookie-only session and not a JWT.
- CSRF is handled via the double-submit-cookie pattern (`csrf-csrf`), since cookie-based sessions (unlike bearer tokens) are vulnerable to CSRF.
- `User.passwordHash` is nullable and `User.mfaSecret` exists unused — both forward-compatible placeholders so Phase 3's SSO/MFA work is additive, not a schema migration fight.

## Rationale

A Redis-backed session can be **revoked instantly server-side** — disabling a user or forcing a logout takes effect on their very next request, with no denylist bookkeeping. A stateless JWT cannot do this without extra infrastructure (a revocation list), which contradicts Article IV/VII's audit and fail-safe requirements ("a disabled account must not still work because its token hasn't expired yet"). Since the Portal's own web client is the first-party consumer in Phase 0 (no mobile/desktop-native app yet — Part VI.7 defers native clients), the API-key path for service accounts loses nothing by session-auth being the human-login mechanism.

## Consequences

- Every mutating request from the browser must carry the `X-CSRF-Token` header alongside the session cookie; `GET /auth/csrf` mints a fresh token bound to the current session identifier.
- The session identifier changes on login (`session.regenerate()`, a session-fixation defense) — any CSRF token minted before login is invalid afterward; the frontend re-fetches a token post-login (see `apps/web/src/hooks/use-auth.ts`).
- When Phase 3 adds SSO/OIDC, it plugs into the same session-issuance path (an SSO callback ends the same way local login does: set `req.session.userId`) rather than requiring a parallel auth mechanism.
