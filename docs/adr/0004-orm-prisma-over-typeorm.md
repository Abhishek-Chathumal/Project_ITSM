# ADR-0004: ORM — Prisma over TypeORM

**Status:** Accepted
**Relates to:** Constitution Part VI.2, Part VII (Data Model), Article IV, VIII

## Context

NestJS supports both TypeORM (official integration) and Prisma equally well. The constitution doesn't mandate either; a solo maintainer with no second reviewer needs migration tooling that is hard to get subtly wrong.

## Decision

Use **Prisma** for the schema, migrations, and typed client.

- `prisma migrate dev` generates plain, reviewable SQL files under `apps/api/prisma/migrations/` — checked into git, diffable in a PR like any other code change (supports Article IV's spirit of an auditable system, and Part XIII's reproducible seed/test data).
- `prisma migrate deploy` (used in CI and the Docker entrypoint) applies pending migrations only — it never generates new ones, so production/CI can't accidentally drift the schema.
- The generated Prisma Client is fully typed against `schema.prisma`, and DTOs in `packages/shared` are thin, hand-mapped views of that shape (see `AuthService.toSessionUserDto`).

TypeORM was considered and declined: its migration-generation-from-entities has a known history of producing incorrect or destructive diffs when entity decorators drift from the live schema, which is riskier without a second reviewer to catch the mistake before it reaches production.

## Consequences

- Every schema change is a two-step, reviewable process: edit `schema.prisma`, run `prisma migrate dev --name <desc>`, inspect the generated SQL before committing.
- `apps/api/prisma/seed.ts` uses idempotent upserts (never raw inserts) so it can be re-run safely in dev, CI, and — gated behind `SEED_BOOTSTRAP_ADMIN` — first-boot production.
