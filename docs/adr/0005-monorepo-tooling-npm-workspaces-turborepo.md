# ADR-0005: Monorepo tooling — npm workspaces + Turborepo

**Status:** Accepted
**Relates to:** Constitution Article V (single data model, multiple surfaces), Article VIII (simplicity bias)

## Context

Article V requires the API, web client, and any future clients to share one data model rather than maintaining divergent schemas or business logic. That calls for a monorepo with a shared types package. The tooling choice needs to stay simple for a solo maintainer (Article VIII).

## Decision

Use **npm workspaces** (built into npm ≥7, zero extra dependency) for the workspace layout (`apps/*`, `packages/*`), plus **Turborepo** as the only added dev dependency, for cached/parallel `lint`/`typecheck`/`test`/`build` pipelines across packages.

Nx was considered and declined: its plugin ecosystem, inferred targets, and custom generators are more machinery than a single maintainer needs to reason about, for a benefit (task orchestration) Turborepo already provides with a single `turbo.json`. pnpm was considered for its faster installs but declined to avoid introducing a second package manager concept beyond what's already familiar; the workspace _layout_ is identical either way, so this can be revisited later without restructuring.

## Consequences

- `packages/shared` is built to both CommonJS (`dist/cjs`, consumed by the Node/Jest backend) and ESM (`dist/esm`, consumed by Vite/Rollup for the frontend) — see its `package.json` `exports` map. This dual-build step exists because Rollup cannot statically analyze named exports from a CommonJS file; skipping it silently breaks the production web build with an "is not exported by" error.
- `turbo.json`'s `build`/`typecheck`/`test` tasks declare `dependsOn: ["^build"]`, so `packages/shared` is always rebuilt before any dependent workspace runs — a fresh clone's first `npm run build` (or `lint`/`typecheck`/`test`) rebuilds it automatically.
