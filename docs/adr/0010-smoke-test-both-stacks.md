# ADR-0010: CI smoke-tests both the prod and dev stacks over HTTP

**Status:** Accepted
**Relates to:** Constitution Part XIII (Testing Strategy), Article VII

## Context

Phase 0's CI ran lint, typecheck, unit tests, and `docker build` for both images. Two
container-level bugs still reached a merged PR and blocked the maintainer's first real
run:

1. The Prisma engine failure of ADR-0009 — invisible because `docker build` never starts
   a container, so the engine was never invoked.
2. The Vite dev server proxying `/api` to `http://localhost:3000`, which inside the `web`
   container is the web container itself. Every proxied request was refused
   (`ECONNREFUSED`), so login was impossible on the dev stack.

The second bug is the sharper lesson: a `smoke` job covering only the **prod** stack
would still pass, because prod serves the frontend through nginx, whose config already
proxied to the `api` service name correctly. The dev stack — Vite dev server, bind-mounted
source, hot reload — is what a contributor actually runs, and it had no coverage at all.

## Decision

Two CI jobs, both bringing up a real stack and exercising it over HTTP:

- **`smoke`** — `docker compose up -d --build` (prod). Asserts `GET /health` (proves
  migrations applied and Nest booted), `GET /api/v1/auth/csrf` (proves the Redis session
  layer works), and `GET :8080` (proves nginx serves the built frontend).
- **`smoke-dev`** — the dev compose overlay. Asserts the API and Vite both come up, then
  the critical one: `GET /api/v1/auth/csrf` **through the dev server on :5173** returns 200. That is the single assertion that fails on a bad proxy target while every other
  job in the workflow stays green.

Both dump `docker compose logs` on failure and tear down with `down -v` always.

## Consequences

- CI runtime grows by a few minutes. Worth it: both bugs above would have been caught
  pre-merge, and each cost a full diagnose/fix/rebuild cycle on the maintainer's machine.
- **Any new runtime dependency or service wiring change must be covered by a smoke
  assertion**, or it is effectively untested. Building an image proves it compiles;
  it proves nothing about whether it runs.
- The prod and dev stacks differ enough (nginx vs Vite, built vs mounted source) that
  neither substitutes for the other. Keep both.
