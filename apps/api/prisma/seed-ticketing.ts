/**
 * Phase 1 ticketing reference data (constitution §2.1, §2.2, §3.3, Part VII).
 *
 * Split out of `seed.ts` because it is a different kind of thing: `seed.ts` seeds the
 * identity model that authorization depends on, this seeds the configuration a ticket is
 * classified against. Both are idempotent upserts keyed on the stable `key` columns, so
 * re-running never duplicates and never clobbers a name an admin has since edited —
 * except where the row is a system row whose semantics code relies on.
 *
 * Everything here is a starting point, not a constraint: the whole point of Article II is
 * that an admin can rename a status, reorder a category tree, or move from a 3x3 grid to a
 * 5x5 one without a migration or a code change.
 */
import { PrismaClient, StatusCategory, DisplayTone } from '../src/generated/prisma/client';
import {
  CLOSURE_CODES,
  IMPACTS,
  PRIORITIES,
  STATUS_WORKFLOWS,
  TICKET_SOURCES,
  TICKET_TYPES,
  TREE_MAX_DEPTH,
  URGENCIES,
} from '@itsm/shared';
import { buildPath, depthOf } from '../src/common/tree/materialized-path';

/** The default lifecycle from §2.1, in order. */
interface StatusSeed {
  key: string;
  name: string;
  category: StatusCategory;
  tone: DisplayTone;
  isInitial?: boolean;
  isTerminal?: boolean;
}

/**
 * `New → Open → In Progress → Pending (Customer) → Pending (Vendor) → Resolved → Closed
 * → Reopened`, exactly as the constitution specifies it.
 *
 * `key` and `category` are the parts code reads; `name` is the label. That separation is
 * what lets the Service Request workflow below reuse this shape while calling one of the
 * states something else.
 */
const DEFAULT_STATUSES: StatusSeed[] = [
  { key: 'new', name: 'New', category: 'triage', tone: 'neutral', isInitial: true },
  { key: 'open', name: 'Open', category: 'open', tone: 'info' },
  { key: 'in_progress', name: 'In Progress', category: 'open', tone: 'accent' },
  { key: 'pending_customer', name: 'Pending (Customer)', category: 'pending', tone: 'warning' },
  { key: 'pending_vendor', name: 'Pending (Vendor)', category: 'pending', tone: 'warning' },
  { key: 'resolved', name: 'Resolved', category: 'resolved', tone: 'success' },
  { key: 'closed', name: 'Closed', category: 'closed', tone: 'neutral', isTerminal: true },
  { key: 'reopened', name: 'Reopened', category: 'open', tone: 'info' },
];

/**
 * The Service Request workflow is a separate row with the same states, differing only in
 * what "Resolved" is called. Two rows rather than one shared row is the point: §2.2 allows
 * a distinct workflow per type, so editing the Incident flow must not touch requests.
 */
const SERVICE_REQUEST_STATUSES: StatusSeed[] = DEFAULT_STATUSES.map((status) =>
  status.key === 'resolved' ? { ...status, name: 'Fulfilled' } : status,
);

const WORKFLOWS = [
  {
    key: STATUS_WORKFLOWS.INCIDENT_DEFAULT,
    name: 'Incident Workflow',
    description: 'Default incident lifecycle (constitution §2.1).',
    statuses: DEFAULT_STATUSES,
  },
  {
    key: STATUS_WORKFLOWS.SERVICE_REQUEST_DEFAULT,
    name: 'Service Request Workflow',
    description: 'Default service request lifecycle. Diverge freely from the incident flow.',
    statuses: SERVICE_REQUEST_STATUSES,
  },
];

const TICKET_TYPE_SEEDS = [
  {
    key: TICKET_TYPES.INCIDENT,
    name: 'Incident',
    description: 'An unplanned interruption to a service, or a reduction in its quality.',
    workflowKey: STATUS_WORKFLOWS.INCIDENT_DEFAULT,
    position: 10,
  },
  {
    key: TICKET_TYPES.SERVICE_REQUEST,
    name: 'Service Request',
    description: 'A request for something to be provided — access, hardware, information.',
    workflowKey: STATUS_WORKFLOWS.SERVICE_REQUEST_DEFAULT,
    position: 20,
  },
];

/** Higher weight = more urgent. Gaps left so an admin can insert a level between two. */
const PRIORITY_SEEDS = [
  { key: PRIORITIES.CRITICAL, name: 'Critical', weight: 40, tone: 'danger' as DisplayTone },
  { key: PRIORITIES.HIGH, name: 'High', weight: 30, tone: 'warning' as DisplayTone },
  { key: PRIORITIES.MEDIUM, name: 'Medium', weight: 20, tone: 'info' as DisplayTone },
  { key: PRIORITIES.LOW, name: 'Low', weight: 10, tone: 'neutral' as DisplayTone },
];

/**
 * Blast radius, in Ref B3's vocabulary: `On User` -> `On Department` -> `On Business`.
 *
 * The keys are unchanged from Slice 2 — `key` is the contract and renaming one would orphan
 * every matrix cell and every classified ticket. Only the labels move, and since the seed's
 * update clause does not overwrite `name`, an admin who has already relabelled these keeps
 * their wording.
 */
const IMPACT_SEEDS = [
  { key: IMPACTS.HIGH, name: 'On Business', level: 3 },
  { key: IMPACTS.MEDIUM, name: 'On Department', level: 2 },
  { key: IMPACTS.LOW, name: 'On User', level: 1 },
];

/**
 * Four levels, per Ref B3. The fourth is the whole point of Slice 2b: Slice 2 seeded three,
 * against the constitution's 7.2 table, and a 3x3 grid cannot express the difference between
 * "needed today" and "the business is stopped". See ADR-0018.
 */
const URGENCY_SEEDS = [
  { key: URGENCIES.URGENT, name: 'Urgent — the business is stopped', level: 4 },
  { key: URGENCIES.HIGH, name: 'High — work is stopped', level: 3 },
  { key: URGENCIES.MEDIUM, name: 'Medium — work is degraded', level: 2 },
  { key: URGENCIES.LOW, name: 'Low — can wait', level: 1 },
];

/** The channels a request can arrive through (Ref B1, B2). */
const SOURCE_SEEDS = [
  { key: TICKET_SOURCES.PORTAL, name: 'Self-service portal', position: 10 },
  { key: TICKET_SOURCES.EMAIL, name: 'Email', position: 20 },
  { key: TICKET_SOURCES.PHONE, name: 'Phone', position: 30 },
  { key: TICKET_SOURCES.CHAT, name: 'Chat', position: 40 },
  { key: TICKET_SOURCES.WALK_IN, name: 'Walk-in', position: 50 },
  { key: TICKET_SOURCES.API, name: 'API', position: 60 },
  { key: TICKET_SOURCES.MONITORING, name: 'Monitoring alert', position: 70 },
];

/** How a request ended, as distinct from the status it ended in (Ref B2). */
const CLOSURE_CODE_SEEDS = [
  { key: CLOSURE_CODES.RESOLVED, name: 'Resolved', position: 10 },
  { key: CLOSURE_CODES.WORKAROUND_PROVIDED, name: 'Workaround provided', position: 20 },
  { key: CLOSURE_CODES.NOT_REPRODUCIBLE, name: 'Not reproducible', position: 30 },
  { key: CLOSURE_CODES.DUPLICATE, name: 'Duplicate', position: 40 },
  { key: CLOSURE_CODES.WITHDRAWN, name: 'Withdrawn by requester', position: 50 },
  { key: CLOSURE_CODES.NO_FAULT_FOUND, name: 'No fault found', position: 60 },
  { key: CLOSURE_CODES.REJECTED, name: 'Rejected', position: 70 },
];

/**
 * Starter technician groups (Ref B1, G3.3).
 *
 * These are teams, not departments — the distinction ADR-0018 draws. A technician may
 * belong to several, which is why membership is a join table and not a column.
 */
const TECHNICIAN_GROUP_SEEDS = [
  {
    key: 'service_desk',
    name: 'Service Desk',
    description: 'First-line triage and fulfilment.',
    position: 10,
  },
  {
    key: 'desktop_support',
    name: 'Desktop Support',
    description: 'End-user hardware and software.',
    position: 20,
  },
  {
    key: 'network_infrastructure',
    name: 'Network & Infrastructure',
    description: 'Connectivity, servers and platform services.',
    position: 30,
  },
  {
    key: 'applications',
    name: 'Applications',
    description: 'Line-of-business application support.',
    position: 40,
  },
];

/**
 * A starter location tree (Ref B4).
 *
 * Two levels is enough to make the tree real rather than theoretical — `location` scope
 * "optionally including child locations" needs something to nest before the behaviour can
 * be tested at all.
 */
const LOCATION_TREE: TreeSeed[] = [
  {
    name: 'Head Office',
    children: [{ name: 'Ground Floor' }, { name: 'First Floor' }, { name: 'Second Floor' }],
  },
  {
    name: 'Branch Offices',
    children: [{ name: 'Branch — North' }, { name: 'Branch — South' }],
  },
  { name: 'Remote / Work From Home' },
];

/**
 * The 3x4 grid from Ref B3, as `[impact][urgency] = priority`. Rows are impact high->low,
 * columns urgency high->low.
 *
 * **This widens Slice 2's grid rather than rewriting it.** All nine original cells keep the
 * priority they had; the twelve-cell shape comes entirely from the new `urgent` column. So
 * a ticket classified before this seed ran resolves to the same priority it would have
 * before — the change adds a classification that was previously inexpressible instead of
 * reclassifying anything.
 *
 * The one cell Ref B3 fixes by example is `On Business` x `Medium` -> `High`, which is
 * asserted in `priority-matrix.spec.ts` so a future edit to this table cannot quietly
 * contradict the specification.
 */
const PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  [IMPACTS.HIGH]: {
    [URGENCIES.URGENT]: PRIORITIES.CRITICAL,
    [URGENCIES.HIGH]: PRIORITIES.CRITICAL,
    [URGENCIES.MEDIUM]: PRIORITIES.HIGH,
    [URGENCIES.LOW]: PRIORITIES.MEDIUM,
  },
  [IMPACTS.MEDIUM]: {
    [URGENCIES.URGENT]: PRIORITIES.CRITICAL,
    [URGENCIES.HIGH]: PRIORITIES.HIGH,
    [URGENCIES.MEDIUM]: PRIORITIES.MEDIUM,
    [URGENCIES.LOW]: PRIORITIES.LOW,
  },
  [IMPACTS.LOW]: {
    [URGENCIES.URGENT]: PRIORITIES.HIGH,
    [URGENCIES.HIGH]: PRIORITIES.MEDIUM,
    [URGENCIES.MEDIUM]: PRIORITIES.LOW,
    [URGENCIES.LOW]: PRIORITIES.LOW,
  },
};

/**
 * A starter tree, three levels deep under Hardware so the `Category > Subcategory > Item`
 * shape from §2.1 ("Hardware > Laptop > Screen") is real rather than theoretical. Depth is
 * not limited by the schema.
 */
interface TreeSeed {
  name: string;
  children?: TreeSeed[];
}

const CATEGORY_TREE: TreeSeed[] = [
  {
    name: 'Hardware',
    children: [
      {
        name: 'Laptop',
        children: [
          { name: 'Screen' },
          { name: 'Battery' },
          { name: 'Keyboard' },
          { name: 'Docking station' },
        ],
      },
      { name: 'Desktop' },
      { name: 'Printer' },
      { name: 'Peripherals' },
      { name: 'Mobile device' },
    ],
  },
  {
    name: 'Software',
    children: [
      { name: 'Operating system' },
      { name: 'Productivity suite' },
      { name: 'Line-of-business application' },
      { name: 'Licensing' },
    ],
  },
  {
    name: 'Network',
    children: [{ name: 'Connectivity' }, { name: 'VPN' }, { name: 'Wi-Fi' }],
  },
  {
    name: 'Account & access',
    children: [
      { name: 'Password reset' },
      { name: 'New account' },
      { name: 'Permissions' },
      { name: 'Shared mailbox access' },
    ],
  },
  {
    name: 'Email',
    children: [{ name: 'Mailbox' }, { name: 'Distribution list' }, { name: 'Spam' }],
  },
  { name: 'Other' },
];

/**
 * One tree seeder for both trees, per Ref B4's instruction not to write three bespoke
 * implementations. Category and Location differ only in which Prisma delegate they use and
 * what their depth ceiling is, so those are the parameters.
 *
 * Nodes have no natural unique key across a tree — two branches may both contain "Other" —
 * so they are matched on (parent, name), which is unique in practice for a starter tree and
 * keeps the seed idempotent without inventing a key column an admin would then maintain.
 *
 * **Path is written in a second step, after the insert.** A materialized path contains the
 * node's own id, and the id is not known until the row exists. Everything else about the row
 * is set on create; only `path` and `depth` need the extra update. Doing it per node as the
 * recursion descends means a child always reads a parent path that is already correct.
 */
interface TreeDelegate {
  findFirst(args: {
    where: { name: string; parentId: string | null };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: { name: string; parentId: string | null; position: number };
  }): Promise<{ id: string }>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<{ id: string; path: string }>;
}

async function seedTree(
  delegate: TreeDelegate,
  nodes: TreeSeed[],
  parentPath: string | null,
  parentId: string | null,
  options: { maxDepth: number; treeName: string },
): Promise<number> {
  let count = 0;
  let position = 10;

  for (const node of nodes) {
    const existing = await delegate.findFirst({
      where: { name: node.name, parentId },
      select: { id: true },
    });

    const row =
      existing ?? (await delegate.create({ data: { name: node.name, parentId, position } }));

    const path = buildPath(row.id, parentPath);
    const depth = depthOf(path);

    if (depth > options.maxDepth) {
      throw new Error(
        `${options.treeName} seed exceeds its configured depth ceiling of ${options.maxDepth} at "${node.name}"`,
      );
    }

    const saved = await delegate.update({
      where: { id: row.id },
      data: { position, isActive: true, path, depth },
    });

    count += 1;
    position += 10;

    if (node.children?.length) {
      count += await seedTree(delegate, node.children, saved.path, saved.id, options);
    }
  }

  return count;
}

export async function seedTicketing(prisma: PrismaClient): Promise<void> {
  console.log('Seeding status workflows...');
  const workflows = new Map<string, string>();
  for (const workflow of WORKFLOWS) {
    const row = await prisma.statusWorkflow.upsert({
      where: { key: workflow.key },
      create: {
        key: workflow.key,
        name: workflow.name,
        description: workflow.description,
        isSystem: true,
      },
      update: { isSystem: true },
    });
    workflows.set(workflow.key, row.id);

    let position = 10;
    for (const status of workflow.statuses) {
      await prisma.status.upsert({
        where: { workflowId_key: { workflowId: row.id, key: status.key } },
        create: {
          workflowId: row.id,
          key: status.key,
          name: status.name,
          category: status.category,
          tone: status.tone,
          isInitial: status.isInitial ?? false,
          isTerminal: status.isTerminal ?? false,
          position,
        },
        // `name` is deliberately not updated: an admin who renamed a status keeps their
        // label across re-seeds. Category and the lifecycle flags are code contracts, so
        // those are re-asserted.
        update: {
          category: status.category,
          isInitial: status.isInitial ?? false,
          isTerminal: status.isTerminal ?? false,
          position,
        },
      });
      position += 10;
    }
  }

  console.log('Seeding ticket types...');
  for (const type of TICKET_TYPE_SEEDS) {
    await prisma.ticketType.upsert({
      where: { key: type.key },
      create: {
        key: type.key,
        name: type.name,
        description: type.description,
        isSystemType: true,
        position: type.position,
        defaultWorkflowId: workflows.get(type.workflowKey),
      },
      update: {
        isSystemType: true,
        defaultWorkflowId: workflows.get(type.workflowKey),
      },
    });
  }

  console.log('Seeding priorities, impact and urgency...');
  const priorities = new Map<string, string>();
  for (const priority of PRIORITY_SEEDS) {
    const row = await prisma.priority.upsert({
      where: { key: priority.key },
      create: { ...priority, isSystem: true },
      update: { weight: priority.weight, tone: priority.tone, isSystem: true },
    });
    priorities.set(priority.key, row.id);
  }

  const impacts = new Map<string, string>();
  for (const impact of IMPACT_SEEDS) {
    const row = await prisma.impact.upsert({
      where: { key: impact.key },
      create: impact,
      update: { level: impact.level },
    });
    impacts.set(impact.key, row.id);
  }

  const urgencies = new Map<string, string>();
  for (const urgency of URGENCY_SEEDS) {
    const row = await prisma.urgency.upsert({
      where: { key: urgency.key },
      create: urgency,
      update: { level: urgency.level },
    });
    urgencies.set(urgency.key, row.id);
  }

  console.log('Seeding the priority matrix...');
  let cells = 0;
  for (const [impactKey, byUrgency] of Object.entries(PRIORITY_MATRIX)) {
    for (const [urgencyKey, priorityKey] of Object.entries(byUrgency)) {
      const impactId = impacts.get(impactKey)!;
      const urgencyId = urgencies.get(urgencyKey)!;
      const priorityId = priorities.get(priorityKey)!;
      await prisma.priorityMatrix.upsert({
        where: { impactId_urgencyId: { impactId, urgencyId } },
        create: { impactId, urgencyId, priorityId },
        update: { priorityId },
      });
      cells += 1;
    }
  }

  console.log('Seeding sources and closure codes...');
  for (const source of SOURCE_SEEDS) {
    await prisma.ticketSource.upsert({
      where: { key: source.key },
      create: { ...source, isSystem: true },
      // `name` is not re-asserted, for the same reason it is not on statuses: an admin who
      // renamed "Walk-in" to "In person" keeps their label across re-seeds.
      update: { isSystem: true, position: source.position },
    });
  }

  for (const code of CLOSURE_CODE_SEEDS) {
    await prisma.closureCode.upsert({
      where: { key: code.key },
      create: { ...code, isSystem: true },
      update: { isSystem: true, position: code.position },
    });
  }

  console.log('Seeding technician groups...');
  for (const group of TECHNICIAN_GROUP_SEEDS) {
    await prisma.technicianGroup.upsert({
      where: { key: group.key },
      create: { ...group, isSystem: true },
      update: { isSystem: true, position: group.position },
    });
  }

  console.log('Seeding the category tree...');
  const categories = await seedTree(
    prisma.category as unknown as TreeDelegate,
    CATEGORY_TREE,
    null,
    null,
    { maxDepth: TREE_MAX_DEPTH.CATEGORY, treeName: 'Category' },
  );

  console.log('Seeding the location tree...');
  const locations = await seedTree(
    prisma.location as unknown as TreeDelegate,
    LOCATION_TREE,
    null,
    null,
    { maxDepth: TREE_MAX_DEPTH.LOCATION, treeName: 'Location' },
  );

  console.log(
    `Ticketing seed complete: workflows=${workflows.size}, ticketTypes=${TICKET_TYPE_SEEDS.length}, ` +
      `priorities=${priorities.size}, impacts=${impacts.size}, urgencies=${urgencies.size}, ` +
      `matrixCells=${cells}, categories=${categories}, locations=${locations}, ` +
      `sources=${SOURCE_SEEDS.length}, closureCodes=${CLOSURE_CODE_SEEDS.length}, ` +
      `technicianGroups=${TECHNICIAN_GROUP_SEEDS.length}`,
  );
}
