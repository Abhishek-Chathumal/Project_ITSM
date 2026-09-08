# Project_ITSM — working brief

Self-hosted, ITIL4-aligned ITSM platform for a small organization. Solo maintainer.
Browser-based, desktop + mobile friendly. Destined for cloud hosting once mature;
**security is a standing top priority at every phase.**

The governing spec is [`docs/Support_Portal_Development_Constitution.md`](docs/Support_Portal_Development_Constitution.md).
It is the source of truth — read the relevant Part before designing a feature.
Detailed project history, current state, and roadmap: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).
Day-to-day workflow (machines, git, file uploads): [`docs/WORKFLOW.md`](docs/WORKFLOW.md).
What each phase delivers, sliced for execution: [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md).

Slash commands: **`/update-state`** refreshes the project docs; **`/handoff`** does that
plus verify, commit, and push — the end-of-session ritual before switching machines.

**Status: Phase 0 (Foundation) complete and running.** Phase 1 (ticketing) not started.

## Stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Backend      | NestJS + TypeScript (`apps/api`)                  |
| DB           | PostgreSQL 15 via Prisma                          |
| Sessions     | Redis (`express-session` + `connect-redis`)       |
| Frontend     | React + Vite + TypeScript + Tailwind (`apps/web`) |
| Shared types | `packages/shared` (`@itsm/shared`)                |
| Monorepo     | npm workspaces + Turborepo                        |
| Deploy       | Docker Compose, fully self-hosted                 |

Decisions are recorded as ADRs in `docs/adr/`. **Add an ADR for any new architectural
decision or deviation from the constitution** (constitution Part XIV requires it).

## Run it

```bash
# Docker (primary path)
cp .env.example .env        # set SESSION_SECRET
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
# web http://localhost:5173 · api http://localhost:3000 · swagger /api/docs

# Native (needs local Postgres + Redis)
npm ci && npm run build -w @itsm/shared
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
cd apps/api && npx prisma db seed && cd ../..
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

Seeded dev login comes from `.env`: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
(defaults `admin@example.com` / `ChangeMe123!`). Seeding only happens when
`SEED_BOOTSTRAP_ADMIN=true`.

## Conventions that must be followed

**Authorization — never reinvent it.** Every protected route uses the existing
mechanism; new capabilities are new _data_, not new guard logic:

```ts
@RequirePermission(PERMISSIONS.TICKET_EDIT_ASSIGNED)   // key from @itsm/shared
```

- `SessionAuthGuard` + `PermissionGuard` are global (`APP_GUARD`), fail-closed.
  Opt a route out of auth with `@Public()`.
- Permission keys live in `packages/shared/src/permissions.ts` and are seeded as
  `Permission` rows. Adding a capability = add key + seed row + decorate the route.
- Frontend permission checks (`useAuth().isAllowed(key)`) are **UX only**. The server
  re-checks every request. Never treat a hidden button as a security control.
- New roles start with **zero** permissions (constitution Article III).

**Audit everything that changes state** (Article IV). Call `AuditService.record(...)`
from the service performing the mutation. `AuditLog` is append-only — there is
deliberately no update/delete method anywhere. Keep it that way.

**One DTO shape per concept** (Article V). Shared response types live in
`packages/shared/src/types.ts`. `/auth/login` and `/auth/me` must return the _same_
`SessionUserDto` — they diverged once and crashed the frontend.

**Failures must be loud** (Article VII). The global `AllExceptionsFilter` logs with a
requestId and returns a sanitized body. Don't swallow errors locally.

**Config over code** (Article II). Roles, permissions, and (later) workflows/SLAs/fields
are admin-editable data, not hardcoded switches.

## Before you push

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format:check
```

CI runs these plus `build` (Docker images), `smoke` (prod stack over HTTP) and
`smoke-dev` (dev stack, incl. the Vite→API proxy). All must be green.

## Hard-won gotchas — do not regress these

Each of these was a real production-blocking bug. They're fixed; keep them fixed.

1. **Prisma needs a Debian base image, not Alpine.** On musl, Prisma mis-detects
   OpenSSL, loads an `openssl-1.1.x` engine, and dies with
   `Could not parse schema engine response`. `api.Dockerfile` uses
   `node:20-bookworm-slim` + explicit `openssl`; `schema.prisma` pins
   `binaryTargets = ["native", "debian-openssl-3.0.x"]`. (ADR-0009)

2. **The Vite dev proxy must target the compose service name.** Inside the `web`
   container `localhost` is that container. `vite.config.ts` reads
   `DEV_API_PROXY_TARGET`; `docker-compose.dev.yml` sets it to `http://api:3000`.
   Not `VITE_`-prefixed on purpose — it must not enter the client bundle.

3. **`packages/shared` builds dual CJS + ESM.** Rollup can't statically analyse named
   exports from CJS, so a CJS-only build breaks the production web build with
   "is not exported by". Don't collapse it back to one output.

4. **`prisma generate` must run before migrate/seed** in any fresh environment —
   `npm ci` won't do it, because the schema isn't at the conventional root path.

5. **Changing a base image? `docker compose ... down -v` first.** The
   `api_node_modules`/`web_node_modules` volumes persist native binaries built for the
   old libc and will not be re-created by a plain `down`.

6. **Building an image proves nothing about running it.** That's why `smoke` and
   `smoke-dev` exist. If you add a runtime dependency or change how a service is
   wired, make sure a smoke job actually exercises it.

## Working style that fits this project

- The maintainer runs the app locally and tests it for real; verify changes end to end
  (curl the API, drive the UI) rather than trusting unit tests alone.
- Build in reviewable slices, verifying each before moving on.
- Expect UI/theme/component churn — keep the security core decoupled from presentation.
- Theme is Nord (see `apps/web/src/styles/globals.css`); it's token-driven, so a
  restyle is a token edit, not a component rewrite.
