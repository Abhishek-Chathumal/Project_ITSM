import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The Prisma client, wired through a driver adapter.
 *
 * Prisma 7 removed the Rust query engine; every database now goes through a driver adapter,
 * so the connection string arrives here rather than through `datasource.url` in
 * `schema.prisma` (which Prisma 7 rejects outright). `prisma.config.ts` supplies the same
 * URL to the migration CLI. Both read `DATABASE_URL`, so there is still one source of truth
 * for the connection — it just reaches the two consumers by different routes now.
 *
 * The client itself is imported from `src/generated/prisma`, not `@prisma/client`: Prisma 7
 * makes the generator's `output` mandatory and no longer writes into `node_modules`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Fail here rather than at the first query. Prisma 6 surfaced a missing URL at schema
      // load; with the adapter, an absent connection string would otherwise reach the pool
      // as `undefined` and fail later, further from the cause.
      throw new Error('DATABASE_URL is not set — the Prisma driver adapter cannot connect');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
