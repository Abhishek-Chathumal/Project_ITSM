import { BadRequestException } from '@nestjs/common';
import { ReportingTreeService } from './reporting-tree.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The reporting tree's two invariants (Ref I3.2, constitution 7.3.2):
 *
 * - a manager assignment that would create a cycle is **rejected**, not recorded and
 *   detected later;
 * - `reportingPath` is rewritten for the moved user *and their whole subtree*, so it never
 *   drifts from `managerId`.
 *
 * Both matter because `hierarchy` scope reads the path, not the pointers. A drifted path does
 * not error — it returns a wrong row set.
 */
interface FakeUser {
  id: string;
  managerId: string | null;
  reportingPath: string;
}

function makePrisma(users: FakeUser[]) {
  const store = users.map((u) => ({ ...u }));
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.find((u) => u.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { reportingPath?: { startsWith: string } } } = {}) => {
        if (!where?.reportingPath) return store.map((u) => ({ ...u }));
        const prefix = where.reportingPath.startsWith;
        return store.filter((u) => u.reportingPath.startsWith(prefix)).map((u) => ({ ...u }));
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const row = store.find((u) => u.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    $transaction: async (ops: unknown[]) => ops,
  } as unknown as PrismaService;
  return { prisma, store };
}

/** a -> b -> c, plus an unrelated root x. */
function chain(): FakeUser[] {
  return [
    { id: 'a', managerId: null, reportingPath: '/a/' },
    { id: 'b', managerId: 'a', reportingPath: '/a/b/' },
    { id: 'c', managerId: 'b', reportingPath: '/a/b/c/' },
    { id: 'x', managerId: null, reportingPath: '/x/' },
  ];
}

describe('ReportingTreeService', () => {
  describe('cycle protection', () => {
    it('rejects a user reporting to themselves', async () => {
      const { prisma } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await expect(service.setManager('b', 'b')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a move beneath the user’s own subordinate', async () => {
      // a -> b -> c; making `c` the manager of `a` closes the loop.
      const { prisma } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await expect(service.setManager('a', 'c')).rejects.toThrow(/cycle/i);
    });

    it('rejects the assignment rather than recording it', async () => {
      // 7.3.2: "Reject the assignment; do not merely detect it later." The distinction is
      // the whole point — a recorded cycle makes subtree resolution non-terminating.
      const { prisma, store } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await expect(service.setManager('a', 'c')).rejects.toBeDefined();

      expect(store.find((u) => u.id === 'a')!.managerId).toBeNull();
      expect(store.find((u) => u.id === 'a')!.reportingPath).toBe('/a/');
    });

    it('permits a move to an unrelated branch', async () => {
      const { prisma } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await expect(service.setManager('b', 'x')).resolves.toBeUndefined();
    });
  });

  describe('path maintenance', () => {
    it('rewrites the whole subtree, not only the moved user', async () => {
      const { prisma, store } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await service.setManager('b', 'x');

      expect(store.find((u) => u.id === 'b')!.reportingPath).toBe('/x/b/');
      // The descendant is the part that gets forgotten, and forgetting it is silent.
      expect(store.find((u) => u.id === 'c')!.reportingPath).toBe('/x/b/c/');
    });

    it('promotes a subtree to a root when the manager is cleared', async () => {
      const { prisma, store } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await service.setManager('b', null);

      expect(store.find((u) => u.id === 'b')!.reportingPath).toBe('/b/');
      expect(store.find((u) => u.id === 'c')!.reportingPath).toBe('/b/c/');
      expect(store.find((u) => u.id === 'b')!.managerId).toBeNull();
    });

    it('rejects an unknown user or manager instead of writing a dangling pointer', async () => {
      const { prisma } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      await expect(service.setManager('nope', 'a')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setManager('a', 'nope')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('subtreePrefixFor', () => {
    it('returns the prefix that selects the user and everyone beneath them', async () => {
      const { prisma } = makePrisma(chain());
      const service = new ReportingTreeService(prisma);

      expect(await service.subtreePrefixFor('a')).toBe('/a/');
    });

    it('returns null for a user with no path, so the caller must fail closed', async () => {
      // The trap this exists to avoid is the same shape as `{ departmentId: null }` matching
      // every unassigned record: an empty prefix would match every row in the table.
      const { prisma } = makePrisma([{ id: 'u', managerId: null, reportingPath: '' }]);
      const service = new ReportingTreeService(prisma);

      expect(await service.subtreePrefixFor('u')).toBeNull();
    });
  });

  describe('backfillPaths', () => {
    it('writes paths generation by generation', async () => {
      const { prisma, store } = makePrisma([
        { id: 'a', managerId: null, reportingPath: '' },
        { id: 'b', managerId: 'a', reportingPath: '' },
        { id: 'c', managerId: 'b', reportingPath: '' },
      ]);
      const service = new ReportingTreeService(prisma);

      const result = await service.backfillPaths();

      expect(result.written).toBe(3);
      expect(result.unreachable).toEqual([]);
      expect(store.map((u) => u.reportingPath)).toEqual(['/a/', '/a/b/', '/a/b/c/']);
    });

    it('reports users it cannot resolve rather than skipping them silently', async () => {
      // A pre-existing cycle in the data, e.g. from an import. It cannot be repaired here,
      // but it must not be invisible: these users match no hierarchy-scoped query.
      const { prisma } = makePrisma([
        { id: 'p', managerId: 'q', reportingPath: '' },
        { id: 'q', managerId: 'p', reportingPath: '' },
      ]);
      const service = new ReportingTreeService(prisma);

      const result = await service.backfillPaths();

      expect(result.unreachable.sort()).toEqual(['p', 'q']);
    });
  });
});
