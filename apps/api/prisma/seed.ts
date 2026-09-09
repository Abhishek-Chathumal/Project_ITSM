import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_ROLES, PERMISSIONS } from '@itsm/shared';
import { seedTicketing } from './seed-ticketing';

const prisma = new PrismaClient();

const PERMISSION_CATALOG: Array<{ key: string; description: string }> = [
  { key: PERMISSIONS.ROLE_MANAGE, description: 'Create, edit, delete roles and their permissions' },
  { key: PERMISSIONS.PERMISSION_VIEW, description: 'View the permission catalog' },
  { key: PERMISSIONS.USER_MANAGE, description: 'Create, edit, disable users' },
  { key: PERMISSIONS.DEPARTMENT_MANAGE, description: 'Manage departments/teams' },
  { key: PERMISSIONS.AUTOMATION_MANAGE, description: 'Configure automation rules' },
  { key: PERMISSIONS.REPORT_VIEW_ORG, description: 'View organization-wide reports' },
  { key: PERMISSIONS.AUDIT_VIEW, description: 'View the audit log' },
  { key: PERMISSIONS.ORG_SETTINGS_MANAGE, description: 'Manage branding/org-wide settings' },
  {
    key: PERMISSIONS.TICKET_VIEW_OWN,
    description: 'View own tickets (forward-declared for Phase 1)',
  },
  {
    key: PERMISSIONS.TICKET_EDIT_ASSIGNED,
    description: 'Edit tickets assigned to self (forward-declared for Phase 1)',
  },
];

// Least-privilege starter grants (Article III: new roles start with zero permissions;
// only Admin/Auditor get anything meaningful in Phase 0 since no ticket features exist yet).
const ROLE_PERMISSION_GRANTS: Record<string, string[]> = {
  Requester: [],
  Technician: [],
  'Team Lead': [],
  'Change Manager': [],
  Admin: PERMISSION_CATALOG.map((p) => p.key),
  Auditor: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.REPORT_VIEW_ORG],
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

  console.log('Seeding permission catalog...');
  const permissions = new Map<string, { id: string }>();
  for (const p of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { description: p.description },
    });
    permissions.set(p.key, permission);
  }

  console.log('Seeding role-permission grants...');
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSION_GRANTS)) {
    const role = roles.get(roleName);
    if (!role) continue;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (keys.length > 0) {
      await prisma.rolePermission.createMany({
        data: keys.map((key) => ({ roleId: role.id, permissionId: permissions.get(key)!.id })),
      });
    }
  }

  console.log('Seeding default department...');
  const department = await prisma.department.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Unassigned' },
    update: {},
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

  console.log(
    `Seed complete: roles=${roles.size}, permissions=${permissions.size}, department=1, bootstrapAdmin=${adminCreated}`,
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
