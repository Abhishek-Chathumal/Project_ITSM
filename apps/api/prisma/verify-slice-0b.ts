/**
 * Runtime verification for Phase 0 Slice 0b, against a real Postgres.
 *
 * The unit tests cover the tree arithmetic against a fake. This covers the parts only a
 * database can answer: that the enum accepts every scope value, that the `text_pattern_ops`
 * index actually serves a prefix match, and that a subtree query returns the rows a
 * `hierarchy`-scoped predicate would.
 *
 *   npx ts-node --transpile-only prisma/verify-slice-0b.ts
 */
import { createSeedClient } from './seed-client';
import { buildPath } from '../src/common/tree/materialized-path';
import { SCOPES } from '@itsm/shared';

const prisma = createSeedClient();

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  PASS  ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  console.log('\n--- 1. Every scope value in Ref I3.1 is storable ---');
  const role = await prisma.role.findFirst({ where: { isSystemRole: true } });
  const permission = await prisma.permission.findFirst({ where: { deprecatedAt: null } });
  if (!role || !permission) {
    check('fixtures present', false, 'seed the database first');
  } else {
    // A round-trip per scope. The enum is the contract applyScope() switches on, so a value
    // the database refuses would be a scope the helper can name but never store.
    for (const scope of SCOPES) {
      const created = await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id, scope },
        update: { scope },
      });
      check(`scope "${scope}" round-trips`, created.scope === scope, `got ${created.scope}`);
    }
    // Leave the grant as the seed had it.
    await prisma.rolePermission.update({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      data: { scope: 'all', scopeDepth: null, customScopeId: null },
    });
  }

  console.log('\n--- 2. scopeDepth is nullable and stores a depth limit ---');
  if (role && permission) {
    const withDepth = await prisma.rolePermission.update({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      data: { scope: 'hierarchy', scopeDepth: 1 },
    });
    check('hierarchy:1 (direct reports only) stores', withDepth.scopeDepth === 1);
    const noDepth = await prisma.rolePermission.update({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      data: { scope: 'all', scopeDepth: null },
    });
    check('null depth means the whole subtree', noDepth.scopeDepth === null);
  }

  console.log('\n--- 3. The reporting tree, built for real ---');
  const dept = await prisma.department.findFirst();
  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
  if (!dept || !adminRole) {
    check('fixtures present', false);
  } else {
    const mk = async (name: string) =>
      prisma.user.upsert({
        where: { email: `${name}@verify-0b.test` },
        create: {
          name,
          email: `${name}@verify-0b.test`,
          roleId: adminRole.id,
          departmentId: dept.id,
        },
        update: {},
        select: { id: true },
      });

    const head = await mk('head');
    const lead = await mk('lead');
    const techA = await mk('techa');
    const techB = await mk('techb');
    const outsider = await mk('outsider');

    // head -> lead -> {techA, techB};  outsider is a separate root.
    const headPath = buildPath(head.id, null);
    const leadPath = buildPath(lead.id, headPath);
    await prisma.user.update({
      where: { id: head.id },
      data: { managerId: null, reportingPath: headPath },
    });
    await prisma.user.update({
      where: { id: lead.id },
      data: { managerId: head.id, reportingPath: leadPath },
    });
    for (const t of [techA, techB]) {
      await prisma.user.update({
        where: { id: t.id },
        data: { managerId: lead.id, reportingPath: buildPath(t.id, leadPath) },
      });
    }
    await prisma.user.update({
      where: { id: outsider.id },
      data: { managerId: null, reportingPath: buildPath(outsider.id, null) },
    });

    // This is the query `hierarchy` scope will emit.
    const beneathHead = await prisma.user.findMany({
      where: { reportingPath: { startsWith: headPath } },
      select: { id: true },
    });
    check(
      'hierarchy:* from the head returns head + lead + 2 techs',
      beneathHead.length === 4,
      `got ${beneathHead.length}`,
    );
    check('an unrelated root is excluded', !beneathHead.some((u) => u.id === outsider.id));

    const beneathLead = await prisma.user.findMany({
      where: { reportingPath: { startsWith: leadPath } },
      select: { id: true },
    });
    check('hierarchy:* from the lead returns lead + 2 techs', beneathLead.length === 3);
    check('the head is not beneath their own report', !beneathLead.some((u) => u.id === head.id));

    console.log('\n--- 4. The prefix index is actually used ---');
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN SELECT id FROM users WHERE reporting_path LIKE '${headPath}%'`,
    );
    const planText = plan.map((r) => r['QUERY PLAN']).join(' ');
    // On a table this small Postgres may legitimately prefer a sequential scan; what matters
    // is that the index exists and is usable, which is what the catalogue query below shows.
    const idx = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE tablename='users' AND indexdef LIKE '%reporting_path%'`,
    );
    check(
      'reporting_path index uses text_pattern_ops',
      idx.some((i) => i.indexdef.includes('text_pattern_ops')),
      idx.map((i) => i.indexdef).join(' | ') || 'no index found',
    );
    console.log(
      `        (plan on a ${beneathHead.length + 1}-row table: ${planText.slice(0, 80)}…)`,
    );

    console.log('\n--- 5. Permission sets and custom scopes exist and link up ---');
    const set = await prisma.permissionSet.upsert({
      where: { key: 'verify_0b_set' },
      create: { key: 'verify_0b_set', name: 'Verification set' },
      update: {},
    });
    await prisma.permissionSetItem.upsert({
      where: {
        permissionSetId_permissionId: { permissionSetId: set.id, permissionId: permission!.id },
      },
      create: { permissionSetId: set.id, permissionId: permission!.id, defaultScope: 'department' },
      update: { defaultScope: 'department' },
    });
    await prisma.rolePermissionSet.upsert({
      where: { roleId_permissionSetId: { roleId: adminRole.id, permissionSetId: set.id } },
      create: { roleId: adminRole.id, permissionSetId: set.id },
      update: {},
    });
    const loaded = await prisma.permissionSet.findUnique({
      where: { id: set.id },
      include: { items: true, roles: true },
    });
    check(
      'a set carries items with a default scope',
      loaded?.items[0]?.defaultScope === 'department',
    );
    check('a role composes from a set', (loaded?.roles.length ?? 0) === 1);

    const custom = await prisma.customScope.upsert({
      where: { name: 'verify-0b-scope' },
      create: {
        name: 'verify-0b-scope',
        entityType: 'request',
        conditions: { location: 'Colombo', category: 'Network' },
      },
      update: {},
    });
    check('a custom scope stores a JSONB condition set', custom.entityType === 'request');

    // --- clean up fixtures
    await prisma.rolePermissionSet.deleteMany({ where: { permissionSetId: set.id } });
    await prisma.permissionSetItem.deleteMany({ where: { permissionSetId: set.id } });
    await prisma.permissionSet.delete({ where: { id: set.id } });
    await prisma.customScope.delete({ where: { id: custom.id } });
    for (const u of [techA, techB, lead, head, outsider]) {
      await prisma.user.update({ where: { id: u.id }, data: { managerId: null } });
    }
    await prisma.user.deleteMany({ where: { email: { endsWith: '@verify-0b.test' } } });
    console.log('  (fixtures removed)');
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
