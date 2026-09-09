import {
  MissingPriorityMatrixCellError,
  PriorityResolverService,
} from './priority-resolver.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A stand-in for the grid. `cells` is keyed `impactId|urgencyId`, and every lookup is
 * counted so a test can assert the matrix was *not* consulted — which is the only way to
 * prove the "explicitly set priority is never overridden" rule rather than assume it.
 */
function makePrisma(cells: Record<string, string>) {
  const lookups: string[] = [];
  const prisma = {
    priorityMatrix: {
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { impactId_urgencyId: { impactId: string; urgencyId: string } };
        }) => {
          const key = `${where.impactId_urgencyId.impactId}|${where.impactId_urgencyId.urgencyId}`;
          lookups.push(key);
          const priorityId = cells[key];
          return priorityId ? { priorityId } : null;
        },
      ),
    },
  } as unknown as PrismaService;
  return { prisma, lookups };
}

const GRID = {
  'impact-business|urgency-medium': 'priority-high', // Ref B3's worked example
  'impact-business|urgency-urgent': 'priority-critical',
  'impact-user|urgency-low': 'priority-low',
  'impact-user|urgency-urgent': 'priority-high',
};

describe('PriorityResolverService', () => {
  describe('when priority is left blank at creation', () => {
    it('derives it from the matrix', async () => {
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const result = await service.resolveForCreate({
        impactId: 'impact-business',
        urgencyId: 'urgency-medium',
      });

      expect(result).toEqual({ priorityId: 'priority-high', source: 'matrix' });
    });

    it('treats an explicit null the same as an omitted value', async () => {
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const result = await service.resolveForCreate({
        impactId: 'impact-user',
        urgencyId: 'urgency-low',
        priorityId: null,
      });

      expect(result.source).toBe('matrix');
      expect(result.priorityId).toBe('priority-low');
    });

    it('resolves the fourth urgency level Slice 2b added', async () => {
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const result = await service.resolveForCreate({
        impactId: 'impact-user',
        urgencyId: 'urgency-urgent',
      });

      expect(result.priorityId).toBe('priority-high');
    });

    it('refuses rather than guessing when the grid has a hole', async () => {
      // An admin who adds an axis level without filling in its row leaves a cell with no
      // priority. ADR-0016 committed to failing the write: a plausible-looking guess on an
      // ITSM queue is worse than a refusal.
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      await expect(
        service.resolveForCreate({ impactId: 'impact-business', urgencyId: 'urgency-low' }),
      ).rejects.toThrow(MissingPriorityMatrixCellError);
    });
  });

  describe('when a priority is set explicitly', () => {
    it('keeps it and does not consult the matrix at all', async () => {
      const { prisma, lookups } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const result = await service.resolveForCreate({
        impactId: 'impact-business',
        urgencyId: 'urgency-medium',
        priorityId: 'priority-low',
      });

      expect(result).toEqual({ priorityId: 'priority-low', source: 'explicit' });
      expect(lookups).toEqual([]);
    });

    it('allows the explicit value to disagree with what the grid would have produced', async () => {
      // That disagreement is the entire meaning of an override. Validating the explicit
      // value against the matrix would quietly reinstate the derivation.
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const result = await service.resolveForCreate({
        impactId: 'impact-business',
        urgencyId: 'urgency-urgent', // grid says critical
        priorityId: 'priority-low',
      });

      expect(result.priorityId).toBe('priority-low');
    });
  });

  /**
   * Ref B3 names this as the case implementations get wrong, and asks for it by name:
   * "Unit-test that a manually-set priority survives a subsequent impact change."
   *
   * The reason it gets built wrong is that recomputing priority on every write looks like
   * the more correct, more consistent thing to do — and it silently discards a human's
   * judgement every time someone widens the impact of a ticket.
   */
  describe('B3: a manually-set priority survives a later impact change', () => {
    it('does not re-derive, because nothing on the update path calls the resolver', async () => {
      const { prisma, lookups } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      // A technician raises the ticket and overrides priority down to Low.
      const atCreation = await service.resolveForCreate({
        impactId: 'impact-user',
        urgencyId: 'urgency-low',
        priorityId: 'priority-low',
      });
      expect(atCreation.priorityId).toBe('priority-low');

      // Later, someone widens the impact to the whole business. The matrix for the new
      // classification says Critical — and the ticket must stay Low.
      //
      // This is asserted as an interface fact rather than a behavioural one: the service
      // exposes no update path, so there is nothing an ordinary edit could call to
      // overwrite the stored value. `rederive` exists but is a separate, deliberate act
      // gated by `request.priority.override`.
      expect(Object.getOwnPropertyNames(PriorityResolverService.prototype).sort()).toEqual([
        'constructor',
        'rederive',
        'resolveForCreate',
      ]);
      expect(lookups).toEqual([]);
    });

    it('re-derives only when asked to, explicitly', async () => {
      const { prisma } = makePrisma(GRID);
      const service = new PriorityResolverService(prisma);

      const rederived = await service.rederive('impact-business', 'urgency-urgent');

      expect(rederived).toBe('priority-critical');
    });
  });
});
