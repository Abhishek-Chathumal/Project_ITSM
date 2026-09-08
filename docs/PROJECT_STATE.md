# Project state & handoff

Living record of where this project stands, how it got here, and what comes next.
**Update this at the end of any significant work session.**

Last updated: 2026-09-09 · Phase 0 complete; dependency/security pass and UI shell done;
Phase 1 ticketing not started.

---

## 1. How to resume in a new session

`CLAUDE.md` at the repo root is loaded automatically by Claude Code, so a new session
already knows the stack, conventions, and gotchas. You do **not** need to re-explain the
project. A resume prompt can be as short as:

> Continuing Project_ITSM. Read `docs/PROJECT_STATE.md` for current state, then let's
> start Phase 1 with <whatever you want>.

Key documents, in the order a newcomer should read them:

| File                                              | What it is                                                   |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `CLAUDE.md`                                       | Auto-loaded brief: stack, conventions, gotchas               |
| `docs/PROJECT_STATE.md`                           | This file — history, current state, roadmap                  |
| `docs/Support_Portal_Development_Constitution.md` | **The governing spec.** Source of truth for scope and design |
| `docs/adr/*.md`                                   | Why each architectural decision was made                     |
| `README.md`                                       | Setup/run instructions                                       |

---

## 2. Current state — what actually exists

**Phase 0 (Foundation) is complete, merged to `main`, and verified running** on the
maintainer's machine via Docker Compose. Login works end to end in the browser.

### Backend (`apps/api`, NestJS)

Modules: `Auth`, `Users`, `Roles`, `Permissions`, `Departments`, `Audit`, `OrgSettings`,
plus a `common/` layer (guards, decorators, exception filter, logging interceptor) and a
global `PrismaModule`.

Endpoints (all under `/api/v1`, Swagger at `/api/docs`):

| Method                | Path                                             | Guard                 |
| --------------------- | ------------------------------------------------ | --------------------- |
| GET                   | `/health`                                        | public (no prefix)    |
| GET                   | `/auth/csrf`                                     | public                |
| POST                  | `/auth/login`                                    | public                |
| POST                  | `/auth/logout`                                   | session               |
| GET                   | `/auth/me`                                       | session               |
| GET                   | `/audit-logs`                                    | `audit.view`          |
| GET/POST              | `/users`, `/users/:id` (GET, PATCH)              | `user.manage`         |
| GET/POST/PATCH/DELETE | `/roles`, `/roles/:id`, `/roles/:id/permissions` | `role.manage`         |
| GET                   | `/permissions`                                   | `permission.view`     |
| GET/POST              | `/departments`, `/departments/:id`               | `department.manage`   |
| GET/PUT               | `/org-settings`, `/org-settings/:key`            | `org_settings.manage` |

There is **no public registration** — users are created by an admin via `POST /users`.
This was deliberate (least privilege) and is a decision to revisit in Phase 1+ (§5).

### Data model (Prisma, `apps/api/prisma/schema.prisma`)

`User`, `Role`, `Permission`, `RolePermission`, `Department` (self-referencing hierarchy),
`AuditLog` (append-only), `OrgSettings`. `User.passwordHash` and `User.mfaSecret` are
nullable — forward-compat placeholders for SSO/MFA.

One migration exists: `20260908054618_init`.

### Seeded data (`apps/api/prisma/seed.ts`, idempotent upserts)

- **6 roles** (all `isSystemRole`): Requester, Technician, Team Lead, Change Manager,
  Admin, Auditor.
- **10 permissions**: `role.manage`, `permission.view`, `user.manage`,
  `department.manage`, `automation.manage`, `report.view.org`, `audit.view`,
  `org_settings.manage`, plus forward-declared `ticket.view.own` and
  `ticket.edit.assigned` for Phase 1.
- **Grants**: Admin gets all 10; Auditor gets `audit.view` + `report.view.org`;
  Requester / Technician / Team Lead / Change Manager get **zero** — this is the
  data-level proof of Article III, not an oversight.
- One "Unassigned" department; optional bootstrap admin gated by `SEED_BOOTSTRAP_ADMIN`.

### Frontend (`apps/web`, React + Vite + Tailwind)

Login page plus a protected app shell, rebuilt in a ServiceOps-inspired language
(ADR-0013). React Query for server state, Zustand for UI-only state.

- **Shell** — permission-gated sidebar driven by the `NAV_SECTIONS` data model in
  `components/layout/nav-items.ts`, collapsible to an icon rail (persisted) and an
  overlay drawer on mobile; top bar with create menu, theme toggle and account menu; a
  shared `PageHeader`. Modules that don't exist yet render disabled with a "Soon" tag
  rather than as dead links.
- **Primitives** (`components/ui`) — `Badge`/`StatusDot`/`IdChip`, `Avatar`, `Table`,
  `Tabs`/`TabPanel`, `DropdownMenu`, `StatTile`, `IconButton`,
  `Skeleton`/`EmptyState`/`ErrorState`, `Button`, `Card`, `Input`, `Switch`. No UI
  library — see ADR-0013 for when that should change.
- **Tokens** — Nord, extended with semantic `success`/`warning`/`danger`/`info`/`accent`
  tones (each with a `-subtle` fill) plus `sidebar`/`hover`/`ring`. Components take a
  `tone`, never a colour, so a restyle is an edit to `styles/globals.css`.
- **Dashboard** — live counts from the Phase 0 endpoints (users, roles, permissions,
  audit events), each query gated on the caller's permission; a recent-activity table off
  the audit trail; and the signed-in user's granted permissions. Ticket metrics read
  "Phase 1" rather than a fabricated `0`.

### Infra & CI

- `docker-compose.yml` (prod-like: nginx-served static frontend, compiled API) and
  `docker-compose.dev.yml` (Vite + `nest start --watch`, bind-mounted source).
- CI jobs: `lint`, `typecheck`, `test`, `build`, `smoke`, `smoke-dev` (+ GitGuardian),
  on `actions/checkout@v7` / `setup-node@v7` and Node 22.
- The API runtime image is a production-only install (`prod-deps` stage, ADR-0011); the
  dev stack masks every workspace `node_modules` with a named volume (gotcha 7).
- Tests: `PermissionGuard` and `AllExceptionsFilter` unit tests (api); login page render,
  `SideNav` permission gating, `DropdownMenu` keyboard/focus behaviour, `StatTile`
  loading-vs-zero and `initialsOf` (web) — 20 web tests, up from 1. **Still no
  integration or E2E coverage; that remains Phase 1 work.**

---

## 3. History — what was done and why

| PR  | What                                                                       |
| --- | -------------------------------------------------------------------------- |
| #1  | Phase 0 foundation: auth, RBAC, audit, modules, Docker, CI, ADRs 0001–0008 |
| #2  | Fix API container crash-loop (Alpine→Debian for Prisma) + add `smoke` job  |
| #3  | Fix dev-stack login (Vite proxy target) + add `smoke-dev` job              |
| #4  | Handoff docs: CLAUDE.md, PROJECT_STATE.md, constitution, ADRs 0009–0010    |
| #5  | `/update-state` and `/handoff` slash commands + workflow guide             |
| #6  | `docs/PHASE_PLAN.md`                                                       |

### The dependency & security pass (2026-09-09)

Phase 1's proposed first task, done before adding any feature surface. Took the tree from
**~31 advisories (1 critical, 9 high) to 0**, and each upgrade that broke something was
run for real rather than assumed:

- **Node 20→22, NestJS 10→11, vite 5→8, vitest 2→5, react-router-dom 6→7**, plus
  `@testing-library/*`. CI actions bumped to `@v7`.
- **`rxjs` pinned by a root `overrides`.** `@angular-devkit/*` (via the Nest 11 CLI) pins
  rxjs to exactly `7.8.1`, forcing a second nested copy under `apps/api` while
  `@nestjs/common` resolved `7.8.2`. Two copies means two structurally incompatible
  `Observable` types, and `typecheck` fails on the logging interceptor.
- **The lockfile was regenerated from scratch.** It had been updated incompletely and was
  missing transitive deps of the Nest 11 CLI entirely (`ansis`), so `nest build` died with
  `Cannot find module`.
- **`@testing-library/jest-dom` no longer uses its own `/vitest` entry.** npm hoists
  jest-dom to the root while vitest stays nested under `apps/web`, so that entry cannot
  resolve `vitest`. The matchers are registered explicitly instead, and
  `apps/web/src/jest-dom-matchers.d.ts` carries the type augmentation — jest-dom 7.0.1
  still declares `Assertion<T>` (vitest ≤4) where vitest 5 wants `Assertion<R, T>`, and a
  merge with a mismatched parameter list is silently not applied.
- **A `.gitattributes` pinning LF.** With `core.autocrlf=true` on Windows, Prettier's
  `endOfLine: "lf"` flagged all 111 files, so `npm run format:check` — part of the
  documented pre-push gate — could never pass locally while CI stayed green.
- Plus ADR-0011 (production-only runtime image) and ADR-0012 (exception filter), and bugs
  6 and 7 below.

Verified by bringing both stacks up locally on isolated ports and a separate compose
project: health, CSRF, RBAC (200 with permission, 401 without), audit rows written, the
Vite `/api` proxy, and a full login whose `/auth/login` and `/auth/me` payloads are
byte-identical — the Phase 0 crash that is easiest to reintroduce.

### The UI shell (2026-09-09)

Prompted by the maintainer supplying Motadata ServiceOps screenshots as a reference for
density and layout. Phase 0's frontend was a placeholder — a text-only sidebar with no
routing and a one-paragraph dashboard — and Phase 1 needs list views, detail layouts and
status indicators that did not exist.

Built the shell and the reusable primitive layer, in-house on the Nord tokens rather than
adopting a component library (**ADR-0013** covers the reasoning, and names focus-trapped
modals / comboboxes / date pickers as the point where that should be revisited). See the
Frontend section above for what exists. Verified in a real browser against a running
stack, in both themes, at rail and expanded widths.

What was deliberately **not** built: the Tickets list and ticket-detail screens. Those
belong with the Phase 1 backend, and the primitives they need are now in place.

### Bugs found and fixed (all caught by running it for real, not by tests)

1. **`/auth/me` and `/auth/login` returned different shapes** — `me` returned the internal
   flat `AuthenticatedUser`, `login` returned nested `SessionUserDto`. React Query's
   background refetch overwrote the cache with the wrong shape and crashed `TopBar` on
   `user.role.name`. Fixed by giving `me` its own `getSessionUserDto()`.
2. **CSRF token reuse crash** — `csrf-csrf`'s `generateToken` defaults to
   reuse-and-revalidate; after login regenerates the session id, the stale token failed
   revalidation and it _threw_ instead of minting a new one. Fixed by always passing
   `overwrite=true`. The frontend also invalidates its cached token after login/logout.
3. **Missing `prisma generate` in CI's test job** — `npm ci` doesn't auto-generate because
   the schema isn't at the conventional root path.
4. **Prisma engine on Alpine** — see ADR-0009.
5. **Vite dev proxy pointing at `localhost`** — see ADR-0010.
6. **A missing CSRF token answered 500 instead of 403** — `csrf-csrf` rejects from Express
   middleware, outside Nest's pipeline, so its `http-errors` `ForbiddenError` was not an
   `HttpException` and the catch-all filter collapsed it to a 500 logged as an unhandled
   fault. It always failed closed, so this was signalling and observability, not a hole.
   See ADR-0012.
7. **The dev web container stopped booting after the vite 8 upgrade** — npm nested `vite`
   under `apps/web/node_modules`, which the repo bind-mount served from the Windows host,
   so the container tried to execute a Windows shim (`node.exe: not found`). Fixed by
   masking every workspace `node_modules` with its own named volume (gotcha 7).

The recurring theme: _building_ something proves far less than _running_ it. That's why
both smoke jobs exist now — and why bugs 6 and 7 were found by bringing the stacks up
locally rather than by any unit test.

---

## 4. Known debt

- **Thin test coverage** — the guard spec, the exception-filter spec (added with ADR-0012),
  and one component render test. The constitution (Part XIII) asks for integration tests
  incl. RBAC enforcement and E2E journeys. **Still the largest gap.**
- `Prisma 5.22` — an 8.x major exists. Upgrade deliberately, not incidentally; the CLI
  prints an upgrade notice on every `generate`.
- **Middleware-level rejections carry no `requestId`** in the response body, because
  `nestjs-pino` assigns `req.id` after the CSRF middleware has already rejected. Nest-level
  errors are unaffected. See ADR-0012's consequences.
- `eslint` is still on 8.x (EOL) with `@typescript-eslint` 7.x. Not vulnerable, but a
  flat-config migration is coming whether or not it is planned for.
- **`npm audit` runs nowhere in CI.** The dependency pass took the tree to zero
  advisories, but nothing enforces it — a newly introduced vulnerable dependency merges
  unnoticed. Veracode SCA (ADR-0014) closes this once `SRCCLR_API_TOKEN` is configured;
  a free `npm audit` job in `ci.yml` would close it unconditionally. **Not yet done.**
- The Veracode scan and upload steps in `security-scan.yml` are **unvalidated** — they
  need credentials that only exist as GitHub Actions secrets, so they cannot be exercised
  from a dev machine. Packaging was verified locally; the scans await their first run.

### Resolved since Phase 0

- ~~**Dependency vulnerabilities** (~31 advisories, 1 critical, 9 high)~~ — **now 0**, via
  Node 20→22, NestJS 10→11, vite 5→8, vitest 2→5, react-router-dom 6→7, and
  `@testing-library/*` bumps. `npm audit` and `npm audit --omit=dev` are both clean.
- ~~Deprecated `actions/checkout@v4`/`setup-node@v4` on Node 20~~ — now `@v7` on Node 22.
- ~~No `.dockerignore`~~ — added; keeps `.env` and `.git` out of the build context.
- ~~Build tooling shipped in the runtime image~~ — a `prod-deps` stage cut the API image
  from 1.01 GB to 537 MB. See ADR-0011.

---

## 5. Roadmap

> **Detailed, execution-ready breakdown: [`PHASE_PLAN.md`](PHASE_PLAN.md).**
> The summary below is the shape; that document is what to work from.

### Constitution phases (Part XII)

| Phase | Scope                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0 ✅  | Foundation — repo, CI, Docker, migrations, local auth, RBAC skeleton                                                           |
| 1     | **Incident + Service Request ticketing**, unified workflow, categorization, attachments, My Tickets, basic email notifications |
| 2     | Asset/CMDB, SLA/OLA + business calendars, Knowledge Base, Service Catalog w/ dynamic forms, CSAT                               |
| 3     | Automation/business rules engine, custom fields, report/dashboard builder, approvals, SSO/MFA                                  |
| 4     | Problem Management, Change Enablement + calendar, inbound/outbound webhooks, email-to-ticket                                   |
| 5     | PWA polish + push, optional Tauri desktop, optional native mobile, OpenSearch swap                                             |

### Maintainer-added scope (beyond the original constitution)

Raised in conversation; **not yet designed**. Each needs an ADR when tackled, because the
constitution assumed admin-only user creation:

- Additional **login options** / changes to the login process.
- **Self-service account creation** and/or **bulk user import**.
- **Account activation and email verification** flows.
- **Custom permission creation/definition** by admins — note the design tension: permission
  keys are currently referenced in code via `@RequirePermission(...)`, so admin-invented
  keys can't gate routes that don't exist. Needs a deliberate design (e.g. scoping custom
  permissions to data-level rules or custom fields/workflows) — bring options, don't guess.
- **Cloud hosting** once the app is usable for real work.

### Standing constraints

- **Security is top priority at every level** (maintainer's explicit instruction).
  Least privilege, audit everything, rate-limit public endpoints, no secrets in git,
  TLS in transit, and a dependency-vulnerability pass before each hosting milestone.
- Expect **significant UI/theme/component churn** as the maintainer iterates. Keep the
  security core decoupled from presentation so restyling never touches authorization.

---

## 6. Maintainer's environment

- **Windows**, PowerShell 7. Repo at `C:\Development\Project_ITSM`.
- **Docker Desktop** with WSL2 backend (needed a reboot post-install before the
  `docker-desktop` WSL distro was provisioned — that was the fix for "unable to start").
- Node 22 LTS + Git installed via `winget`. **PATH changes need a fresh terminal.**
- Editor: **Antigravity IDE** (VS Code-based). Not an officially supported Claude Code
  integration. Working model: this chat drives development and pushes to GitHub; the
  maintainer pulls in Antigravity to read, run, and test. The `claude` CLI can be run in
  Antigravity's integrated terminal for a local session.
- Development happens through the chat; the maintainer runs and tests locally and reports
  back. **Verify changes end to end, not just via unit tests.**

### Workflow that has been working

1. Work on branch `claude/inhouse-itsm-platform-opbl8q` (branched fresh from `main` each
   time the previous PR merges).
2. Verify locally: lint/typecheck/test/build + actually exercise the feature.
3. Push, open a PR, let CI (incl. both smoke jobs) validate.
4. Maintainer merges; then pulls and runs locally to confirm.

Note: the authoring sandbox **cannot reach Docker Hub**, so container builds can't be
verified there — CI's smoke jobs are the check for anything container-level. Say so
plainly rather than claiming verification that didn't happen.
