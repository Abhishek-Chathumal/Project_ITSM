# Project state & handoff

Living record of where this project stands, how it got here, and what comes next.
**Update this at the end of any significant work session.**

Last updated: 2026-09-09 · Phase 0 complete; dependency/security pass, UI shell, and
security scanning (SAST/SCA, ADR-0014) done, plus the production `SESSION_SECRET`
requirement (ADR-0015) and the CI `npm audit` job that closes Phase 1 Slice 1;
Phase 1 ticketing (Slice 2 onward) not started.

---

## 1. How to resume in a new session

`CLAUDE.md` at the repo root is loaded automatically by Claude Code, so a new session
already knows the stack, conventions, and gotchas. You do **not** need to re-explain the
project. A resume prompt can be as short as:

> Continuing Project_ITSM. Read `docs/PROJECT_STATE.md` for current state, then let's
> start Phase 1 with <whatever you want>.

**First, orient on anything in flight**, which no document can state without going stale:
`git status && git log --oneline -5` for where the tree is, and `gh pr list` for open PRs
(a session may be resuming with work already up for review). Then read §4 — known debt is
where the unfinished business lives, and each item says whether it blocks anything.

Key documents, in the order a newcomer should read them:

| File                                              | What it is                                                   |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `CLAUDE.md`                                       | Auto-loaded brief: stack, conventions, gotchas               |
| `docs/PROJECT_STATE.md`                           | This file — history, current state, roadmap                  |
| `docs/Support_Portal_Development_Constitution.md` | **The governing spec.** Source of truth for scope and design |
| `docs/PHASE_PLAN.md`                              | **The execution plan.** What each phase delivers, per slice  |
| `docs/adr/*.md`                                   | Why each architectural decision was made                     |
| `README.md`                                       | Setup/run instructions                                       |
| `docs/WORKFLOW.md`                                | Day-to-day: machines, git, uploads, end-of-session ritual    |

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
- CI jobs: `lint`, `audit`, `typecheck`, `test`, `build`, `smoke`, `smoke-dev`
  (+ GitGuardian), on `actions/checkout@v7` / `setup-node@v7` and Node 22. `audit` runs
  `npm audit` over the **full** dependency tree, gating on high and above and publishing
  the complete report as an `npm-audit` artifact — Veracode SCA sees only the production
  subset, so the two are complements.
- `security-scan.yml` (ADR-0014): `preflight`, `package`, `sast-pipeline` (PR gate, High
  and above), `sast-policy` (`main` + weekly), `sca`. Every run publishes the full findings
  as a `sast-findings` artifact for 30 days, sub-gate ones included. **`sast-policy` is
  knowingly red** — see §4.
- Actions are pinned and on Node 24 wherever we control them: `checkout@v7`,
  `setup-node@v7`, `upload-artifact@v7.0.1`, `download-artifact@v8.0.1`,
  `Veracode-pipeline-scan-action@v1.0.25`, `veracode-sca@v2.1.20`. The one exception is
  `veracode-uploadandscan-action@0.2.11` (`node20`), which is Veracode's newest — see §4.
- The API runtime image is a production-only install (`prod-deps` stage, ADR-0011); the
  dev stack masks every workspace `node_modules` with a named volume (gotcha 7).
- Tests: `PermissionGuard`, `AllExceptionsFilter` and `configuration` unit tests (api, 23);
  login page render, `SideNav` permission gating, `DropdownMenu` keyboard/focus behaviour,
  `StatTile` loading-vs-zero and `initialsOf` (web) — 20 web tests, up from 1. **Still no
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

### Making the scanners tell the truth (2026-09-09)

Two rounds, both about a gate being trustworthy rather than merely green.

**The findings became reviewable** (PR #9). The SAST job uploaded only
`filtered_results.json` — the findings above the fail threshold, an empty array — so
everything below the gate lived in a job log that ages out. `results.json` is now published
for 30 days. That is what turned "the policy scan says Did Not Pass while every PR is
green" from a mystery into a line number.

**The one finding it exposed was real** (PR #10, ADR-0015). CWE-259 pointed at
`sessionSecret`'s fallback, which signs session cookies _and_ seeds CSRF tokens — so an
unset `SESSION_SECRET` meant forgeable sessions and a bypassable CSRF check, and nothing
failed to say so. The live path was worse than the code: `docker-compose.yml` ran
`NODE_ENV=production` while supplying the `.env.example` placeholder itself, which is 33
characters, so neither a presence nor a length check would have caught it. Fixed in two
layers — the config factory refuses missing/blank/placeholder/short secrets in production
(a throw inside `NestFactory.create`, before a port is bound), and compose stopped
defaulting the value. Verified by running it: compose errors at interpolation, and the
built API exits 1 on the placeholder before any DB connection.

Two things worth remembering from it:

- **The Medium did not clear, and the ADR was corrected to say so.** CWE-259 simply
  retargets to the remaining dev-only literal. It is dismissed under Part XIII rather than
  chased, because clearing it outright means a random-per-boot dev secret that breaks the
  local login on most edits. §4 records the platform mitigation that would actually clear it.
- **GitGuardian caught a test fixture in the fix's own first push**: a 42-character
  high-entropy string is indistinguishable from a leaked credential, and a `sh0rt-but-secret`
  value assigned to `SESSION_SECRET` reads as entropy too. Both fixtures are now generated
  or plain words — fixed in the code, not by adding a scanner ignore rule. Because
  GitGuardian scans every commit in a PR, the branch had to be squashed to remove the
  literal from its history; a follow-up commit does not clear it.

### The CI audit job, and the six highs it found (2026-09-09)

The last open item from Phase 1's Slice 1. `ci.yml` gained an `audit` job (details in §4's
resolved list), and it earned its place immediately: the full tree had **six high-severity
advisories** that nothing in CI was looking at.

All six trace to one root — **`multer <= 2.2.0`** (four DoS advisories plus a file-size-limit
bypass), reached through `@nestjs/platform-express`. The other five entries npm reports
(`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `@nestjs/testing`,
`nestjs-pino`) are transitive echoes of that one package, not separate problems. Five of the
six are in the production tree, so this was live surface, not a dev-only nuisance.

Two things about the fix are worth keeping:

- **Upstream cannot be waited for.** `@nestjs/platform-express` pins `multer` to exactly
  `2.2.0` — in 11.2.3 and still in the current 12.0.1 — so no Nest upgrade clears it. The
  fix is a root `overrides` entry (`"multer": "^2.3.0"`), the same lever already used to
  pin `rxjs`. `npm audit` is clean on the full tree afterwards.
- **`npm` will not apply a new `overrides` entry while `node_modules` exists.** Adding the
  entry and re-running `npm install` — with `--force`, with `--package-lock-only`, even
  after deleting `package-lock.json` — reported "up to date" and left `multer` at 2.2.0,
  because npm resolved against the hidden lockfile in `node_modules`. Only a resolve with
  no `node_modules` present picked it up. If an override looks ignored, that is why.
  (The regenerated lockfile also hoists `vite`/`vitest` from `apps/web/node_modules` to the
  root, reversing what gotcha 7 described. Both layouts are masked by named volumes in the
  dev stack, and `smoke-dev` is the check that it still boots.)

The npm that generates the lockfile matters too: **npm 10 drops the `libc` fields** that
optional-dependency selection uses on musl vs glibc, so it silently downgrades a lockfile
written by npm 11+. Regenerate with the newer npm, not with the version in `packageManager`.

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
  the config spec (added with ADR-0015), and one component render test. The constitution
  (Part XIII) asks for integration tests incl. RBAC enforcement and E2E journeys.
  **Still the largest gap.**
- `Prisma 5.22` — an 8.x major exists. Upgrade deliberately, not incidentally; the CLI
  prints an upgrade notice on every `generate`.
- **Middleware-level rejections carry no `requestId`** in the response body, because
  `nestjs-pino` assigns `req.id` after the CSRF middleware has already rejected. Nest-level
  errors are unaffected. See ADR-0012's consequences.
- `eslint` is still on 8.x (EOL) with `@typescript-eslint` 7.x. Not vulnerable, but a
  flat-config migration is coming whether or not it is planned for.
- **`sast-policy` fails on `main`, by a disposition rather than by neglect — and so its
  verdict is currently worthless as a signal.** It is now validated: it runs, completes
  (`Results Ready`), and returns `Did Not Pass` on one Medium — CWE-259 against the
  deliberate dev-only `SESSION_SECRET` fallback at `configuration.ts:15`. That Medium is
  below the High-and-above PR gate, so `sast-pipeline` passes and PRs are unaffected.
  Dismissed under Part XIII with the rationale in ADR-0015.
  **What is _not_ the cause, though it is the last line of the log:** a Node deprecation
  `##[warning]` printed during `Complete job`, after the scan has already finished. It has
  misled a read of this job once. `actions/upload-artifact` and `actions/download-artifact`
  are on `v7.0.1` / `v8.0.1` (both `node24`) so they no longer appear in it, but
  `veracode/veracode-uploadandscan-action@0.2.11` declares `using: node20` and is the newest
  release Veracode publishes — so the warning persists here until they ship a Node 24 build.
  It fails nothing.
  **The follow-up that actually clears it:** approve a mitigation on the finding in the
  Veracode platform (the app's latest static scan → the CWE-259 finding → Mitigate by
  Design, citing ADR-0015). Needs Veracode access and a human with the approver role, so it
  cannot be done from CI or by an agent. Until then, treat a red `sast-policy` as expected
  and read `sast-findings` instead. **Not yet done.**

  **Right now it is failing for a second, unrelated reason, and this one needs a human.**
  On 2026-09-09 two PRs (#12, #13) were merged ~50 seconds apart. Each push to `main`
  starts a policy scan against the same Veracode application profile, and that profile
  takes one build at a time, so the second submission was refused:

  ```
  * App not in state where new builds are allowed.
    Scan status is Incomplete
  * A scan has failed to complete successfully. Delete the failed scan from the
    Veracode Platform and try again.
  ```

  It does not clear on a re-run — attempt 2 failed identically. **Remedy:** delete the
  incomplete scan in the Veracode Platform, then re-run the `security-scan` workflow on
  `main`. After that the job should return to failing on `Did Not Pass`, which is the
  documented disposition above. Until the profile is cleared, `sast-policy` is telling you
  nothing about the code at all.

  **To avoid repeating it:** let one `security-scan` run on `main` finish before merging the
  next PR. Nothing else in CI cares, only this job.

- **Two GitGuardian incidents may still read "Triggered"** in the dashboard (37100835, 37100836) from test fixtures committed and then removed while fixing ADR-0015. Both were
  invented values, never real credentials, so nothing needs rotating — but they should be
  resolved as test fixtures so the dashboard keeps meaning something. The PR check itself is
  green ("no secrets present in this pull request anymore"). Dashboard-only housekeeping.

### Resolved since Phase 0

- ~~**`npm audit` runs nowhere in CI, and Veracode SCA does not substitute for it**~~ —
  `ci.yml` now has an `audit` job. It gates on **high and above** (matching
  `sast-pipeline`'s threshold) and publishes the complete `npm audit --json` as an
  `npm-audit` artifact for 30 days, so moderates and lows stay reviewable instead of
  aging out with the job log. It runs no `npm ci` — npm resolves advisories from
  `package-lock.json` alone — so it costs a runner-minute, not a full install.
  **It found six highs on its first run**, which is the argument for it in one line: see
  the multer entry below.

- ~~**Dependency vulnerabilities** (~31 advisories, 1 critical, 9 high)~~ — **now 0**, via
  Node 20→22, NestJS 10→11, vite 5→8, vitest 2→5, react-router-dom 6→7, and
  `@testing-library/*` bumps. `npm audit` and `npm audit --omit=dev` are both clean.
- ~~Deprecated `actions/checkout@v4`/`setup-node@v4` on Node 20~~ — now `@v7` on Node 22.
- ~~No `.dockerignore`~~ — added; keeps `.env` and `.git` out of the build context.
- ~~Build tooling shipped in the runtime image~~ — a `prod-deps` stage cut the API image
  from 1.01 GB to 537 MB. See ADR-0011.
- ~~**A missing `SESSION_SECRET` booted anyway on a fallback baked into the source**~~ —
  production now refuses to boot on a missing, blank, placeholder or under-32-character
  secret, and `docker-compose.yml` no longer supplies a default (it previously handed the
  production stack the `.env.example` placeholder). See ADR-0015.
  ⚠️ **Breaking for any deployment that relied on that compose default** — it will now stop
  at interpolation until given a real secret. Rotating the secret invalidates live sessions,
  so everyone re-authenticates once. Development is unaffected: the stable fallback remains,
  so a local login survives watch-mode reloads.

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
