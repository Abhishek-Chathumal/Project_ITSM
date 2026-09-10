import { createSeedClient } from './seed-client';
import * as argon2 from 'argon2';
import { DEFAULT_ROLES, PERMISSIONS } from '@itsm/shared';
import { seedTicketing } from './seed-ticketing';
import {
  seedPermissions,
  reportReconciliation,
} from '../src/common/permissions/permission-reconciler';
import { buildPath } from '../src/common/tree/materialized-path';

const prisma = createSeedClient();

// The catalogue is no longer listed here. It is the versioned manifest in `@itsm/shared`,
// applied by `seedPermissions()` — constitution 7.3.5 requires it to be a manifest checked
// into the repo rather than a hand-maintained list in a seed script, and the ten keys that
// used to live here were an illustrative subset of the ~174 in Functional Reference I2.

/**
 * Starter grants for the six system roles.
 *
 * ⚠️ **These are interim, and deliberately narrow.** Article III says a new role starts with
 * **zero** permissions, and the real answer — twelve permission-locked roles composed from
 * permission sets, each grant carrying a scope — is Slice 0d. Until then these grant only
 * what the existing Phase 0 admin screens actually need, so nothing is silently widened by
 * the catalogue growing from 10 entries to 174.
 *
 * **Admin does not get "everything" any more.** Under the old ten-key catalogue that was a
 * defensible shortcut; against 174 keys it would hand one role every destructive and
 * code-execution permission in the system, including `user.permission.grant`, before the
 * privilege safety rules of 5.3a / Ref I8 exist to constrain it. Admin gets the
 * administrative surface that is actually built, and nothing that guards a feature which
 * does not exist yet.
 */
const ROLE_PERMISSION_GRANTS: Record<string, string[]> = {
  Requester: [],
  Technician: [],
  'Team Lead': [],
  'Change Manager': [],
  Admin: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_EDIT,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.ORG_DEPARTMENT_MANAGE,
    PERMISSIONS.ORG_SETTINGS_MANAGE,
    PERMISSIONS.SECURITY_AUDIT_VIEW,
    PERMISSIONS.REPORT_VIEW,
  ],
  Auditor: [PERMISSIONS.SECURITY_AUDIT_VIEW, PERMISSIONS.REPORT_VIEW],
};

async function main() {
  console.log('Seeding roles...');
  const roles = new Map<string, { id: string }>();
  for (const name of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, isSystemRole: true },
      update: { isSystemRole: true },
    });
    roles.set(name, role);
  }

  console.log('Reconciling the permission manifest...');
  const reconciliation = await seedPermissions(prisma);
  reportReconciliation(reconciliation);

  console.log('Seeding role-permission grants...');
  // Only the grants for system roles are re-asserted. A custom role an admin built is not
  // touched here — which is the other half of 7.3.5's "disabled by default": the catalogue
  // growing must not change what anyone already holds.
  const grantable = await prisma.permission.findMany({
    where: { deprecatedAt: null },
    select: { id: true, key: true },
  });
  const permissionIdByKey = new Map(grantable.map((p) => [p.key, p.id]));

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSION_GRANTS)) {
    const role = roles.get(roleName);
    if (!role) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (keys.length === 0) continue;

    const missing = keys.filter((key) => !permissionIdByKey.has(key));
    if (missing.length > 0) {
      // A grant naming a key the catalogue does not contain is a bug in this file, not a
      // condition to tolerate: it would silently give the role less than intended.
      throw new Error(
        `Role "${roleName}" is granted permission(s) absent from the manifest: ${missing.join(', ')}`,
      );
    }

    await prisma.rolePermission.createMany({
      // Every grant states its scope — the column has no default, on purpose (see
      // schema.prisma). `all` is correct for these specific grants and is not a widening:
      // they are administrative permissions over configuration, which has no per-record
      // ownership to scope by. The record-bearing permissions that *do* need narrower
      // scopes (`request.view` at `own` or `group`) are granted in Slice 0d, where the
      // twelve roles are composed.
      data: keys.map((key) => ({
        roleId: role.id,
        permissionId: permissionIdByKey.get(key)!,
        scope: 'all' as const,
      })),
    });
  }

  console.log('Seeding default department...');
  // A fixed id so the row is stable across environments, which also means its materialized
  // path is known ahead of the insert rather than needing the write-then-update dance the
  // tree seeder does. Root node, so depth 0 and a single-segment path.
  const DEFAULT_DEPARTMENT_ID = '00000000-0000-0000-0000-000000000001';
  const department = await prisma.department.upsert({
    where: { id: DEFAULT_DEPARTMENT_ID },
    create: {
      id: DEFAULT_DEPARTMENT_ID,
      name: 'Unassigned',
      path: buildPath(DEFAULT_DEPARTMENT_ID, null),
      depth: 0,
    },
    // Re-asserted rather than left alone: `path` is derived data, not an admin's label, and
    // a row whose path drifted from its parentage would silently break `department` scope.
    update: { path: buildPath(DEFAULT_DEPARTMENT_ID, null), depth: 0 },
  });

  let adminCreated = false;
  if (process.env.SEED_BOOTSTRAP_ADMIN === 'true') {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        'SEED_BOOTSTRAP_ADMIN=true requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to be set',
      );
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { email },
      create: {
        name: 'Bootstrap Admin',
        email,
        passwordHash,
        roleId: roles.get('Admin')!.id,
        departmentId: department.id,
      },
      update: { passwordHash, roleId: roles.get('Admin')!.id },
    });
    adminCreated = true;
  }

  await seedTicketing(prisma);

  const permissionCount = await prisma.permission.count({ where: { deprecatedAt: null } });
  console.log(
    `Seed complete: roles=${roles.size}, permissions=${permissionCount}, department=1, bootstrapAdmin=${adminCreated}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
