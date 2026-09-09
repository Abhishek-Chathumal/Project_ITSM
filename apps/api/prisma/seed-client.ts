import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * A Prisma client for the standalone scripts under `prisma/`.
 *
 * Prisma 7 makes the driver adapter mandatory, so `new PrismaClient()` no longer compiles
 * without one. The API gets its client from `PrismaService`, which is a Nest provider and
 * therefore not available to a script run by `prisma db seed` or by ts-node directly —
 * hence this small duplicate of the same wiring rather than an import of the service.
 *
 * Kept in one place so the seed and the verification script cannot drift into connecting
 * differently from each other.
 */
// Load the repo-root `.env` for host-native runs.
//
// Prisma 6's client did this implicitly, because the connection string came from
// `datasource.url = env("DATABASE_URL")` in the schema. With the driver adapter the URL is
// read from `process.env` by this file, so nothing loads `.env` unless we do.
//
// The path is resolved from this file rather than the working directory on purpose: bare
// `dotenv/config` reads `./.env`, which finds nothing when a script is run from `apps/api`
// (as `npx ts-node prisma/verify-slice-2b.ts` is). `override: false` keeps a real
// environment variable winning, so CI and the containers — where DATABASE_URL is set
// properly and no `.env` exists — are unaffected.
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false });

export function createSeedClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — the seed cannot connect');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
