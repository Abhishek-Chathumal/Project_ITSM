-- Access-control schema: per-permission scope, the reporting tree, and permission sets
-- (constitution 7.3.1/7.3.2, Functional Reference I3).
--
-- `role_permissions.scope` is NOT NULL with no default in the schema, deliberately: a grant
-- must state which records it reaches, and any default would be wrong half the time — `all`
-- widens silently, `own` breaks every administrative permission that has no records to scope.
-- Existing rows therefore need an explicit backfill, which is done here in three steps.
--
-- The backfill value is `all`, and it is **not a widening**. Nothing enforces scope yet:
-- `applyScope()` is Slice 0c, and until it exists every query returns every row the caller
-- can already see. `all` is a faithful record of what is currently in force, not a new grant.
-- The narrower scopes arrive with the twelve composed roles in Slice 0d.
-- CreateEnum
CREATE TYPE "scope" AS ENUM ('own', 'group', 'department', 'location', 'hierarchy', 'custom', 'all');

-- DropIndex
DROP INDEX "categories_path_idx";

-- DropIndex
DROP INDEX "departments_path_idx";

-- DropIndex
DROP INDEX "locations_path_idx";

-- AlterTable
ALTER TABLE "role_permissions" ADD COLUMN     "custom_scope_id" TEXT,
ADD COLUMN     "scope" "scope" NOT NULL DEFAULT 'all',
ADD COLUMN     "scope_depth" INTEGER;

-- Existing rows now carry the faithful value; new grants must state one explicitly.
ALTER TABLE "role_permissions" ALTER COLUMN "scope" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_default_on_conversion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "manager_id" TEXT,
ADD COLUMN     "reporting_path" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "permission_sets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_set_items" (
    "permission_set_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "default_scope" "scope" NOT NULL,
    "scope_depth" INTEGER,

    CONSTRAINT "permission_set_items_pkey" PRIMARY KEY ("permission_set_id","permission_id")
);

-- CreateTable
CREATE TABLE "role_permission_sets" (
    "role_id" TEXT NOT NULL,
    "permission_set_id" TEXT NOT NULL,

    CONSTRAINT "role_permission_sets_pkey" PRIMARY KEY ("role_id","permission_set_id")
);

-- CreateTable
CREATE TABLE "custom_scopes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entity_type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_sets_key_key" ON "permission_sets"("key");

-- CreateIndex
CREATE INDEX "permission_set_items_permission_id_idx" ON "permission_set_items"("permission_id");

-- CreateIndex
CREATE INDEX "role_permission_sets_permission_set_id_idx" ON "role_permission_sets"("permission_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_scopes_name_key" ON "custom_scopes"("name");

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "departments_path_idx" ON "departments"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "locations_path_idx" ON "locations"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- CreateIndex
CREATE INDEX "users_reporting_path_idx" ON "users"("reporting_path" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_items" ADD CONSTRAINT "permission_set_items_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_set_items" ADD CONSTRAINT "permission_set_items_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission_sets" ADD CONSTRAINT "role_permission_sets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission_sets" ADD CONSTRAINT "role_permission_sets_permission_set_id_fkey" FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_custom_scope_id_fkey" FOREIGN KEY ("custom_scope_id") REFERENCES "custom_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
