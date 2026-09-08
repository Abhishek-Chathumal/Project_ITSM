# Debian (glibc) rather than Alpine (musl): Prisma's engine binaries are the reason.
# On Alpine, Prisma must resolve a linux-musl-openssl-* engine and its OpenSSL
# auto-detection is unreliable — it falls back to an openssl-1.1.x engine that then
# fails at runtime with "Could not parse schema engine response" (the engine is
# actually printing a shared-library load error, which isn't JSON). Debian bookworm
# ships OpenSSL 3.x and matches Prisma's debian-openssl-3.0.x target cleanly.
FROM node:20-bookworm-slim AS base
WORKDIR /repo
# The -slim images omit OpenSSL, which the Prisma engines link against at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @itsm/shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @itsm/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
