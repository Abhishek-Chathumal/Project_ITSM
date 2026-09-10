import { seedPermissions } from './permission-reconciler';
import type { PrismaClient } from '../../generated/prisma/client';

/**
 * The reconciliation rules from constitution 7.3.5, tested against an in-memory stand-in for
 * the `Permission` table.
 *
 * These are behavioural rules about *upgrades*, and the failure they prevent is an upgrade
 * changing what someone can do without anyone deciding it should. That is not something a
 * from-empty seed run can demonstrate — it only shows up when there is a previous state to
 * reconcile against, which is exactly what this fakes.
 */
interface FakeRow {
  id: string;
  key: string;
  module: string;
  description: string;
  isSensitive: boolean;
  deprecatedAt: Date | null;
}

function makePrisma(rows: FakeRow[], grants: Record<string, string[]> = {}) {
  const store = [...rows];
  const warnings: string[] = [];
  const prisma = {
    permission: {
      findMany: async () => store.map((r) => ({ ...r })),
      create: async ({ data }: { data: Omit<FakeRow, 'id' | 'deprecatedAt'> }) => {
        const row: FakeRow = { id: `id-${data.key}`, deprecatedAt: null, ...data };
        store.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { key?: string; id?: string };
        data: Partial<FakeRow>;
      }) => {
        const row = store.find((r) => (where.key ? r.key === where.key : r.id === where.id))!;
        Object.assign(row, data);
        return row;
      },
    },
    rolePermission: {
      findMany: async ({ where }: { where: { permissionId: string } }) => {
        const row = store.find((r) => r.id === where.permissionId);
        const names = row ? (grants[row.key] ?? []) : [];
        return names.map((name) => ({ role: { name } }));
      },
    },
  } as unknown as PrismaClient;
  return { prisma, store, warnings };
}

const originalWarn = console.warn;
beforeEach(() => {
  console.warn = jest.fn();
});
afterEach(() => {
  console.warn = originalWarn;
});

describe('seedPermissions — reconciliation (constitution 7.3.5)', () => {
  it('creates every manifest permission against an empty table', async () => {
    const { prisma, store } = makePrisma([]);

    const result = await seedPermissions(prisma);

    expect(result.added.length).toBeGreaterThan(150);
    expect(result.deprecated).toEqual([]);
    expect(store.length).toBe(result.added.length);
  });

  it('is idempotent — a second run changes nothing', async () => {
    const { prisma, store } = makePrisma([]);

    await seedPermissions(prisma);
    const countAfterFirst = store.length;
    const second = await seedPermissions(prisma);

    expect(second.added).toEqual([]);
    expect(second.updated).toBe(0);
    expect(second.deprecated).toEqual([]);
    expect(store.length).toBe(countAfterFirst);
  });

  it('grants a newly added permission to nobody', async () => {
    // This is the whole of "new permissions are added disabled-by-default for existing
    // custom roles": a Permission row with no RolePermission confers nothing, so there is
    // no separate disable step to forget. The test asserts the reconciliation never writes
    // a grant — `rolePermission` has no `create` on the fake, so any attempt would throw.
    const { prisma } = makePrisma([]);
    await expect(seedPermissions(prisma)).resolves.toBeDefined();
  });

  it('soft-deletes a permission the manifest no longer declares', async () => {
    const orphan: FakeRow = {
      id: 'id-legacy.thing',
      key: 'legacy.thing',
      module: 'legacy',
      description: 'Removed in a later release',
      isSensitive: false,
      deprecatedAt: null,
    };
    const { prisma, store } = makePrisma([orphan]);

    const result = await seedPermissions(prisma);

    expect(result.deprecated).toContain('legacy.thing');
    const row = store.find((r) => r.key === 'legacy.thing')!;
    expect(row.deprecatedAt).toBeInstanceOf(Date);
    // Soft, not hard: the row survives so the grants against it stay reviewable.
    expect(store.filter((r) => r.key === 'legacy.thing')).toHaveLength(1);
  });

  it('names the roles that still hold a removed permission', async () => {
    const orphan: FakeRow = {
      id: 'id-legacy.thing',
      key: 'legacy.thing',
      module: 'legacy',
      description: 'Removed',
      isSensitive: false,
      deprecatedAt: null,
    };
    const { prisma } = makePrisma([orphan], { 'legacy.thing': ['Auditor', 'Admin'] });

    const result = await seedPermissions(prisma);

    expect(result.orphanedGrants).toEqual([{ key: 'legacy.thing', roles: ['Admin', 'Auditor'] }]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Admin, Auditor'));
  });

  it('does not re-deprecate an already deprecated permission', async () => {
    const alreadyGone: FakeRow = {
      id: 'id-old.key',
      key: 'old.key',
      module: 'legacy',
      description: 'Long gone',
      isSensitive: false,
      deprecatedAt: new Date('2020-01-01'),
    };
    const { prisma, store } = makePrisma([alreadyGone]);

    const result = await seedPermissions(prisma);

    expect(result.deprecated).not.toContain('old.key');
    expect(store.find((r) => r.key === 'old.key')!.deprecatedAt).toEqual(new Date('2020-01-01'));
  });

  it('revives a permission that returns to the manifest', async () => {
    // A key dropped and later reinstated must become grantable again. Leaving it deprecated
    // would give a catalogue that claims the permission exists and a database that refuses
    // to grant it — a disagreement nothing would surface.
    const revived: FakeRow = {
      id: 'id-request.view',
      key: 'request.view',
      module: 'request',
      description: 'View requests',
      isSensitive: false,
      deprecatedAt: new Date('2020-01-01'),
    };
    const { prisma, store } = makePrisma([revived]);

    const result = await seedPermissions(prisma);

    expect(result.revived).toContain('request.view');
    expect(store.find((r) => r.key === 'request.view')!.deprecatedAt).toBeNull();
  });

  it('re-asserts drifted metadata from the manifest', async () => {
    // module / description / isSensitive are statements the catalogue makes, not fields an
    // admin edits — unlike a Status name. If someone changes isSensitive in the database,
    // step-up MFA silently stops applying, so the manifest wins.
    const tampered: FakeRow = {
      id: 'id-user.permission.grant',
      key: 'user.permission.grant',
      module: 'wrong',
      description: 'tampered',
      isSensitive: false,
      deprecatedAt: null,
    };
    const { prisma, store } = makePrisma([tampered]);

    await seedPermissions(prisma);

    const row = store.find((r) => r.key === 'user.permission.grant')!;
    expect(row.module).toBe('access');
    expect(row.isSensitive).toBe(true);
    expect(row.description).not.toBe('tampered');
  });
});
