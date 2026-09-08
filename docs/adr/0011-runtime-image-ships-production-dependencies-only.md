# ADR-0011: The API runtime image ships production dependencies only

**Status:** Accepted
**Relates to:** Constitution Part V (Security), Part XI (Deployment), ADR-0009

## Context

`api.Dockerfile` built the runtime image by copying `node_modules` straight out of the
`build` stage. That tree came from a plain `npm ci`, so it carried every devDependency
into production: the Nest CLI and its transitive webpack, TypeScript, ts-jest, supertest,
pino-pretty, and the rest of the build toolchain.

None of it is reachable from `node dist/main.js`, but all of it is present in the image —
so all of it lands in a vulnerability scan of the deployed artifact, and all of it is
available to anything that does achieve code execution in the container. The project's
standing constraint is that security is a top priority _at every phase_, and the app is
destined for cloud hosting; an image that carries its own compiler and bundler is a
larger attack surface than the application needs.

Two related gaps in the same area:

- **No `.dockerignore`.** `COPY . .` in the build stage pulled in the real `.env`
  (`SESSION_SECRET`, database credentials, the seed admin password) and the entire `.git`
  history. Neither reaches the final image, but both sit in build-cache layers, and
  anything built with `--target build` would carry them outright.
- **`prisma` was a devDependency.** The container's `CMD` runs
  `npx prisma migrate deploy` before booting. Under a production-only install that
  binary would be absent, and `npx` would silently try to _download_ Prisma from the
  network at container start — a runtime dependency on npm being reachable, and an
  unpinned one at that.

## Decision

A dedicated `prod-deps` stage runs `npm ci --omit=dev`, and the runtime stage copies
`node_modules` from there rather than from `build`:

```dockerfile
FROM base AS prod-deps
COPY package.json package-lock.json ./
...
RUN npm ci --omit=dev

FROM base AS runtime
COPY --from=prod-deps /repo/node_modules ./node_modules
# The generated Prisma client lives outside the dependency tree, so it comes from `build`
# and must be overlaid *after* node_modules or the copy above clobbers it.
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
```

Supporting changes:

- **`prisma` moved to `dependencies`**, so `prisma migrate deploy` is present in a
  production install rather than fetched at boot.
- **A `.dockerignore`** excluding `.env*` (except `.env.example`), `.git`, `node_modules`,
  build output, and `docs/`.

The copy order matters and is load-bearing: `prisma generate` writes to
`node_modules/.prisma`, which `npm ci --omit=dev` does not produce. Overlaying it after
the dependency copy is the only ordering that yields a working client.

## Consequences

- The runtime image drops from **1.01 GB to 537 MB**. Verified absent from the image:
  `@nestjs/cli`, `webpack`, `typescript`. Verified present: the `prisma` CLI and the
  generated client at `node_modules/.prisma/client`.
- `npm audit --omit=dev` is now the number that describes the deployed artifact, and the
  dev-toolchain advisories that dominate the full audit no longer describe production.
- **The Dockerfile now has three dependency stages** (`deps`, `prod-deps`, `build`).
  Adding a package that is needed at runtime means adding it to `dependencies`, not
  `devDependencies` — putting it in the latter now fails in the container rather than
  merely bloating it. The `smoke` job is what catches that.
- `npm ci` runs twice per build. Layer caching keeps the cost small, and the two stages
  share the same base and lockfile.
