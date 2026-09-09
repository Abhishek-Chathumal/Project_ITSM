/*
  Warnings:

  - You are about to drop the column `team_id` on the `tickets` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_team_id_fkey";

-- DropIndex
DROP INDEX "tickets_team_id_status_id_idx";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "path" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "team_id",
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "closure_code_id" TEXT,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "diagnosis" TEXT,
ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "is_spam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "merge_parent_id" TEXT,
ADD COLUMN     "resolution_escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "response_escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "solution" TEXT,
ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "location_id" TEXT;

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_location_id" TEXT,
    "path" TEXT NOT NULL DEFAULT '',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_groups" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "ticket_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ticket_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_codes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "closure_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_watchers" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_watchers_pkey" PRIMARY KEY ("ticket_id","user_id")
);

-- CreateTable
CREATE TABLE "ticket_collaborators" (
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_collaborators_pkey" PRIMARY KEY ("ticket_id","user_id")
);

-- CreateIndex
CREATE INDEX "locations_parent_location_id_idx" ON "locations"("parent_location_id");

-- CreateIndex
CREATE INDEX "locations_path_idx" ON "locations"("path" text_pattern_ops);

-- CreateIndex
CREATE UNIQUE INDEX "technician_groups_key_key" ON "technician_groups"("key");

-- CreateIndex
CREATE INDEX "technician_group_members_user_id_idx" ON "technician_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sources_key_key" ON "ticket_sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "closure_codes_key_key" ON "closure_codes"("key");

-- CreateIndex
CREATE INDEX "ticket_watchers_user_id_idx" ON "ticket_watchers"("user_id");

-- CreateIndex
CREATE INDEX "ticket_collaborators_user_id_idx" ON "ticket_collaborators"("user_id");

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "departments_parent_department_id_idx" ON "departments"("parent_department_id");

-- CreateIndex
CREATE INDEX "departments_path_idx" ON "departments"("path" text_pattern_ops);

-- CreateIndex
CREATE INDEX "tickets_group_id_status_id_idx" ON "tickets"("group_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_department_id_status_id_idx" ON "tickets"("department_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_location_id_status_id_idx" ON "tickets"("location_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_source_id_idx" ON "tickets"("source_id");

-- CreateIndex
CREATE INDEX "tickets_merge_parent_id_idx" ON "tickets"("merge_parent_id");

-- CreateIndex
CREATE INDEX "tickets_tags_idx" ON "tickets" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_fkey" FOREIGN KEY ("parent_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_group_members" ADD CONSTRAINT "technician_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "technician_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_group_members" ADD CONSTRAINT "technician_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "ticket_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "technician_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closure_code_id_fkey" FOREIGN KEY ("closure_code_id") REFERENCES "closure_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merge_parent_id_fkey" FOREIGN KEY ("merge_parent_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_watchers" ADD CONSTRAINT "ticket_watchers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_watchers" ADD CONSTRAINT "ticket_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
