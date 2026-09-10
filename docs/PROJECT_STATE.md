# Project state & handoff

Living record of where this project stands, how it got here, and what comes next.
**Update this at the end of any significant work session.**

Last updated: 2026-09-09 · **The spec was revised and Phase 0 is re-opened.** A rewritten
constitution plus a new companion — the Functional Reference — brought six amendments;
**A-001 replaces the two-layer permission model with a three-layer one and moves
access-control foundations into Phase 0** (ADR-0017). Nothing built is wrong; it is now
measured against a larger requirement.

Merged and sound: Phase 1 **Slices 1 and 2** (the CI `npm audit` job and the six high
advisories it found; the ticket data model, ADR-0016), plus **Node 22 → 24**,
**Prisma 5.22 → 6.19.3**, and the Veracode profile-stranding bug fixed in the workflow rather
than in a human's memory. **Slice 3's groundwork is superseded before it was ever used** —
see §4b.

---

## 1. How to resume in a new session

`CLAUDE.md` at the repo root is loaded automatically by Claude Code, so a new session
already knows the stack, conventions, and gotchas. You do **not** need to re-explain the
project. A resume prompt can be as short as:

> Continuing Project_ITSM. Read `docs/PROJECT_STATE.md` §4b for what's in flight, then
> let's start <whatever you want>.

Note the phase numbering shifted: **Amendment A-001 re-opened Phase 0**, so "start Phase 1"
is no longer the right instruction — see §4b.

**First, orient on anything in flight**, which no document can state without going stale:
`git status && git log --oneline -5` for where the tree is, and `gh pr list` for open PRs
(a session may be resuming with work already up for review).

Then read, in this order:

1. **§4b — In flight.** What is half-built, what is superseded, and the next concrete unit of
   work. Start here; it is the shortest path to being useful.
2. **§4 — Known debt.** Each item says whether it blocks anything.
3. **§3 — History**, only if you need the reasoning behind something that looks odd. Most of
   it is there because a plausible-looking alternative failed in a way that cost a day.

Key documents, in the order a newcomer should read them:

| File                                              | What it is                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                       | Auto-loaded brief: stack, conventions, gotchas                                                                                  |
| `docs/PROJECT_STATE.md`                           | This file — history, current state, roadmap                                                                                     |
| `docs/Support_Portal_Development_Constitution.md` | **The governing spec.** What to build and why                                                                                   |
| `docs/Support_Portal_Functional_Reference.md`     | **Its companion.** How it behaves — fields, rules, algorithms, the permission catalogue. Its **Part Q amends the constitution** |
| `docs/PHASE_PLAN.md`                              | **The execution plan.** What each phase delivers, per slice                                                                     |
| `docs/adr/*.md`                                   | Why each architectural decision was made                                                                                        |
| `README.md`                                       | Setup/run instructions                                                                                                          |
| `docs/WORKFLOW.md`                                | Day-to-day: machines, git, uploads, end-of-session ritual                                                                       |

---

## 2. Current state — what actually exists

**Everything below is merged to `main` and verified running** on the maintainer's machine via
Docker Compose. Login works end to end in the browser.

> ⚠️ **"Phase 0 complete" is withdrawn.** Amendment A-001 rephased Part XII and moved the
> access-control foundations — permission catalogue seeded from a manifest, `PermissionSet` /
> `UserRole` / scoped `RolePermission` tables, the `applyScope()` helper, and
> `User.manager_id` + `reporting_path` with cycle protection — **into Phase 0**, because
> retrofitting scope enforcement means auditing every query in the system. ADR-0017 carries
> the gap table. What exists is sound and none of it is wasted; the bar moved.

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

**Identity and governance (Phase 0):** `User`, `Role`, `Permission`, `RolePermission`,
`Department` (self-referencing hierarchy, with a materialized `path`/`depth` since Slice 2b),
`AuditLog` (append-only), `OrgSettings`. `User.passwordHash` and `User.mfaSecret` are
nullable — forward-compat placeholders for SSO/MFA. `User.locationId` was added by Slice 2b.

**Ticketing (Phase 1 Slice 2, ADR-0016):** `TicketType`, `StatusWorkflow`, `Status`,
`Category` (self-referencing tree), `Priority`, `Impact`, `Urgency`, `PriorityMatrix`,
`Ticket`, `Comment`. One `Ticket` table carries both Incidents and Service Requests,
separated by the `TicketType` row it points at. Two enums exist and only two:
`StatusCategory` (`triage | open | pending | resolved | closed`) — what code branches on so
it never matches an admin-renameable `Status.name` — and `DisplayTone`, which is a semantic
token rather than a colour (ADR-0013). Everything else an admin edits is a row.

Tickets carry a `number` (`SERIAL`, unique) beside the UUID `id`, because §9.3/§9.4 show
people referring to `#1042`. Priority is derived from Impact × Urgency through the matrix
and then **stored** on the ticket, so editing the grid never rewrites the priority of a
ticket already in flight.

**Ownership, scope and B2 fields (Phase 1 Slice 2b, ADR-0018):** `TechnicianGroup` +
`TechnicianGroupMember` (many-to-many), `Location` (self-referencing tree), `TicketSource`,
`ClosureCode`, `TicketWatcher`, `TicketCollaborator`.

The load-bearing change is that **the four ownership axes are now four columns**, because
Ref I3.1 makes `own`, `group`, `department` and `location` four different scope values:
`Ticket.groupId` (who works it), `.departmentId` (classification), `.locationId` (which
site), plus the requester/assignee/watcher/collaborator set that constitutes `own`. Slice 2's
single `Ticket.teamId → Department` could answer only two of them and conflated the other
two. `Category`, `Department` and `Location` all carry a materialized `path`/`depth`
maintained by one shared helper (`common/tree/materialized-path.ts`), indexed with
`text_pattern_ops` so a subtree prefix match is actually indexed.

`Ticket` also gained B2's Phase-1 fields: `source`, `tags` (a `String[]` with a GIN index),
`diagnosis`/`solution`/`closureCode` beside `resolutionNotes`, merge parent/child, the two
escalation **level counters**, and the `isSpam`/`archivedAt` flags Ref B5 requires.

Three migrations exist: `20260908054618_init`, `20260909043500_ticketing` and
`20260909111353_request_model_b2_b3`.

### Seeded data (`apps/api/prisma/seed.ts`, idempotent upserts)

> ⚠️ **All of this identity seed data is superseded by Amendment A-001** and will be replaced
> in Phase 0 Slice 0a/0d: the hand-maintained key list becomes a versioned manifest of the
> ~150-entry catalogue (Ref I2, `module.action[.qualifier]`), and the six roles become twelve
> permission-locked ones. It is described here as _what currently runs_, not as a target.

- **6 roles** (all `isSystemRole`): Requester, Technician, Team Lead, Change Manager,
  Admin, Auditor.
- **10 permissions**: `role.manage`, `permission.view`, `user.manage`,
  `department.manage`, `automation.manage`, `report.view.org`, `audit.view`,
  `org_settings.manage`, plus forward-declared `ticket.view.own` and
  `ticket.edit.assigned` — the two ticket keys are the ones A-001 collapses into a single
  scoped `request.view` / `request.edit`.
- **Grants**: Admin gets all 10; Auditor gets `audit.view` + `report.view.org`;
  Requester / Technician / Team Lead / Change Manager get **zero** — this is the
  data-level proof of Article III, not an oversight.
- One "Unassigned" department; optional bootstrap admin gated by `SEED_BOOTSTRAP_ADMIN`.

Ticketing reference data lives in `apps/api/prisma/seed-ticketing.ts`, called from the same
entry point and equally idempotent:

- **2 ticket types** — Incident, Service Request — each pointing at **its own workflow**,
  not a shared one, so §2.2's "distinct workflow template per type" is true in the data.
- **2 workflows × 8 statuses**, the constitution's default lifecycle
  (`New → Open → In Progress → Pending (Customer) → Pending (Vendor) → Resolved → Closed →
Reopened`). The Service Request copy renames one state to "Fulfilled" — the same `key` and
  `category`, a different label, which is the name/key separation demonstrated in the seed.
- **3 impacts × 3 urgencies → 9 matrix cells → 4 priorities** (Critical/High/Medium/Low),
  the standard ITIL 3×3 grid. Moving to a 5×5 is adding rows, not a migration.
- **A 29-node category tree**, three levels deep under Hardware (`Hardware > Laptop >
Screen`) so §2.1's example shape is real rather than theoretical.

A re-seed deliberately does **not** overwrite a `Status.name` an admin has edited; it
re-asserts only `category` and the lifecycle flags, which are code contracts.

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
  (+ GitGuardian), on `actions/checkout@v7` / `setup-node@v7` and Node 24. `audit` runs
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
  `veracode-uploadandscan-action@0.2.11`, whose manifest still says `node20` — but GitHub
  already runs it on Node 24 regardless, so this is a stale manifest rather than a pending
  breakage. See §4.
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

### The ticket data model (2026-09-09) — Phase 1 Slice 2

The tables every later slice writes against. The design and the alternatives it beat are in
**ADR-0016**; what matters here is the one tension it resolves, and how it was checked.

Article II wants statuses, workflows, categories, priorities and types to be rows an admin
edits without a migration. But code has to answer "is this ticket still open?", "should the
SLA clock be paused?", "does the reopen window apply?" — and if a status is only an
admin-supplied string, every one of those becomes a string match that breaks silently the
first time somebody renames "In Progress". So names are data, and a five-value
`StatusCategory` enum is the contract code reads. Same seam as `Permission.key`.

The other decision worth remembering: **priority is derived from the Impact × Urgency grid
and then stored on the ticket.** Recomputing on read would let an admin's grid edit
retroactively rewrite the priority of every ticket in flight — including the one a breached
SLA was measured against.

**Verified against a real Postgres**, not by inspection. Docker Desktop had to be started
for it; for a schema change that is not optional:

- both migrations apply to an empty database, and `migrate diff --from-url` against the
  result comes back empty — no drift between the migration and the datamodel;
- the seed runs, and running it three times leaves 29 categories / 16 statuses / 9 matrix
  cells — idempotent, not merely re-runnable;
- **the rename claim was tested rather than asserted.** Renaming `in_progress` to "Being
  Worked" and corrupting its `category` to `closed`, then re-seeding, leaves the name
  "Being Worked" and restores the category to `open`. Exactly the intended split: the label
  belongs to the admin, the lifecycle semantics to the code;
- a ticket inserted end to end comes back as `#1` (the `SERIAL` handle), category path
  `Hardware > Laptop > Screen` — §2.1's own example, three levels deep — and priority
  **Medium**, correctly derived from single-user impact × high urgency through the ITIL 3×3
  grid;
- a threaded internal comment attaches to it and is cascade-deleted with the ticket.

One thing this slice fixed in passing: **the seed was type-checked nowhere.** It runs under
`ts-node --transpile-only`, and `apps/api/tsconfig.json` scopes the build to `src`, so a
wrong property name in a seed file could only ever be found by CI's seed step failing at
runtime. `apps/api/tsconfig.seed.json` adds a no-emit pass over `prisma/**/*.ts`, and the
api's `typecheck` script runs it.

### Node 22 → 24 (2026-09-09)

Prompted by the Node 20 deprecation warning on `sast-policy`, which turned out to be about
something else entirely — the runtime GitHub executes a JavaScript _action_ in, not the Node
this app builds or runs on. Those are unrelated knobs, and bumping ours does nothing for
that warning (§4 has the detail). But the question was worth asking on its own terms, and
the answer was yes.

Everything moves together: `engines` (`>=24.0.0`), all seven `setup-node` steps across both
workflows, `node:24-bookworm-slim` for the API image and `node:24-alpine` for the web build,
and `@types/node` to `^24.13.3` so the types match the runtime. `packageManager` went to
`npm@11.19.0` — what `node:24-bookworm-slim` actually ships, and no longer the stale
`10.9.7` that contradicted gotcha 9's "regenerate the lockfile with npm 11+".

**The risk was native modules, and it was checked rather than hoped.** `argon2` declares
`napi_versions: [8]`, so its prebuilt binaries are N-API and ABI-stable across Node majors —
no rebuild needed, and nothing in the production-only runtime image (ADR-0011) has to compile
at boot. Prisma 5.22 predates Node 24 by six months, which was the other open question.

**Verified by running the real stack, not by building it** (gotcha 6). Both images built,
then the prod compose stack came up on isolated ports under a separate project name, beside
the maintainer's own running stack rather than disturbing it:

- API reports `v24.20.0` in-container and serves `/health`;
- both migrations applied on boot — so Prisma 5.22 is fine on Node 24;
- seed ran; CSRF issued; **login returned 200**, which is the check that matters, because
  password verification is `argon2`'s native binary executing under Node 24 on glibc;
- `/auth/login` and `/auth/me` payloads are **byte-identical** — the Phase 0 crash that is
  easiest to reintroduce;
- `/users` answers 200 with a session and 401 without; nginx serves the frontend; an
  `auth.login` audit row was written.

API image size is essentially unchanged at 540 MB (537 MB on Node 22).

One thing worth knowing for any future isolated run: **Compose merges `ports` across
override files rather than replacing them.** A plain override still publishes the base
file's `5432:5432` and collides with a stack already running. `ports: !override` is what
actually replaces the list.

### Prisma 5.22 → 6.19.3 (2026-09-09)

Taken before Phase 1 Slice 3 rather than after, deliberately: the repo has **42 Prisma call
sites across three files today**, all plain CRUD, and Slice 3 is about to add filtering,
pagination and scoped includes everywhere. This is the cheap moment.

Each of v6's five breaking changes was checked against this schema rather than assumed:
implicit m-n primary keys (we have none — `RolePermission` and `PriorityMatrix` are explicit
join models), the `fullTextSearch` preview split (no `previewFeatures`), `Bytes` becoming
`Uint8Array` (no `Bytes` fields), `NotFoundError` becoming `P2025` (never referenced; the one
real `findUniqueOrThrow` is in `getSessionUserDto`, reached only after `SessionAuthGuard` has
already proven the user exists), and `async`/`await`/`using` as reserved model names (none of
our 17 models).

**The upgrade brought a High advisory with it, and the new `audit` job is what surfaced it.**
Prisma 6 depends on `@prisma/config`, which pins `deepmerge-ts` to exactly `7.1.5` —
GHSA-ggr8-5vv4-36mx, stack exhaustion on recursive object graphs, fixed in 8.0.0. Upgrading
further does not help: **7.10.0 pins the same 7.1.5**. So it is the multer situation again,
and the same lever applies — a root `overrides` entry for `deepmerge-ts: ^8.0.0`, with the
lockfile regenerated from a clean copy per gotcha 9. `npm audit` is back to 0 afterwards, and
`prisma generate` exercising `@prisma/config` is the proof the override is compatible.

Verified by running it, at every layer:

- `generate`, `migrate deploy` from an empty database, and `migrate diff --from-url` coming
  back empty — no drift;
- the seed, including argon2 hashing, leaving 10 permissions / 16 statuses / 9 matrix cells;
- the **containerized** stack, because a Prisma major is exactly gotcha 1's territory: the
  API image built, booted, applied both migrations, and served `/health`;
- login `200`, `/auth/login` and `/auth/me` byte-identical, `/users` 200 with a session and
  401 without, `/audit-logs` 200.

Prisma 6 also prints the signpost for the next step on every CLI run: _"The configuration
property `package.json#prisma` is deprecated and will be removed in Prisma 7."_ §4 records
what 7 actually involves, and why it is a genuine architecture change rather than a bump.

### Slice 2b — the request model, and four scope values that had no schema (2026-09-09)

Planned as a small reconciliation of the ticket model with Functional Reference B2 and B3.
It was not small, and the reason is worth keeping.

The written plan named one blocker for Phase 0's `applyScope()`: Ref I3 counts a **watcher**
and a **collaborator** as `own` scope, and neither existed in the schema, so a scope helper
written first would implement a narrower `own` than the spec — passing its tests and still
being wrong. That reasoning was correct. Checking it against all seven scope values in I3.1
rather than just `own` showed **four** that could not have been implemented correctly:

- `own` — requester and assignee only. Too narrow.
- `group` — **no table at all.** `Ticket.teamId` pointed at `Department`, so `group` and
  `department` scope would have resolved through the same column. Ref B1 makes a Technician
  Group its own entity that "a technician may belong to several" of; B2 lists Technician
  Group and Department as separate fields; G3.3 gives each group its own business hours.
  ADR-0016's "Departments double as teams" was defensible against the constitution alone and
  is not against I3.1.
- `department` — parent FK only, no materialized path, so "including sub-departments" is a
  recursive query per request or silently single-level.
- `location` — **no table, no column, anywhere**, while Ref B4 says location "doubles as a
  security filter".

All four fail the same way: quietly. A too-narrow scope produces a support ticket; a too-wide
one produces nothing at all until someone notices they can read another department's records.
That is the failure mode constitution 5.2 exists to prevent, and the argument for building
this before the helper rather than after.

**What landed:** the four ownership columns and their join tables; `TechnicianGroup` with
many-to-many membership; a `Location` tree; one shared materialized-path helper serving
Category, Department and Location (Ref B4 asks for exactly one, and `User.reporting_path`
will be its fourth user in Slice 0b); the 3×4 priority matrix; `PriorityResolverService`;
`isOperationallyActive()` for Ref B5; and B2's Phase-1 fields. **ADR-0018** carries the
decisions, and ADR-0016's header now points at it.

**Two design choices that are the substance rather than the paperwork:**

- **The priority matrix was widened, not rewritten.** All nine original cells kept the
  priority they had; only the fourth urgency column is new. Nothing already classified was
  reclassified — the change adds a classification that was previously inexpressible.
- **`PriorityResolverService` has no update path.** B3's rule is that an explicitly set
  priority is never overridden, and the way to enforce that is not to implement the thing
  that would violate it. An ordinary edit has nothing to call. `rederive()` exists as a
  separate, deliberate act gated by `request.priority.override`.

**Two bugs found by building it rather than by reading:**

- **The path index Prisma generates by default is wrong for the query it exists to serve.** A
  subtree test is `path LIKE '/a/b/%'`, and PostgreSQL will not use a plain text btree for a
  prefix `LIKE` unless the collation is C. The default produces correct results and
  sequential-scans, which is precisely the sort of thing that survives review. The three tree
  indexes are `text_pattern_ops`.
- **A materialized path needs _both_ separators.** `/1/7/`, not `/1/7`. Without the trailing
  one, `startsWith('/1/7')` also matches `/1/70/` — a sibling subtree silently pulled into a
  scoped query. There is a test for it, using ids chosen to collide.

**Verified by running it, from an empty database:** migration applies with no drift, the seed
is idempotent across three runs (12 matrix cells, 4 urgencies, 8 locations, 29 categories),
`verify-slice-2b.ts` passes 30 checks including B3's worked example and a subtree prefix that
correctly excludes its sibling, and the API boots and authenticates with `RequestsModule`
registered — which is why that module is registered now rather than with Slice 3, since an
`@Injectable()` nobody provides type-checks, passes its unit tests, and fails on first
resolution.

**Two things left deliberately undone:** the null-department trap is Slice 0c's to fix (the
schema cannot prevent it; only the helper can), and **type conversion** is designed but not
built, because mapping a status onto the target type's workflow needs Slice 4's transition
rules to exist first.

### Phase 0 Slice 0a — the permission manifest (2026-09-10)

Ten hand-listed keys in `seed.ts` became 174 in a versioned manifest, reconciled into the
database rather than inserted. **ADR-0020** carries the decisions; three things are worth
keeping here.

**"Disabled by default for existing custom roles" (7.3.5) needed no disable step.** A
`Permission` row with no `RolePermission` referencing it confers nothing, so the
reconciliation creates permissions and grants them to nobody — there is no flag to set and
therefore none to forget. Custom roles are never touched; only system roles have their grants
re-asserted, from their own definition.

**Every pre-A-001 key deprecates on upgrade, and that is the feature working.** All ten
(`role.manage`, `audit.view`, `ticket.view.own`, …) appear nowhere in Ref I2. Run against a
database that already held them: 174 added, 10 deprecated, each with a warning naming the
roles that held it — `report.view.org` and `audit.view` naming both Admin and Auditor. Soft
deleted, not dropped, so the grants stay visible for an access review.

**Admin stopped getting everything, deliberately.** The old seed granted Admin every key it
defined. Against ten illustrative keys that was a shortcut; against 174 it would hand one
role every destructive and code-execution permission in the system — including
`user.permission.grant`, which Ref I2.5 calls one of "the two most powerful permissions in
the system" — before the privilege safety rules of 5.3a / Ref I8 exist to constrain it. Admin
now holds the eleven keys the built admin screens actually need.

**Two things the build taught rather than the docs:**

- **A spec in `prisma/` never runs.** jest's `rootDir` is `src`, so the reconciliation's tests
  were silently not executing. That was the signal to move the reconciler into
  `src/common/permissions/` — it is application logic with rules, not seed data. `prisma/`
  keeps reference data.
- **`prisma generate` before `nest build` bit on the first opportunity.** Editing
  `schema.prisma` and running `typecheck` produced seven "property does not exist" errors
  until the client was regenerated — exactly the Prisma 7 ordering ADR-0019 had just
  documented.

**A migration detail worth not repeating badly:** `module` is `NOT NULL` with no default and
the table is non-empty everywhere, so Prisma refuses the one-step add. It is added with a
temporary default, backfilled with a `'legacy'` sentinel, and the default dropped. The
sentinel is deliberate — those rows are about to be deprecated, and a plausible-looking
module would only camouflage that.

**Verified by running it.** From empty: migrations apply, 174 seed, a second run is a no-op.
Both Docker stacks from clean volumes: production has the columns and an empty catalogue (it
never seeds), dev reconciles in-container to 174 live / 63 sensitive / 13 modules and proxies
through Vite. And the guard proven in both directions over real HTTP — a zero-permission
Requester gets 403 on `/roles`, `/users`, `/audit-logs`, `/permissions` and 200 on
`/auth/me`, while Admin's session carries exactly its eleven keys.

**Still absent, and the reason Slice 3 must not start:** scope. `RolePermission` has no
`scope` column (Slice 0b) and `applyScope()` does not exist (Slice 0c), so holding a key is
still the whole of an authorization decision.

### Prisma 6.19.3 -> 7.10.0 (2026-09-09)

The change §4 had been queued as "an architecture change, not a bump". It was, and the two
surprises were in opposite directions.

**Driver adapters are mandatory in Prisma 7**, for every database — the Rust query engine is
gone. So `PrismaService` was rewritten around `@prisma/adapter-pg`, not merely re-imported,
and `datasource.url` is now rejected outright inside `schema.prisma`. The connection string
reaches the CLI through the new root `prisma.config.ts` and the client through the adapter.
Both still read `DATABASE_URL`.

**The predicted `applyScope()` cost was overstated.** §4 said the helper "would have to be
rewritten against driver adapters"; adapters change how the client is constructed, not how a
where-clause helper composes filters. Doing Prisma 7 before Slice 0c is still right, but for
the narrower reason in ADR-0019: porting that one file means re-verifying every filter it
builds, and a careless port there is a silent data leak.

**The predicted Dockerfile landmine was real, and got deleted rather than fixed.** The Prisma
7 generator emits _TypeScript_ into `apps/api/src/generated/prisma`, so putting the output
under `src/` makes the client ordinary build input: `nest build` compiles it into `dist`, and
the runtime image gets it from the `dist` copy it already did. `COPY --from=build
/repo/node_modules/.prisma` is gone. The new ordering rule that replaces it: **`prisma
generate` must run before `nest build`**, not merely before the app starts.

**Four things only came out of running it:**

- **`env('DATABASE_URL')` in `prisma.config.ts` breaks `prisma generate`.** Prisma's helper
  throws while the config is _loading_, and generate needs no database — so it failed the
  Docker build, where there are deliberately no credentials. Reading `process.env` directly
  fixes it without baking a fake connection string into an image layer.
- **`.env` stopped being loaded for standalone scripts.** Prisma 6's client loaded it
  implicitly via `datasource.url`; nothing does now. `prisma/seed-client.ts` loads it
  explicitly, resolved from the file's own location rather than the working directory — bare
  `dotenv/config` reads `./.env` and finds nothing when a script runs from `apps/api`.
- **Seeding is no longer implicit.** Prisma 6 seeded as part of `migrate dev`/`reset`; 7 does
  not. Every path that needs seed data now calls `prisma db seed` itself.
- **The `lint` job needed `prisma generate` added.** Nothing lints the generated client, but
  linting is type-aware (`parserOptions.project`) and the client is gitignored, so a fresh
  checkout would lint with degraded types behind every Prisma-touching rule.

**A near-miss worth recording, because it is gotcha 8 exactly.** `prisma` was briefly moved to
`devDependencies` during this work. The runtime image installs `--omit=dev` and its CMD runs
`npx prisma migrate deploy`, so that would have made production boot depend on the npm
registry being reachable. Caught by inspecting the built image rather than by any test. It is
back in `dependencies`, and `npx --offline prisma migrate deploy` now succeeds inside the
image — which is the check that actually proves it.

**Measured, not estimated:** the API image goes 781 MB -> 894 MB. While measuring it, two
things about §4's numbers turned out to be wrong — the recorded 537 MB was stale (`main` was
already 781 MB), and `prod-deps`' `--omit=dev` is not omitting root devDependencies at all, so
`typescript` and `@turbo` ship to production on `main` too. That second one is a real,
pre-existing defect against ADR-0011 and is logged in §4 rather than fixed here.

**Verified end to end from an empty database:** migrations apply, seed runs, all 30 checks in
`verify-slice-2b.ts` pass through the adapter, the production stack serves `/health`, csrf and
the frontend, the dev stack seeds and proxies `/api` through Vite, and a login round-trip
returns identical shapes from `/auth/login` and `/auth/me`.

**ADR-0009 is superseded in its reasoning only.** No Rust query engine means the OpenSSL/musl
problem that pinned Debian is gone, and `binaryTargets` is removed. Alpine is now plausible
and deliberately untested: the Prisma CLI still ships in the runtime image and its schema
engine is a separate question. That is a follow-up with its own ADR.

### The spec was revised, and Phase 0 re-opened (2026-09-09)

Two documents arrived: a rewritten constitution and a new companion, the **Functional
Reference**. The companion is not commentary — its **Part Q formally amends the constitution**,
and the constitution's own preamble names it as the one exception to "the constitution governs
where the two differ."

Six amendments. Five are minor: automation observability ships _with_ the automation engine
rather than after it (A-002); one parameterized configuration framework instantiated per module
instead of per-module customization (A-003); ITIL v5 forward-compatibility, meaning every
automated decision stores a reason and permits override (A-004); deterministic, CPU-cheap
intelligence is now explicitly _in_ scope while model-based is not (A-005); and a deferral
register kept distinct from outright exclusions (A-006).

**A-001 is MAJOR, and it invalidated work merged the same day.** It replaces the two-layer
role→permission model with three layers — roles, per-user grants/revocations where revocation
always wins, and a **scope attached per permission rather than per role**. Two consequences
land directly on this codebase:

- **Phase 0 is no longer complete.** Part XII was rephased to pull the access-control
  foundations forward, on the stated grounds that retrofitting scope enforcement means auditing
  every query in the system. `applyScope()`, `UserRole`, scoped `RolePermission`, the manifest
  seeding and the reporting hierarchy are all Phase 0 now.
- **Slice 3's groundwork was superseded before it was used.** The keys pushed that morning —
  `ticket.view.own` as a floor widened by `.team` and `.all` — collapse to a single
  `request.view` carrying a scope. §4b has the mapping.

The line worth memorising, because it dictates the shape of every query we are about to write:

> Scope is enforced in the **data layer, once**, via a single `applyScope(query, user,
permission)` helper. Enforcing scope per endpoint guarantees an endpoint eventually gets
> missed — and the miss is a data leak, not a visible bug.

Adopted in **ADR-0017**, which amends ADR-0006 rather than revoking it: the guard mechanism
stands, the model it serves does not. Nothing already built is wrong — auth, sessions, CSRF,
the audit trail, the ticket data model and the guard all survive intact.

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
- ~~**`Prisma 6.19.3` — 7.10.0 is the next step**~~ — **done 2026-09-09, see ADR-0019.**
  Pinned to exactly `7.10.0` on both packages. The prediction in this entry was right that it
  is an architecture change; two details differed in practice:

  - **Driver adapters are mandatory**, not optional, so `PrismaService` was rewritten around
    `@prisma/adapter-pg` rather than merely re-imported.
  - **This entry's claim that `applyScope()` "would have to be rewritten against driver
    adapters" was an overstatement.** Adapters change how the client is _constructed_, not how
    a where-clause helper composes filters; the real cost would have been import paths. The
    ordering decision it justified still stands, for the narrower reason in ADR-0019.

  The `COPY --from=build /repo/node_modules/.prisma` hazard predicted here was real and is now
  **deleted rather than repointed**: the Prisma 7 generator emits TypeScript into
  `apps/api/src/generated/prisma`, so the client is ordinary build input and arrives in the
  runtime image inside the existing `dist` copy.

- **The API image is ~894 MB, and two things about that are worth knowing.**
  The figure previously recorded here (537 MB, from ADR-0011) was stale: `main` measured
  **781 MB** before the Prisma 7 work. Prisma 7 adds ~113 MB on top (`effect` 34 MB,
  `@electric-sql` 26 MB, against the Rust engines it drops). Both numbers are measured by
  building the images, not estimated.

- **`prod-deps`' `npm ci --omit=dev` is not omitting root devDependencies, so ADR-0011's goal
  is not currently met.** `typescript` (23 MB) and `@turbo` are present in the runtime image
  on `main` as well as on the Prisma 7 branch — build tooling is shipping to production, which
  is exactly what that ADR's `prod-deps` stage exists to prevent. Found while measuring the
  image for ADR-0019; **not fixed there**, because it is orthogonal to Prisma and fixing it
  inside that change would have widened it. Worth doing: it is likely the largest single
  saving available in the image, and it is a supply-chain reduction as much as a size one.

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
  release Veracode publishes. It fails nothing.

  **Read that warning to its end before treating it as a deadline.** It says the action is
  _"being forced to run on Node.js 24"_ — GitHub has already migrated the runtime, and run
  `34312063025` completed a full scan (`Results Ready`) that way. Only the manifest is stale.
  Confirmed 2026-09-09: `0.2.11` is Veracode's newest release **and their default branch
  also still declares `node20`**, so there is nothing to upgrade to, released or not.

  The `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` variable the message offers forces
  Node 20 back **on**. It exists for actions that broke under 24; ours did not. Setting it
  would put a security-scanning job on an unsupported runtime to silence a cosmetic line —
  **do not**. If the warning ever becomes an error, the real remedy is to drop the action and
  call the Veracode Java wrapper directly in a `run:` step; the exact working invocation,
  `deleteincompletescan 1` included, is printed in every `sast-policy` log. That trades a
  vendor action for a pinned, checksum-verified jar fetched at CI time, which is why it is
  not worth doing while the thing still works.
  **The follow-up that actually clears it:** approve a mitigation on the finding in the
  Veracode platform (the app's latest static scan → the CWE-259 finding → Mitigate by
  Design, citing ADR-0015). Needs Veracode access and a human with the approver role, so it
  cannot be done from CI or by an agent. Until then, treat a red `sast-policy` as expected
  and read `sast-findings` instead. **Not yet done.**

  **It has also been failing for a second reason — the profile-collision — and that one is
  now fixed in the workflow rather than in a human's memory.** It happened twice: PRs #12
  and #13 merged ~50 seconds apart, then #15 and #16 ~90 seconds apart. Each push to `main`
  starts a policy scan against the same Veracode application profile, which takes one build
  at a time, so the second submission is refused:

  ```
  * App not in state where new builds are allowed.
    Scan status is Incomplete
  * A scan has failed to complete successfully. Delete the failed scan from the
    Veracode Platform and try again.
  ```

  It does not clear on a re-run. **The cause was not simply "two merges close together".**
  `security-scan.yml` had `concurrency.cancel-in-progress: true` for every event, so the
  second push _cancelled_ the first — and on the #15/#16 occurrence the cancellation landed
  64 seconds into the Veracode upload. A half-submitted build is exactly what strands a
  profile. The workflow was configured to cause the failure the docs asked a human to avoid.

  Two changes fix it (PR #17):

  - `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` — PR runs still cancel
    when superseded; pushes to `main` **queue** behind the one in flight. `sast-policy`
    never runs on a `pull_request`, so cancelling a PR run can strand nothing.
  - `deleteincompletescan: '1'` on the upload step, passed through to the Veracode Java
    wrapper. The wrapper states its own meaning in the log: _"delete a scan with a status of
    incomplete, no modules defined, failed, or canceled to proceed with uploadandscan
    action."_ That covers the state a cancelled upload leaves behind. `1` rather than `2`
    because `2` would also delete a build that pre-scanned cleanly and is waiting on module
    selection.

  Together: the first stops the stranding, the second recovers a profile already stranded.

  **Both are now confirmed by a run rather than reasoned about.** Run `34312063025` on
  `main` (the first after PR #17 merged) went: `deleteincompletescan 1` accepted →
  `Pre-Scan Submitted` → `The status of the new analysis is "Results Ready"` →
  `The policy status 'Did Not Pass' is not passing.` The profile that three previous runs
  could not get past cleared itself, **with no human in the Veracode Platform**, and the job
  went back to failing on the one documented disposition below and nothing else.

  So the standing guidance is simpler than it was: a red `sast-policy` on `main` now means
  the ADR-0015 Medium. If it ever again says `App not in state where new builds are allowed`,
  that is a new bug, not this one.

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
- ~~Deprecated `actions/checkout@v4`/`setup-node@v4` on Node 20~~ — now `@v7` on Node 24.
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

## 4b. In flight — read before starting anything

**Branch `claude/ticket-api-rbac` is superseded. Rebuild it; do not rebase it.**

It carries two commits of groundwork for Phase 1 Slice 3 — ticketing permission keys and
ticket DTOs — written against the permission model that Amendment A-001 replaced hours later.
It compiles and its gate is green; it is simply the wrong shape now:

| On that branch                                                                                 | Under A-001                                                                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ticket.view.own` / `.team` / `.all` as three keys, with `view.own` a "floor" the others widen | **one** permission, `request.view`, carrying a **scope** of `own`/`group`/`department`/`all` |
| `ticket.edit.all`, added because `edit.team` is department-scoped                              | `request.edit` at `all` scope                                                                |
| `ticket.` prefix                                                                               | `request.` prefix (Functional Reference I2.1)                                                |
| Scope filters intended per-query in the service                                                | a single `applyScope(query, user, permission)` helper — enforced in the data layer, once     |

The floor design was a reasonable answer to a real constraint (`@RequirePermission` takes one
key, so a union of view rights needed a baseline plus wideners). A-001 dissolves the constraint
rather than solving it: scope is a column, not a key. Nothing there is worth salvaging beyond
the DTOs, which are unaffected.

### What Phase 0 now needs before Slice 3 can start properly

**Order decided (2026-09-09): Prisma 7 first, then 0a → 0d.** Slice 2b is already merged, so
its half of Slice 0c's dependency is satisfied. The reasoning for putting Prisma 7 ahead of
the access-control work rather than after it is under "The other open decision" below —
short version, `applyScope()` should be written once against final tooling, because a
careless port of _that_ file is a silent data leak.

ADR-0017 has the full gap table. In dependency order:

1. ~~**The permission manifest**~~ — ✅ **done, ADR-0020.** 174 permissions across 13
   modules, reconciled rather than inserted. "Disabled by default" needed no disable step: a
   `Permission` row with no `RolePermission` confers nothing, so new keys are simply created
   and granted to nobody. Removed keys soft-delete with a warning naming the roles that held
   them — verified against a populated database, where all ten pre-A-001 keys deprecated.
   Guards and frontend migrated to the new keys; `role.manage` → `role.view`/`.create`/
   `.edit`/`.delete`, `audit.view` → `security.audit.view`, and so on.
2. **Schema:** `Permission.module`/`is_sensitive`; `PermissionSet` + `PermissionSetItem` +
   `RolePermissionSet`; `RolePermission.scope`/`scope_depth`/`custom_scope_id`; **`UserRole`**
   — a user may now hold several roles, so today's single `User.roleId` FK goes; and
   `User.manager_id` + `reporting_path` with a **cycle check on every assignment** and subtree
   recomputation on move.
3. **`applyScope()`** — one helper, the only place that knows what `department` means.
4. **The privilege safety rules (5.3a / Ref I8)** as acceptance criteria, not follow-ups.

### Slice 2's data model was partially superseded — by B2, B3 and I3. ✅ Now reconciled.

Delivered on `claude/slice-2b-request-model` as migration `20260909111353_request_model_b2_b3`
with **ADR-0018**. This section previously listed four things to fix; the slice found a fifth
that was larger than the other four together, and it is worth recording why it was missed.

**The gap that was named here was `own` scope: Ref I3 counts watcher and collaborator as
"own", and neither existed. That reasoning was right, and it generalizes.** Checked against
all seven scope values in I3.1, **four** could not have been implemented correctly:

| Scope        | State as merged in Slice 2                        | How it would have failed                                                 |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `own`        | requester + assignee only                         | too narrow — a watcher cannot see the ticket they watch                  |
| `group`      | no table; `Ticket.teamId` pointed at `Department` | **wrong set in both directions** — see below                             |
| `department` | parent FK only, no materialized path              | sub-department scope becomes recursive, or silently single-level         |
| `location`   | **no table, no column, anywhere**                 | unimplementable — and a `default:` fall-through would render it as `all` |

**`group` was the worst and the least visible.** Ref I3.1 lists `group` ("the user's
technician group(s)") and `department` as two different scope values. Ref B1 makes a
Technician Group its own entity that "a technician may belong to several" of, B2 lists
Technician Group and Department as separate fields on a request, and G3.3 gives each group
its own business hours (which is what makes Phase 2's SLA calculation team-aware). ADR-0016
had collapsed the two — "Departments double as teams" — which was defensible against the
constitution alone and is not against I3.1.

What landed:

- **Four ownership axes, four columns.** `Ticket.teamId → Department` becomes
  `groupId → TechnicianGroup`, `departmentId → Department`, `locationId → Location`, plus
  `TicketWatcher` / `TicketCollaborator` join tables and `User.locationId` /
  `TechnicianGroupMember` for the user side. Group membership is **many-to-many** — the part
  a single FK could not express.
- **One materialized-path tree helper** (`common/tree/materialized-path.ts`), per Ref B4's
  instruction to implement it once rather than three times. Serves Category, Department and
  Location; `User.reporting_path` (I3.2) becomes the fourth user in Slice 0b. Pure functions,
  no database, cycle guard and depth ceiling that throw rather than return a boolean.
- **The priority matrix is 3×4** — widened, not rewritten. All nine original cells kept their
  priority; only the fourth urgency column is new. So nothing already classified was
  reclassified. Impact labels moved to B3's vocabulary (`On User` → `On Department` →
  `On Business`); the keys did not, because a key is the contract.
- **`PriorityResolverService` has no update path.** That absence is what enforces B3's rule
  rather than merely intending it — an ordinary edit has nothing to call. `rederive()` is a
  separate, deliberate act gated by `request.priority.override` at the Slice 3 caller.
- **B2's Phase-1 fields:** `source` and `tags`, `diagnosis`/`solution`/`closureCode` beside
  `resolutionNotes`, merge parent/child, and escalation **level counters** rather than
  booleans.
- **`isOperationallyActive()`** (Ref B5) as one predicate plus its matching Prisma filter,
  with a test asserting the two agree — two expressions of one rule drift invisibly.

**Two things worth carrying forward, because neither is enforceable by schema:**

- **`applyScope()` must fail closed on a scope it cannot implement.** Four scope values had
  no schema behind them until this slice; a `default:` branch returning an unfiltered query
  turns "unimplemented" into `all`.
- **The null-department trap is untouched and still Slice 0c's job.** A user with a null
  `departmentId` must contribute _nothing_ to a department-scoped clause, never
  `{ departmentId: null }` — which Prisma renders as `department_id IS NULL` and which
  matches every unassigned record. `verify-slice-2b.ts` records this as a live fact against
  real data so it is not rediscovered the hard way.

**Type conversion (Incident ↔ Service Request) is designed, not built.** Ref B1 makes it
first-class and Part XII puts it in Phase 1. The schema supports it already, but each type
points at its own workflow, so conversion must **map the current status onto the target
workflow** rather than swap `typeId`. That needs Slice 4's transition rules to exist before
the target set is anything but a guess. The design is in ADR-0018.

**One index detail that would have been invisible:** the tree `path` columns are indexed with
`text_pattern_ops`, not a default btree. A subtree test is `path LIKE '/a/b/%'`, and
PostgreSQL will not use a plain text btree for a prefix `LIKE` unless the database collation
is C. The default Prisma generates produces correct results and sequential-scans — which is
exactly the kind of thing that survives review and shows up as latency months later.

### The other open decision

**Prisma 7 versus starting the Phase 0 access-control work.** ✅ **Closed — Prisma 7 is done
(ADR-0019).** Phase 0 Slices 0a–0d are next, and `applyScope()` will be written once, against
final tooling. The reasoning is kept below because one part of it was wrong and the correction
matters.

One correction to the reasoning this section previously carried. It claimed `applyScope()`
"would have to be rewritten against driver adapters" — that overstates it. Driver adapters
change how `PrismaClient` is _constructed_ (`PrismaService`), not how a where-clause helper
composes filters; the real port cost is import paths, because the `prisma-client` generator's
required `output` moves the generated types out of `@prisma/client`.

The weaker argument still lands in the same place, and for a better reason. Porting
`applyScope()` means touching its type origins and re-verifying every filter it builds, and a
careless port of _that_ file is a silent data leak. Writing it once against final tooling is
a security argument, not a convenience one. Supporting points: the query surface is at its
minimum right now (no service queries tickets), and Prisma 7 is pure infrastructure with no
feature semantics, so `smoke` and `smoke-dev` can verify it end to end.

**Not first, though — Slice 2b went first.** Prisma 7 is the highest-variance item on the
list (generator output moves, `api.Dockerfile`'s `COPY .prisma` breaks at _boot_ not build,
possible Alpine switch). Landing it before a purely additive schema slice would have meant
two candidate causes for any broken dev stack. It only has to precede Slice 0c, not
everything.

---

## 5. Roadmap

> **Detailed, execution-ready breakdown: [`PHASE_PLAN.md`](PHASE_PLAN.md).**
> The summary below is the shape; that document is what to work from.

### Constitution phases (Part XII)

Rephased by Amendment A-001: access control moved earlier because it is load-bearing for
every later module.

| Phase | Scope                                                                                                                                                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 ⚠️  | Foundation — repo, CI, Docker, migrations, local auth, append-only audit ✅ · **plus, newly required:** permission catalogue seeded from a manifest, `PermissionSet`/`UserRole`/scoped `RolePermission`, `applyScope()`, `User.manager_id` + `reporting_path` with cycle protection |
| 1     | **Incident + Service Request ticketing**, type conversion, status workflow, categorization, attachments, My Tickets, email notifications, seeded default roles, **scope enforcement live on every query**, priority matrix, manual ticket merge                                     |
| 2     | Asset/CMDB linking, SLA/OLA + business calendars (with Ref D3's two worked-example tests), Knowledge Base + suggestion-on-create, Service Catalog w/ dynamic forms, CSAT, jobs/downloads tray                                                                                       |
| 3     | Automation engine **with observability from day one** (A-002), custom fields, form rules, report/dashboard builder, approvals, SSO/MFA, **user-level overrides, hierarchy scope, custom scopes, access-review report, permission explain tool**                                     |
| 4     | Problem + KEDB, Change Enablement + calendar, duplicate/similarity detection (Ref F1), resolution memory, webhooks, email-to-ticket with loop protection                                                                                                                            |
| 5     | PWA polish + push, optional Tauri packaging, anomaly signals, pre-aggregated reporting tables, advanced compliance reporting, deferral-register review                                                                                                                              |

**Deferred throughout** (A-006 — a register reviewed at every phase boundary, deliberately
distinct from Part N's outright exclusions): delegation, approval-gated permission grants, UC
agreements, semantic search, LLM-assisted drafting, custom scripts unless properly sandboxed,
native mobile, zero-downtime deployment.

### Maintainer-added scope (beyond the original constitution)

Raised in conversation; **not yet designed**. Each needs an ADR when tackled, because the
constitution assumed admin-only user creation:

- Additional **login options** / changes to the login process.
- **Self-service account creation** and/or **bulk user import**.
- **Account activation and email verification** flows.
- ~~**Custom permission creation/definition** by admins~~ — **answered by Amendment A-001.**
  The old tension was that a key invented by an admin gates nothing, because keys are
  referenced in code. A-001 resolves it by not requiring invented keys: the catalogue is
  fixed but comprehensive (~150 entries, Ref I2) and admins compose roles and permission sets
  from it, while what they genuinely author is **scope** — per-user grants/revocations and
  named reusable custom scopes evaluated at query time by `applyScope()`. Transition-level
  gating (Ref I2.9) covers the rest. Catalogue and `applyScope()` are Phase 0; overrides and
  custom scopes are Phase 3.
- **Cloud hosting** once the app is usable for real work.

### Standing constraints

- **Do not install PostgreSQL (or Redis) natively on the maintainer's machine — it is not
  needed and it would break things.** Both run as containers, and `docker-compose.yml`
  publishes `5432:5432` and (via the dev override) `6379:6379`, so `localhost:5432` from the
  host already reaches the container. That is what host-native `npx prisma migrate` connects
  to. A native PostgreSQL would contend for port 5432 with the container, and the symptom —
  connecting successfully to the _wrong_ database — is considerably worse than a refused
  connection. Confirmed 2026-09-09: no `postgres` service, no `psql` on PATH, nothing
  listening on 5432 with the stack down.

  The two paths that read a database URL are deliberately different, and only one can drift:
  the **containers** build theirs from `${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432`
  in `docker-compose.yml`, derived from the same variables that initialize the database, so
  they cannot disagree. **Host-native** commands read the literal `DATABASE_URL` line in
  `.env`, which is the one that drifted above.

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
- Node 24 LTS + Git installed via `winget`. **PATH changes need a fresh terminal.**
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
