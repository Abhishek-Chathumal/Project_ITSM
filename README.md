# Project_ITSM — In-House IT Support Portal

A self-hosted, ITIL4-aligned ITSM platform (incident, request, problem, change, and asset management) built for a small organization.

**Status:** Phase 0 — Foundation. Authentication, RBAC, audit logging, and the admin data model (Users/Roles/Permissions/Departments/Org Settings) are live. Ticketing and the other ITIL modules land in later phases.

## Stack

- **Backend:** NestJS (TypeScript), PostgreSQL 15 (Prisma), Redis-backed sessions
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Monorepo:** npm workspaces + Turborepo
- **Deployment:** Docker Compose (fully self-hosted — no mandatory third-party SaaS)

Architecture decisions are recorded in [`docs/adr/`](./docs/adr/).

## Quick start (Docker — recommended)

```bash
cp .env.example .env
# edit .env: set SESSION_SECRET, and if you want a first admin user,
# set SEED_BOOTSTRAP_ADMIN=true with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1 (Swagger docs at `/api/docs`)

The dev compose stack builds `@itsm/shared`, runs Prisma migrations + seed, and starts both apps with hot reload.

For a production-like build instead (nginx-served static frontend, compiled API):

```bash
docker compose up --build -d
```

Web is served on `:8080`, API on `:3000` directly.

## Quick start (without Docker)

Requires Node 20+, PostgreSQL 15+, Redis 7+ running locally.

```bash
npm ci
cp .env.example .env       # adjust DATABASE_URL / REDIS_URL for your local services
cp .env apps/api/.env

npm run build -w @itsm/shared
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
cd apps/api && npx prisma db seed && cd ../..

npm run dev:api    # terminal 1 — http://localhost:3000
npm run dev:web    # terminal 2 — http://localhost:5173
```

## Development

```bash
npm run lint        # eslint across all workspaces
npm run typecheck   # tsc --noEmit across all workspaces
npm run test        # jest (api) + vitest (web)
npm run build       # production build of all workspaces
```

Each command runs via Turborepo across `apps/*` and `packages/*`.

## Project layout

```
apps/api/         NestJS backend (REST API, Prisma schema/migrations, seed script)
apps/web/         React frontend (Vite, Tailwind, React Query)
packages/shared/  Cross-cutting TypeScript types & permission-key constants
docs/adr/         Architecture Decision Records
infra/docker/     Dockerfiles + nginx config
```
