-- Adds the manifest columns to `permissions` (constitution 7.3.5, Functional Reference I2).
--
-- `module` is NOT NULL with no default in the schema, and this table is not empty in any
-- existing environment, so it is added in three steps rather than one: add it with a
-- temporary default, backfill, then drop the default so the application must always supply
-- one. Prisma refuses the single-step version, correctly.
--
-- The backfill value is deliberately a sentinel. Every key seeded before this migration
-- (`role.manage`, `audit.view`, `ticket.view.own`, ...) predates the A-001 catalogue and
-- appears nowhere in the new manifest, so the next `prisma db seed` soft-deletes all of them
-- and names the roles that held them. Inventing a plausible-looking module for a row that is
-- about to be deprecated would only make the deprecation harder to spot.
-- DropIndex
DROP INDEX "categories_path_idx";

-- DropIndex
DROP INDEX "departments_path_idx";

-- DropIndex
DROP INDEX "locations_path_idx";

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "deprecated_at" TIMESTAMP(3),
ADD COLUMN     "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "module" TEXT NOT NULL DEFAULT 'legacy';

-- Existing rows now carry the sentinel; new rows must state their module explicitly.
ALTER TABLE "permissions" ALTER COLUMN "module" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "departments_path_idx" ON "departments"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "locations_path_idx" ON "locations"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_deprecated_at_idx" ON "permissions"("deprecated_at");
