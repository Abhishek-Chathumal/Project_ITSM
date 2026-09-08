# Debian (glibc) rather than Alpine (musl): Prisma's engine binaries are the reason.
# On Alpine, Prisma must resolve a linux-musl-openssl-* engine and its OpenSSL
# auto-detection is unreliable — it falls back to an openssl-1.1.x engine that then
# fails at runtime with "Could not parse schema engine response" (the engine is
# actually printing a shared-library load error, which isn't JSON). Debian bookworm
# ships OpenSSL 3.x and matches Prisma's debian-openssl-3.0.x target cleanly.
FROM node:22-bookworm-slim AS base
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
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @itsm/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /repo/node_modules ./node_modules
# The generated Prisma client lives outside the dependency tree, so it comes from `build`
# and must be overlaid *after* node_modules or the copy above clobbers it.
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
