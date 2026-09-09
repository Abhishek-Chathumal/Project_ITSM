# Debian (glibc) rather than Alpine (musl): Prisma's engine binaries are the reason.
# On Alpine, Prisma must resolve a linux-musl-openssl-* engine and its OpenSSL
# auto-detection is unreliable — it falls back to an openssl-1.1.x engine that then
# fails at runtime with "Could not parse schema engine response" (the engine is
# actually printing a shared-library load error, which isn't JSON). Debian bookworm
# ships OpenSSL 3.x and matches Prisma's debian-openssl-3.0.x target cleanly.
FROM node:24-bookworm-slim AS base
WORKDIR /repo
# The -slim images omit OpenSSL, which the Prisma engines link against at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# The full tree, including devDependencies — the dev compose stack targets this stage and
# needs the Nest CLI, ts-node and the Prisma CLI.
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

# Runtime dependencies only. The runtime image is built from this rather than from `build`,
# so that build-time tooling (the Nest CLI and its transitive webpack/tmp/glob/picomatch)
# never ships to production.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci --omit=dev

FROM deps AS build
COPY . .
RUN npm run build -w @itsm/shared
# This ordering is load-bearing under Prisma 7, in a way it was not under 6. The generator
# now emits TypeScript into `apps/api/src/generated/prisma`, so it is *build input*: run it
# after `nest build` and the client is simply absent from `dist`. No `--schema` flag — the
# root `prisma.config.ts` carries the path.
RUN npx prisma generate
RUN npm run build -w @itsm/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /repo/node_modules ./node_modules
# No `.prisma` overlay here any more. Under Prisma 6 the generated client lived at
# `node_modules/.prisma` and had to be copied from `build` and layered *after* node_modules.
# Prisma 7's generator writes TypeScript into `apps/api/src/generated/prisma` instead, so it
# is compiled by `nest build` like any other source and arrives inside the `dist` copy
# below. The old COPY would silently copy nothing — and a missing client fails at boot, not
# at build, which only `smoke` would have caught.
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
# The CMD's `prisma migrate deploy` runs with no `--schema` flag and no `datasource.url`
# (Prisma 7 rejects that field), so it needs the root config to find both. It is resolved
# explicitly via PRISMA_CONFIG below rather than by discovery, because the working directory
# is `/repo/apps/api` and the config sits a level above it.
COPY --from=build /repo/prisma.config.ts ./prisma.config.ts

WORKDIR /repo/apps/api
EXPOSE 3000
# `migrate deploy`, never `db seed`. This image carries `prisma/` but deliberately not
# `src/`, and the seed imports both the shared tree helper (`../src/common/tree`, one
# materialized-path implementation per Functional Reference B4) and, since Prisma 7, the
# generated client itself (`../src/generated/prisma`). So adding `db seed` here fails at
# *boot*, not build — the failure mode ADR-0011 and the smoke jobs exist to catch. Seeding
# runs where the full tree is present: CI's `test` job, and the dev stack, which bind-mounts
# the repo. Prisma 7 no longer seeds implicitly on `migrate`, so this is now the only path.
#
# `--schema` is gone from every CLI call: the root `prisma.config.ts` points at the schema.
CMD ["sh", "-c", "npx prisma --config /repo/prisma.config.ts migrate deploy && node dist/main.js"]
