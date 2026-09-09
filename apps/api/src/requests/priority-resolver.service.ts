/**
 * Priority derivation from the Impact x Urgency matrix (Functional Reference B3).
 *
 * ## The rule that matters, and the one implementations get wrong
 *
 * B3: *"It fires only when Priority is left blank at creation. An explicitly set priority is
 * never overridden."*
 *
 * So this is **not** a recompute-on-write hook. A ticket whose priority a technician set by
 * hand keeps that priority when someone later widens its impact — the matrix has no say. The
 * reference document singles this case out as the one that gets built wrong, and asks for a
 * test that a manually-set priority survives a subsequent impact change; that test is in
 * `priority-resolver.service.spec.ts`.
 *
 * The permission that gates setting priority by hand is `request.priority.override`
 * (Ref I2.1), and it arrives with the API in Slice 3. This service is deliberately unaware
 * of it: deciding *whether the caller may* set a priority is an authorization question, and
 * deciding *what the matrix yields* is not. Keeping them apart is what stops the matrix from
 * growing a second, quieter permission check.
 *
 * ADR-0016 already settled why the resolved value is stored on the ticket rather than
 * derived on read: an admin editing the grid must not retroactively rewrite the priority of
 * every ticket in flight, including one a breached SLA was measured against.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** What the caller supplied at creation. `priorityId` set means the matrix stands down. */
export interface PriorityResolutionInput {
  impactId: string;
  urgencyId: string;
  /** An explicitly chosen priority, or null/undefined to derive one. */
  priorityId?: string | null;
}

export interface PriorityResolution {
  priorityId: string;
  /** How the value was arrived at — recorded on the audit entry by the caller. */
  source: 'explicit' | 'matrix';
}

/**
 * Thrown when the grid has no cell for a valid (impact, urgency) pair.
 *
 * ADR-0016 committed to this behaviour and it is worth restating: an admin who adds an axis
 * level without filling in the new cells leaves a hole, and a ticket classified into that
 * hole has no priority. Guessing one — nearest neighbour, lowest, the axis average — would
 * produce a plausible number with no basis, which on an ITSM queue is worse than a refusal.
 * The write fails and says which cell is missing.
 */
export class MissingPriorityMatrixCellError extends Error {
  constructor(
    readonly impactId: string,
    readonly urgencyId: string,
  ) {
    super(
      `The priority matrix has no cell for impact ${impactId} x urgency ${urgencyId}. ` +
        `An axis level was probably added without filling in its row or column.`,
    );
    this.name = 'MissingPriorityMatrixCellError';
  }
}

@Injectable()
export class PriorityResolverService {
  private readonly logger = new Logger(PriorityResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the priority for a request being created.
   *
   * Call this on create only. Calling it on update is the bug B3 describes: it would make
   * an impact change silently overwrite a priority a human chose.
   */
  async resolveForCreate(input: PriorityResolutionInput): Promise<PriorityResolution> {
    if (input.priorityId) {
      // An explicit choice. The matrix is not consulted, and — importantly — the explicit
      // value is not validated against what the matrix would have produced. They are
      // allowed to disagree; that is what overriding means.
      return { priorityId: input.priorityId, source: 'explicit' };
    }

    const cell = await this.prisma.priorityMatrix.findUnique({
      where: {
        impactId_urgencyId: { impactId: input.impactId, urgencyId: input.urgencyId },
      },
      select: { priorityId: true },
    });

    if (!cell) {
      throw new MissingPriorityMatrixCellError(input.impactId, input.urgencyId);
    }

    return { priorityId: cell.priorityId, source: 'matrix' };
  }

  /**
   * Re-derive priority from the current grid as a deliberate, explicit act.
   *
   * Separate from {@link resolveForCreate} because it must never be reachable from an
   * ordinary update path. It exists for the case ADR-0016 anticipated — an admin who has
   * corrected the grid and wants a specific ticket reclassified against it — and the caller
   * is responsible for the `request.priority.override` check and the audit entry.
   */
  async rederive(impactId: string, urgencyId: string): Promise<string> {
    const { priorityId } = await this.resolveForCreate({ impactId, urgencyId });
    return priorityId;
  }
}
