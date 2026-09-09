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
import { PrismaClient, StatusCategory, DisplayTone } from '@prisma/client';
import { IMPACTS, PRIORITIES, STATUS_WORKFLOWS, TICKET_TYPES, URGENCIES } from '@itsm/shared';

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

const IMPACT_SEEDS = [
  { key: IMPACTS.HIGH, name: 'Organization-wide', level: 3 },
  { key: IMPACTS.MEDIUM, name: 'Department or team', level: 2 },
  { key: IMPACTS.LOW, name: 'Single user', level: 1 },
];

const URGENCY_SEEDS = [
  { key: URGENCIES.HIGH, name: 'High — work is stopped', level: 3 },
  { key: URGENCIES.MEDIUM, name: 'Medium — work is degraded', level: 2 },
  { key: URGENCIES.LOW, name: 'Low — can wait', level: 1 },
];

/**
 * The standard ITIL 3x3 grid, as `[impact][urgency] = priority`. Rows are impact
 * high→low, columns urgency high→low. An admin can rewrite any cell, or add a fourth and
 * fifth level to either axis, without a migration — the grid is rows in `priority_matrix`.
 */
const PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  [IMPACTS.HIGH]: {
    [URGENCIES.HIGH]: PRIORITIES.CRITICAL,
    [URGENCIES.MEDIUM]: PRIORITIES.HIGH,
    [URGENCIES.LOW]: PRIORITIES.MEDIUM,
  },
  [IMPACTS.MEDIUM]: {
    [URGENCIES.HIGH]: PRIORITIES.HIGH,
    [URGENCIES.MEDIUM]: PRIORITIES.MEDIUM,
    [URGENCIES.LOW]: PRIORITIES.LOW,
  },
  [IMPACTS.LOW]: {
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
interface CategorySeed {
  name: string;
  children?: CategorySeed[];
}

const CATEGORY_TREE: CategorySeed[] = [
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
 * Categories have no natural unique key across the tree — two branches may both contain
 * "Other" — so they are matched on (parent, name), which is unique in practice for a
 * starter tree and keeps the seed idempotent without inventing a key column users would
 * then have to maintain.
 */
async function seedCategories(
  prisma: PrismaClient,
  nodes: CategorySeed[],
  parentId: string | null,
): Promise<number> {
  let count = 0;
  let position = 10;

  for (const node of nodes) {
    const existing = await prisma.category.findFirst({
      where: { name: node.name, parentId },
      select: { id: true },
    });

    const category = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: { position, isActive: true },
        })
      : await prisma.category.create({
          data: { name: node.name, parentId, position },
        });

    count += 1;
    position += 10;

    if (node.children?.length) {
      count += await seedCategories(prisma, node.children, category.id);
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

  console.log('Seeding the category tree...');
  const categories = await seedCategories(prisma, CATEGORY_TREE, null);

  console.log(
    `Ticketing seed complete: workflows=${workflows.size}, ticketTypes=${TICKET_TYPE_SEEDS.length}, ` +
      `priorities=${priorities.size}, impacts=${impacts.size}, urgencies=${urgencies.size}, ` +
      `matrixCells=${cells}, categories=${categories}`,
  );
}
