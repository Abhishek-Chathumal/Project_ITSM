import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 requires this file at the repo root and drops the `package.json#prisma` block
 * that used to hold the seed command — Prisma 6 warned about that on every CLI run.
 *
 * Two behaviours changed with it and are worth stating, because both are silent:
 *
 * 1. **Seeding is no longer automatic.** Prisma 6 ran the seed as part of `migrate dev` /
 *    `migrate reset`; Prisma 7 does not. Every path that needs seed data now runs
 *    `prisma db seed` explicitly — CI's `test` job and the dev compose command both already
 *    do. The production image deliberately never seeds (see api.Dockerfile).
 * 2. **`schema` here replaces the `--schema` flag.** The schema does not sit at the
 *    conventional root path in this monorepo, which is why every CLI call used to carry
 *    `--schema apps/api/prisma/schema.prisma`. Pointing at it once here means a bare
 *    `npx prisma migrate deploy` from the repo root now resolves correctly.
 */
export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    // ts-node rather than tsx (what Prisma's docs use): ts-node is already a dependency
    // here and the seed is type-checked separately by tsconfig.seed.json.
    seed: 'ts-node --transpile-only apps/api/prisma/seed.ts',
  },
  datasource: {
    // Read directly rather than through Prisma's `env()` helper, which throws while the
    // config is being *loaded* if the variable is absent. That breaks `prisma generate`,
    // which needs no database at all — and the Docker build stage deliberately has no
    // credentials, so `env()` failed the image build outright.
    //
    // An empty string here is not a silent fallback: commands that genuinely need a
    // connection still fail, and they fail at the point of connecting with Prisma's own
    // message, which is where the problem actually is. The alternative — a placeholder
    // connection string baked into the build stage — would put a fake credential in an
    // image layer and could mask a real misconfiguration at deploy time.
    url: process.env.DATABASE_URL ?? '',
  },
});
