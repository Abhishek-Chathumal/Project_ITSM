# ADR-0019: Prisma 7 — driver adapters, a generated client inside the source tree, and a root config

**Status:** Accepted
**Supersedes:** [ADR-0009](0009-debian-base-image-for-prisma.md) in its _reasoning_, not yet in its _decision_ — see "What this does not change" below
**Relates to:** [ADR-0004](0004-orm-prisma-over-typeorm.md) (Prisma over TypeORM) · [ADR-0011](0011-runtime-image-ships-production-dependencies-only.md) · Constitution Part XIII

## Context

Prisma 6.19.3 → 7.10.0. `PROJECT_STATE` §4 had this queued as "an architecture change, not a
bump", and that was right — but it understated one thing and overstated another.

**Understated:** driver adapters are _mandatory_ in Prisma 7, for every database. The Rust
query engine is gone. So `PrismaService` is rewritten, not merely re-imported, and the
connection string reaches the client by a different route than it reaches the CLI.

**Overstated:** §4 said `applyScope()` "would have to be rewritten against driver adapters"
if written first. It would not — adapters change how `PrismaClient` is _constructed_, not how
a where-clause helper composes filters. The real cost would have been import paths. The
ordering decision it justified still stands (Prisma 7 before Slice 0c), but for a narrower
reason: porting `applyScope()` means re-verifying every filter it builds, and a careless port
of _that_ file is a silent data leak.

Version pinning matters here and the existing note in §4 held up: `prisma@latest` is
`8.0.0-rc.13` while `@prisma/client@latest` is `7.10.0`, and Prisma requires the two to match.
Both are pinned to exactly `7.10.0`, not `^7.10.0` — a minor bump that regenerates the client
differently is not something to discover on a Friday deploy.

## Decision

### 1. The generated client lives in the source tree, and that deletes a Dockerfile hazard

Prisma 7 makes the generator's `output` mandatory; the client no longer lands in
`node_modules`. It is generated into `apps/api/src/generated/prisma` and **gitignored**.

Putting it under `src/` is the load-bearing choice. The generator emits _TypeScript_, so from
there it is ordinary build input: `nest build` compiles it to `dist/generated/prisma`, and the
runtime image picks it up in the `dist` copy it already performs. That means the line
`PROJECT_STATE` flagged as a boot-time landmine —

```dockerfile
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
```

— is **deleted rather than repointed**. It would have copied nothing, and a missing client
fails at boot, not at build, so only `smoke` would ever have caught it.

The consequence to remember: **`prisma generate` must now run before `nest build`, not merely
before the app starts.** Under Prisma 6 the ordering was a convenience; now, generating after
the build leaves the client absent from `dist` entirely.

### 2. `datasource.url` is gone from the schema; the config and the adapter each get one

Prisma 7 rejects `url` inside `datasource` outright. The connection string now reaches its two
consumers separately:

- **The CLI** (migrate, db seed) reads it from the root `prisma.config.ts`.
- **The client** gets it from the driver adapter passed to the constructor, in `PrismaService`.

Both read `DATABASE_URL`, so there is still one source of truth — it just arrives by two
routes. `prisma.config.ts` also carries the schema path, which retires the
`--schema apps/api/prisma/schema.prisma` flag every CLI call used to need (the schema does not
sit at the conventional root path in this monorepo). A bare `npx prisma migrate deploy` from
the repo root now resolves correctly.

### 3. `prisma.config.ts` reads `process.env` directly, not Prisma's `env()` helper

`env('DATABASE_URL')` throws while the config is being **loaded**, which breaks
`prisma generate` — a command that needs no database at all. It failed the Docker build
outright, because the build stage deliberately has no credentials.

`process.env.DATABASE_URL ?? ''` is not a silent fallback: commands that genuinely need a
connection still fail, at the point of connecting, with Prisma's own message. The alternative
— a placeholder connection string baked into the build stage — would put a fake credential in
an image layer and could mask a real misconfiguration at deploy time.

### 4. Seeding is explicit everywhere, because Prisma 7 no longer does it implicitly

Prisma 6 ran the seed as part of `migrate dev` / `migrate reset`. Prisma 7 does not. Every
path that needs seed data now runs `prisma db seed` itself: CI's `test` job and the dev
compose command both do, and **the production image still deliberately never seeds.**

`prisma/seed-client.ts` is new. The scripts under `prisma/` cannot use `PrismaService` (it is
a Nest provider, and they run under ts-node), and `new PrismaClient()` no longer compiles
without an adapter — so the adapter wiring exists once, there, rather than being copy-pasted
into the seed and the verification script.

It also loads `.env` explicitly, resolved **from the file's own location rather than the
working directory**. Prisma 6's client loaded `.env` implicitly via `datasource.url`; nothing
does now. Bare `dotenv/config` reads `./.env`, which finds nothing when a script runs from
`apps/api` — as `npx ts-node prisma/verify-slice-2b.ts` does. `override: false` keeps a real
environment variable winning, so CI and the containers are unaffected.

### 5. The `lint` job now runs `prisma generate`

Nothing lints the generated client (`src/generated` is in eslint's `ignorePatterns`), but
linting here is **type-aware** — `parserOptions.project` — and the client is gitignored. On a
fresh checkout without this step, the type information behind every rule touching a Prisma
type silently degrades. `typecheck`, `test` and `build` already generated; `lint` did not.

## What this does not change

**ADR-0009's decision stands for now; only its premise is gone.** That ADR pinned
`node:24-bookworm-slim` because Prisma's Rust engine mis-detects OpenSSL on musl and dies with
`Could not parse schema engine response`. Prisma 7 has no Rust _query_ engine — confirmed by
inspecting the built image, which contains no `libquery_engine*` and no
`node_modules/.prisma`. `binaryTargets` is correspondingly removed from the schema.

So Alpine is now _plausible_, and it is deliberately **not attempted here**. The Prisma CLI
still ships in the runtime image (the CMD runs `migrate deploy`), and its schema engine is a
separate question from the query engine. Changing the base image is a second variable; landing
it in the same change as the ORM architecture would mean two candidate causes for any boot
failure. It is a follow-up with its own verification, and its own ADR superseding ADR-0009
properly.

## Alternatives rejected

- **Generate into `apps/api/generated` (outside `src`).** Keeps generated code out of the
  compile, and then the runtime image needs its own COPY for it and `dist` code must reach it
  by a relative path whose depth differs between `src` and `dist`. The whole benefit of the
  `src/` placement is that there is nothing special to arrange.
- **Commit the generated client.** Removes the "generate before build/lint" ordering
  requirement entirely. It also puts ~32 machine-written files in every schema diff and makes
  a stale checkout produce a client that silently disagrees with the schema.
- **A placeholder `DATABASE_URL` in the build stage** to satisfy `env()`. One line, and it
  bakes a fake credential into an image layer while masking a genuinely missing URL at deploy.
- **Keep `--schema` on every CLI call** and skip `prisma.config.ts`. Prisma 7 requires the
  config file for the datasource URL regardless, so this would mean maintaining both.
- **`^7.10.0` rather than an exact pin.** Matches the rest of the manifest's style, and this
  is the one dependency where a minor bump regenerates a client and changes a build artifact.

## Consequences

- **The API image grows ~113 MB, 781 MB → 894 MB.** Prisma 7 brings `effect` (34 MB) and
  `@electric-sql` (26 MB) as new dependencies, against the Rust engines it drops. Measured by
  building both images, not estimated.
- **`PROJECT_STATE`'s "537 MB" figure for the API image was already stale** — `main` measured
  781 MB before this change. Corrected there.
- **A pre-existing defect surfaced and is _not_ fixed here: `prod-deps`' `npm ci --omit=dev`
  is not omitting root devDependencies.** `typescript` (23 MB) and `@turbo` ship in the
  runtime image, on `main` as well as on this branch, which means ADR-0011's stated goal —
  "build-time tooling never ships to production" — is not currently being met. It is a real
  finding, it is orthogonal to Prisma, and fixing it inside this change would widen it. Logged
  in `PROJECT_STATE` §4.
- **Gotcha 8 still applies and was nearly broken here.** `prisma` was briefly moved to
  `devDependencies` during this work; because the runtime image installs `--omit=dev` and the
  CMD runs `npx prisma migrate deploy`, that would have made production boot depend on the npm
  registry. It is back in `dependencies`, and verified: `npx --offline prisma migrate deploy`
  succeeds inside the built image.
- **Verified by running it, not by tests passing.** From an empty database: migrations apply,
  the seed runs, `verify-slice-2b.ts` passes all 30 checks through the adapter, the production
  stack boots and serves `/health`, `/api/v1/auth/csrf` and the frontend, and the dev stack
  seeds and proxies `/api` through Vite. A login round-trip returns identical shapes from
  `/auth/login` and `/auth/me` (Article V).
- **`applyScope()` (Phase 0 Slice 0c) can now be written once, against final tooling** — which
  was the point of sequencing this before it.
