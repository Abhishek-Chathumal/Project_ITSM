# ADR-0001: Backend framework — NestJS (TypeScript)

**Status:** Accepted
**Relates to:** Constitution Part X (Technology Stack), Part I Article I (API-First)

## Context

The constitution leaves the backend framework choice open between Node.js + NestJS and Python + FastAPI, to be recorded as ADR-000 once decided. The Portal is a solo-developer project that needs strong typing, built-in dependency injection, and OpenAPI generation out of the box to satisfy Article I (every capability exists as a versioned REST API first).

## Decision

Use **Node.js + NestJS** with TypeScript for the backend.

- One language (TypeScript) across backend, frontend, and the shared `packages/shared` types package — reduces context-switching for a solo maintainer and lets DTOs/permission keys be shared verbatim between server and client (Article V).
- NestJS's module system, decorators, and Guard/Interceptor pipeline map directly onto the constitution's cross-cutting requirements: a global `PermissionGuard` for RBAC (Article II/III), a global exception filter for fail-safe logging (Article VII), and `@nestjs/swagger` for zero-effort OpenAPI docs (Article I).
- Built-in `@nestjs/config`, `@nestjs/throttler`, and first-class Passport/session support cover auth, rate limiting, and config needs called out in Part V/VI without extra framework glue.

## Consequences

- All future Phase 1+ modules (Tickets, Assets, SLA, Automation) follow the same Nest module/controller/service/guard pattern established in Phase 0.
- Node's single-threaded event loop is adequate at small-organization scale (Part XI's 99.5% availability target); CPU-heavy work (e.g. report aggregation) may need to move to a background worker later, which the architecture already anticipates via Redis/BullMQ (Part VI.4).
