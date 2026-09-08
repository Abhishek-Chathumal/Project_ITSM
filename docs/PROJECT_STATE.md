# Project state & handoff

Living record of where this project stands, how it got here, and what comes next.
**Update this at the end of any significant work session.**

Last updated: 2026-09-08 · Phase 0 complete, Phase 1 not started.

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

Login page, protected shell (top bar + collapsible side nav), dashboard placeholder.
Nord palette, light/dark toggle persisted to `localStorage`. React Query for server state,
Zustand for UI-only state. Nav items for Tickets / Service Catalog / Assets are visible but
disabled; Reports / Admin are permission-gated.

### Infra & CI

- `docker-compose.yml` (prod-like: nginx-served static frontend, compiled API) and
  `docker-compose.dev.yml` (Vite + `nest start --watch`, bind-mounted source).
- CI jobs: `lint`, `typecheck`, `test`, `build`, `smoke`, `smoke-dev` (+ GitGuardian).
- Tests: `PermissionGuard` unit tests (api), login page render test (web). **Coverage is
  thin — expanding it is Phase 1 work.**

---

## 3. History — what was done and why

Three PRs, all merged to `main`:

| PR  | What                                                                       |
| --- | -------------------------------------------------------------------------- |
| #1  | Phase 0 foundation: auth, RBAC, audit, modules, Docker, CI, ADRs 0001–0008 |
| #2  | Fix API container crash-loop (Alpine→Debian for Prisma) + add `smoke` job  |
| #3  | Fix dev-stack login (Vite proxy target) + add `smoke-dev` job              |

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

The recurring theme: _building_ something proves far less than _running_ it. That's why
both smoke jobs exist now.

---

## 4. Known debt

- **Dependency vulnerabilities**: `npm ci` reports ~31 advisories (1 critical, 9 high) in
  the Phase 0 tree. **Triage before adding surface area or hosting publicly.** This was
  the proposed first task of Phase 1.
- **Thin test coverage** — one guard spec and one component render test. The constitution
  (Part XIII) asks for integration tests incl. RBAC enforcement and E2E journeys.
- GitHub Actions warns that `actions/checkout@v4`/`setup-node@v4` run on deprecated
  Node 20; harmless today, will need bumping.
- `Prisma 5.22` — an 8.x major exists. Upgrade deliberately, not incidentally.
- No `.dockerignore`, so build context includes more than needed.

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
- Node 20 LTS + Git installed via `winget`. **PATH changes need a fresh terminal.**
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
