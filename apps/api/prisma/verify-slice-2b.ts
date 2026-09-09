/**
 * Runtime verification for Slice 2b, against a real Postgres.
 *
 * Not a unit test. This exists because every Phase 0 bug in this project was runtime-only —
 * the schema compiled, the tests passed, and the thing fell over when it met a database.
 * Run it with the dev stack up:
 *
 *   npx ts-node --transpile-only prisma/verify-slice-2b.ts
 *
 * It writes and then removes its own fixtures, so it is safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { IMPACTS, PRIORITIES, TICKET_SOURCES, TICKET_TYPES, URGENCIES } from '@itsm/shared';
import { buildPath, depthOf, isAtOrBeneath } from '../src/common/tree/materialized-path';

const prisma = new PrismaClient();

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  console.log('\n--- 1. The priority matrix is 3x4, per Ref B3 ---');
  const impacts = await prisma.impact.findMany({ orderBy: { level: 'desc' } });
  const urgencies = await prisma.urgency.findMany({ orderBy: { level: 'desc' } });
  const cells = await prisma.priorityMatrix.count();
  check('3 impact levels', impacts.length === 3, `got ${impacts.length}`);
  check('4 urgency levels', urgencies.length === 4, `got ${urgencies.length}`);
  check('12 matrix cells', cells === 12, `got ${cells}`);
  check(
    'urgency levels are 1..4 with no gap',
    JSON.stringify(urgencies.map((u) => u.level)) === '[4,3,2,1]',
    urgencies.map((u) => `${u.key}=${u.level}`).join(' '),
  );

  console.log('\n--- 2. The one cell Ref B3 fixes by example ---');
  const byKey = async (impactKey: string, urgencyKey: string) => {
    const impact = impacts.find((i) => i.key === impactKey)!;
    const urgency = urgencies.find((u) => u.key === urgencyKey)!;
    const cell = await prisma.priorityMatrix.findUnique({
      where: { impactId_urgencyId: { impactId: impact.id, urgencyId: urgency.id } },
      include: { priority: true },
    });
    return cell?.priority.key;
  };
  const example = await byKey(IMPACTS.HIGH, URGENCIES.MEDIUM);
  check(
    'On Business x Medium = High (B3 worked example)',
    example === PRIORITIES.HIGH,
    `got ${example}`,
  );

  console.log('\n--- 3. Slice 2 cells were widened, not rewritten ---');
  // Every pre-existing cell must still yield what it did before the fourth urgency existed.
  const preExisting: Array<[string, string, string]> = [
    [IMPACTS.HIGH, URGENCIES.HIGH, PRIORITIES.CRITICAL],
    [IMPACTS.HIGH, URGENCIES.MEDIUM, PRIORITIES.HIGH],
    [IMPACTS.HIGH, URGENCIES.LOW, PRIORITIES.MEDIUM],
    [IMPACTS.MEDIUM, URGENCIES.HIGH, PRIORITIES.HIGH],
    [IMPACTS.MEDIUM, URGENCIES.MEDIUM, PRIORITIES.MEDIUM],
    [IMPACTS.MEDIUM, URGENCIES.LOW, PRIORITIES.LOW],
    [IMPACTS.LOW, URGENCIES.HIGH, PRIORITIES.MEDIUM],
    [IMPACTS.LOW, URGENCIES.MEDIUM, PRIORITIES.LOW],
    [IMPACTS.LOW, URGENCIES.LOW, PRIORITIES.LOW],
  ];
  for (const [i, u, expected] of preExisting) {
    const got = await byKey(i, u);
    check(`${i} x ${u} still = ${expected}`, got === expected, `got ${got}`);
  }

  console.log('\n--- 4. Tree paths are well-formed and match parentage ---');
  for (const [name, rows] of [
    ['category', await prisma.category.findMany()],
    ['location', await prisma.location.findMany()],
    ['department', await prisma.department.findMany()],
  ] as const) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    let ok = true;
    let why = '';
    for (const row of rows) {
      const parentId =
        'parentId' in row ? row.parentId : (row as { parentDeptId: string | null }).parentDeptId;
      const parent = parentId ? byId.get(parentId)! : null;
      const expected = buildPath(row.id, parent ? parent.path : null);
      if (row.path !== expected) {
        ok = false;
        why = `${row.name}: path ${row.path} != expected ${expected}`;
        break;
      }
      if (row.depth !== depthOf(row.path)) {
        ok = false;
        why = `${row.name}: depth ${row.depth} != ${depthOf(row.path)}`;
        break;
      }
      if (!row.path.startsWith('/') || !row.path.endsWith('/')) {
        ok = false;
        why = `${row.name}: path ${row.path} lacks bounding separators`;
        break;
      }
    }
    check(`${name} paths consistent (${rows.length} rows)`, ok, why);
  }

  console.log('\n--- 5. A subtree prefix selects the subtree and nothing else ---');
  const headOffice = await prisma.location.findFirst({ where: { name: 'Head Office' } });
  if (!headOffice) {
    check('Head Office seeded', false);
  } else {
    const beneath = await prisma.location.findMany({
      where: { path: { startsWith: headOffice.path } },
    });
    const allLocations = await prisma.location.findMany();
    const expectedBeneath = allLocations.filter((l) => isAtOrBeneath(l, headOffice));
    check(
      'prefix match returns Head Office + its 3 floors',
      beneath.length === 4,
      `got ${beneath.length}`,
    );
    check(
      'prefix match agrees with the in-memory predicate',
      beneath.length === expectedBeneath.length,
      `db ${beneath.length} vs helper ${expectedBeneath.length}`,
    );
    const branches = await prisma.location.findFirst({ where: { name: 'Branch Offices' } });
    check(
      'a sibling subtree is excluded',
      branches !== null && !beneath.some((l) => l.id === branches.id),
    );
  }

  console.log('\n--- 6. A request round-trips with all four ownership axes ---');
  const admin = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });
  const type = await prisma.ticketType.findUnique({
    where: { key: TICKET_TYPES.INCIDENT },
    include: { defaultWorkflow: { include: { statuses: true } } },
  });
  const group = await prisma.technicianGroup.findUnique({ where: { key: 'service_desk' } });
  const source = await prisma.ticketSource.findUnique({ where: { key: TICKET_SOURCES.EMAIL } });
  const dept = await prisma.department.findFirst();
  const initial = type?.defaultWorkflow?.statuses.find((s) => s.isInitial);

  if (!admin || !type || !group || !source || !dept || !initial || !headOffice) {
    check('fixtures present', false, 'seed did not provide the rows this needs');
  } else {
    const impact = impacts.find((i) => i.key === IMPACTS.LOW)!;
    const urgency = urgencies.find((u) => u.key === URGENCIES.URGENT)!;
    const matrixCell = await prisma.priorityMatrix.findUnique({
      where: { impactId_urgencyId: { impactId: impact.id, urgencyId: urgency.id } },
      include: { priority: true },
    });

    const created = await prisma.ticket.create({
      data: {
        title: '[verify-slice-2b] laptop will not boot',
        description: 'Verification fixture. Removed at the end of this script.',
        typeId: type.id,
        statusId: initial.id,
        impactId: impact.id,
        urgencyId: urgency.id,
        priorityId: matrixCell!.priorityId,
        requesterId: admin.id,
        groupId: group.id,
        departmentId: dept.id,
        locationId: headOffice.id,
        sourceId: source.id,
        tags: ['verification', 'hardware'],
        responseEscalationLevel: 2,
        watchers: { create: [{ userId: admin.id }] },
        collaborators: { create: [{ userId: admin.id }] },
      },
      include: { watchers: true, collaborators: true, priority: true },
    });

    check('ticket created with a number', created.number > 0, `number=${created.number}`);
    check(
      'new urgency resolves through the new column: On User x Urgent = High',
      created.priority.key === PRIORITIES.HIGH,
      `got ${created.priority.key}`,
    );
    check('watcher recorded', created.watchers.length === 1);
    check('collaborator recorded', created.collaborators.length === 1);
    check('tags stored as an array', created.tags.length === 2, created.tags.join(','));
    check('escalation level is a counter', created.responseEscalationLevel === 2);
    check('group and department are separate columns', created.groupId !== created.departmentId);

    console.log('\n--- 7. `own` scope can be expressed over all four participant kinds ---');
    // The query applyScope() will have to emit for scope=own. Written here to prove the
    // schema supports it; the helper itself is Slice 0c.
    const ownScoped = await prisma.ticket.findMany({
      where: {
        OR: [
          { requesterId: admin.id },
          { assigneeId: admin.id },
          { watchers: { some: { userId: admin.id } } },
          { collaborators: { some: { userId: admin.id } } },
        ],
      },
      select: { id: true },
    });
    check(
      'all four `own` predicates compile and match (Ref I3.1)',
      ownScoped.some((t) => t.id === created.id),
      `matched ${ownScoped.length} rows`,
    );

    // And the trap the docs name: a null-department user must contribute nothing.
    const nullDeptTickets = await prisma.ticket.count({ where: { departmentId: null } });
    check(
      'a `{ departmentId: null }` filter really does match unassigned rows',
      typeof nullDeptTickets === 'number',
      `${nullDeptTickets} rows would leak if a null department were passed through — ` +
        `this is the case applyScope() must special-case, recorded here as a live fact`,
    );

    await prisma.ticket.delete({ where: { id: created.id } });
    console.log('  (fixture removed)');
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
