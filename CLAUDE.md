# Project_ITSM — working brief

Self-hosted, ITIL4-aligned ITSM platform for a small organization. Solo maintainer.
Browser-based, desktop + mobile friendly. Destined for cloud hosting once mature;
**security is a standing top priority at every phase.**

**Two documents govern, and you need both.**
[`docs/Support_Portal_Development_Constitution.md`](docs/Support_Portal_Development_Constitution.md)
says _what_ to build and why; its companion
[`docs/Support_Portal_Functional_Reference.md`](docs/Support_Portal_Functional_Reference.md)
says _how it behaves_ at field, rule, setting and algorithm level — the detail that cannot be
correctly invented (the priority matrix's exact behaviour, the SLA calculation, the automation
trigger catalogue, the ~150-entry permission catalogue). Read the relevant Part of both before
designing a feature.

**Precedence:** the constitution governs where they differ — _except_ where the Functional
Reference's **Part Q** formally amends it. Six amendments (A-001…A-006) are in force and are
listed in the constitution's preamble. New conflicts are logged as an ADR, never silently
resolved (Part XIV).

Detailed project history, current state, and roadmap: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md).
Day-to-day workflow (machines, git, file uploads): [`docs/WORKFLOW.md`](docs/WORKFLOW.md).
What each phase delivers, sliced for execution: [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md).

Slash commands: **`/update-state`** refreshes the project docs; **`/handoff`** does that
plus verify, commit, and push — the end-of-session ritual before switching machines.

**Status: Phase 0 re-opened by Amendment A-001, which moved access-control foundations into
it.** What Phase 0 built runs and is sound (auth, sessions, CSRF, RBAC skeleton, audit trail);
it is now measured against a larger requirement — see ADR-0017 for the exact gap. Phase 1's
ticket _data model_ (Slice 2) is merged; the ticket API (Slice 3) is not started, and the
groundwork branch for it is superseded.

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

**Authorization is two halves, and both are mandatory.** Amendment A-001 (ADR-0017) replaced
the two-layer role→permission model with three layers, so "does the caller hold this key?" is
now only the first half of an authorization decision.

_Half one — the key._ Unchanged, and still never reinvented:

```ts
@RequirePermission(PERMISSIONS.REQUEST_EDIT)   // key from @itsm/shared
```

- `SessionAuthGuard` + `PermissionGuard` are global (`APP_GUARD`), fail-closed.
  Opt a route out of auth with `@Public()`.
- Permission keys live in `packages/shared/src/permissions.ts` and are seeded as
  `Permission` rows. The catalogue is Functional Reference **I2**, named
  `module.action[.qualifier]` (`request.view`, `request.note.internal`), and is seeded from a
  **versioned manifest**, not hand-maintained (constitution 7.3.5).
- Frontend permission checks (`useAuth().isAllowed(key)`) are **UX only**. The server
  re-checks every request. Never treat a hidden button as a security control.

_Half two — the scope._ Every permission carries a scope (`own` · `group` · `department` ·
`location` · `hierarchy` · `custom` · `all`), attached **per permission, not per role**. The
constitution is explicit about where it is enforced, and this is the line to remember:

> Scope is enforced in the **data layer, once**, via a single
> `applyScope(query, user, permission)` helper. Enforcing scope per endpoint guarantees an
> endpoint eventually gets missed — and the miss is a data leak, not a visible bug.

So: **never hand-write a scope filter in a service or controller.** There is one helper; it
is the only place that knows what `department` means.

- **Do not model scope as separate keys.** `request.view` at `own`/`group`/`all` scope — not
  `request.view.own` / `.team` / `.all`. That was the pre-A-001 shape and is superseded.
- **Revocation always wins** over any grant, and grants never come from a role a user does not
  hold. User-level overrides and `hierarchy` scope are Phase 3; the resolution order is in
  constitution 7.3.3.
- The **privilege safety rules (5.3a / Ref I8) are non-negotiable** on anything touching
  permissions: no self-escalation, no privilege amplification, last-administrator protection,
  justification on every override, forced logout on permission change, step-up MFA.
- New roles start with **zero** permissions (Article III); predefined roles are
  **permission-locked** — membership editable, permission set not.

**Audit everything that changes state** (Article IV). Call `AuditService.record(...)`
from the service performing the mutation. `AuditLog` is append-only — there is
deliberately no update/delete method anywhere. Keep it that way.

**One DTO shape per concept** (Article V). Shared response types live in
`packages/shared/src/types.ts`. `/auth/login` and `/auth/me` must return the _same_
`SessionUserDto` — they diverged once and crashed the frontend.

**Failures must be loud** (Article VII). The global `AllExceptionsFilter` logs with a
requestId and returns a sanitized body. Don't swallow errors locally. It also honours the
`http-errors` status thrown by Express middleware (CSRF 403, malformed-JSON 400) rather
than flattening those to 500 — see ADR-0012.

**Compose the UI from the existing primitives** (ADR-0013). `apps/web/src/components/ui`
has `Badge`/`StatusDot`/`IdChip`, `Avatar`, `Table`, `Tabs`, `DropdownMenu`, `StatTile`,
`IconButton`, `Skeleton`/`EmptyState`/`ErrorState`, `Button`, `Card`, `Input`, `Switch`.
Add a page by composing these plus `PageHeader`, not by writing fresh markup.

- **Pass a `tone`, never a colour.** `tone="danger"`, not `text-red-500`. Every colour is
  a token in `styles/globals.css`; that file is what a restyle edits.
- **A new nav entry is a row in `components/layout/nav-items.ts`**, not new JSX.
- **Never invent numbers.** `StatTile` distinguishes loading (`value={undefined}`) from a
  real zero from "no source yet" (`placeholder`). A plausible-looking fake metric on an
  ITSM dashboard is worse than an obvious placeholder.
- Gate queries on `isAllowed(...)` so a user without the permission never fires a request
  that can only 403 — UX only; the server is still the boundary.

**Config over code** (Article II). Roles, permissions, and (later) workflows/SLAs/fields
are admin-editable data, not hardcoded switches.

## Before you push

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run format:check
```

CI runs these plus `audit` (`npm audit` over the full dependency tree, gating on high and
above), `build` (Docker images), `smoke` (prod stack over HTTP) and `smoke-dev` (dev stack,
incl. the Vite→API proxy). All must be green.

A separate `security-scan.yml` runs Veracode SAST (pipeline scan on PRs, blocking on High
and above; full policy scan on `main` and weekly) and SCA — see ADR-0014. Every job is
gated on its secret being present and skips cleanly when it isn't, so it never blocks an
unconfigured environment. It triggers on `pull_request`, **never `pull_request_target`** —
the repo is public, and the latter would expose the credentials to fork PRs. Each run
publishes the complete findings as a `sast-findings` artifact for 30 days, sub-gate ones
included, because a finding only in a job log cannot be reviewed later (Part XIII).

**`sast-policy` is expected to be red on `main`, and that is not a regression.** One
Medium (CWE-259, the deliberate dev-only `SESSION_SECRET` fallback) sits below the
High-and-above gate, so PRs pass, but Veracode's policy counts it and returns
`Did Not Pass`. It is dismissed under Part XIII with the rationale in ADR-0015 — do not
"fix" it by weakening a gate or deleting the check. Clearing it for real means approving a
mitigation on the finding in the Veracode platform, which needs a human with that role;
until then the policy scan's verdict carries no signal.

**Runs on `main` serialize themselves now — don't undo that.** Every push to `main` starts
a policy scan against the same Veracode application profile, and that profile accepts one
build at a time. Two merges close together used to refuse the second with
`App not in state where new builds are allowed` and strand the profile on an `Incomplete`
scan that no re-run would clear. That happened twice (PRs #12/#13, then #15/#16) before the
cause was understood: `concurrency.cancel-in-progress` was `true` for every event, so the
second push _cancelled_ the first mid-upload, which is precisely what strands a profile.

`cancel-in-progress` is now `${{ github.event_name == 'pull_request' }}`. PR runs still
cancel when superseded; pushes to `main` queue instead. `deleteincompletescan: '1'` on the
upload step clears a profile that is already stranded, so recovery no longer needs a human
with Veracode platform access. Nothing else in CI is affected; other jobs run concurrently
freely.

**Read that job's log from the bottom, and mind what the last line is.** The failure is
always `The policy status 'Did Not Pass' is not passing.` The line printed _after_ it,
during `Complete job`, is a Node deprecation `##[warning]` naming
`veracode/veracode-uploadandscan-action@0.2.11` — which is a warning, is emitted after the
scan already finished, and has never failed anything. It is the last line in the log and so
reads like the cause; it is not.

**That warning is not a ticking clock, and the escape hatch it names must not be set.** Read
it to the end: _"The following actions target Node.js 20 but are **being forced to run on
Node.js 24**."_ GitHub has already migrated the runtime; only the action's manifest is
stale, and the scan runs and completes on Node 24 today. So there is nothing waiting to
break. `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true`, which the message offers, forces
Node 20 back **on** — it is for people whose actions broke under 24, and setting it here
would move a security-scanning job onto an unsupported runtime to silence a cosmetic line.

The fix is Veracode's: `0.2.11` is still their newest release and even their default branch
declares `using: node20`, so there is nothing to upgrade to. Every action we control runs
`node24`. If it ever stops being a warning, the real remedy is to drop the action and invoke
the Veracode Java wrapper directly in a `run:` step — the working command line is in any
`sast-policy` log.

## Hard-won gotchas — do not regress these

Each of these was a real production-blocking bug. They're fixed; keep them fixed.

1. **Prisma still runs on a Debian base — but the reason changed, so don't "fix" it from
   the old one.** `api.Dockerfile` uses `node:24-bookworm-slim` + explicit `openssl`. The
   original cause (Prisma's Rust engine mis-detecting OpenSSL on musl and dying with
   `Could not parse schema engine response`) **no longer applies**: Prisma 7 has no Rust query
   engine, and `binaryTargets` is gone from `schema.prisma` (ADR-0019). Alpine is plausible
   now and untested — the Prisma CLI still ships in the runtime image and its schema engine is
   a separate question. Trying it is a follow-up with its own ADR superseding ADR-0009.

2. **The Vite dev proxy must target the compose service name.** Inside the `web`
   container `localhost` is that container. `vite.config.ts` reads
   `DEV_API_PROXY_TARGET`; `docker-compose.dev.yml` sets it to `http://api:3000`.
   Not `VITE_`-prefixed on purpose — it must not enter the client bundle.

3. **`packages/shared` builds dual CJS + ESM.** Rollup can't statically analyse named
   exports from CJS, so a CJS-only build breaks the production web build with
   "is not exported by". Don't collapse it back to one output.

4. **`prisma generate` must run before `nest build`, not just before migrate/seed.** Under
   Prisma 7 the generator emits TypeScript into `apps/api/src/generated/prisma`, so the client
   is _build input_: generate after the build and it is simply absent from `dist`. It is
   gitignored, so a fresh checkout has none — every CI job that compiles or type-checks runs
   `npx prisma generate` first, `lint` included (linting is type-aware). The `--schema` flag
   is gone; the root `prisma.config.ts` carries the path.

5. **Changing a base image or a dependency? `docker compose ... down -v` first.** The
   `*_node_modules` volumes persist the old dependency tree and native binaries built for
   the old libc, and a plain `down` will not re-create them.

6. **Building an image proves nothing about running it.** That's why `smoke` and
   `smoke-dev` exist. If you add a runtime dependency or change how a service is
   wired, make sure a smoke job actually exercises it.

7. **Every `node_modules` the dev stack resolves through needs its own named volume.**
   `docker-compose.dev.yml` bind-mounts the repo at `/repo`, so any `node_modules` not
   masked by a volume is the _host's_ — on Windows that means `.cmd`/`.ps1` shims, and the
   container dies with `exec: line 33: node.exe: not found`. Masking the root alone is not
   enough: npm nests a package under `apps/*/node_modules` whenever it can't hoist it, and
   which packages those are shifts with any dependency bump. This surfaced when vite 8
   stopped hoisting to the root and the dev web container stopped booting. All of
   `/repo/node_modules`, `/repo/apps/{api,web}/node_modules` and
   `/repo/packages/shared/node_modules` are masked — keep it that way.

8. **`prisma` is a runtime `dependency`, not a devDependency.** The container's `CMD` runs
   `npx prisma migrate deploy`, and the runtime image is a production-only install
   (ADR-0011). Demote it and `npx` will try to fetch Prisma from the network at boot. This
   was nearly re-broken during the Prisma 7 upgrade; the check that catches it is
   `docker run --entrypoint sh <image> -c "npx --offline prisma migrate deploy"`, not any
   test.

9. **npm ignores a new `overrides` entry while `node_modules` exists.** It resolves
   against the hidden lockfile in `node_modules` and reports "up to date" — `--force`,
   `--package-lock-only`, and even deleting `package-lock.json` all leave the old version
   pinned. Regenerate the lockfile from a copy of the manifests with **no `node_modules`
   present**, then `npm ci`. Use npm 11+ to do it: npm 10 drops the `libc` fields that
   optional-dependency selection needs on musl vs glibc.

10. **Vite HMR does not fire through the Windows bind mount.** Docker Desktop on Windows
    doesn't propagate inotify events into the container, so edits on the host do not
    trigger a rebuild — and a browser reload still serves Vite's cached module graph.
    `docker compose ... restart web` picks the changes up. Don't conclude a change "didn't
    work" from a stale dev server.

## Working style that fits this project

- The maintainer runs the app locally and tests it for real; verify changes end to end
  (curl the API, drive the UI) rather than trusting unit tests alone.
- Build in reviewable slices, verifying each before moving on.
- Expect UI/theme/component churn — keep the security core decoupled from presentation.
- Theme is Nord (see `apps/web/src/styles/globals.css`); it's token-driven, so a
  restyle is a token edit, not a component rewrite.
