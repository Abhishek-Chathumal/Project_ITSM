/**
 * The single predicate for "does this request count?" (Functional Reference B5).
 *
 * B5 names three states that are **not** Closed and must be modelled distinctly — Spam,
 * Archived, and Merged-as-secondary — and then gives the instruction this file exists to
 * follow:
 *
 * > *"Failing to exclude these produces silently wrong SLA compliance and workload numbers.
 * > Encode the exclusions in one `isOperationallyActive()` predicate used everywhere, not
 * > repeated per query."*
 *
 * The failure mode is the same one that governs `applyScope()`, and it is worth naming: a
 * query that forgets to exclude spam does not break. It returns a number that is wrong by
 * however much spam it swept up, on a dashboard nobody cross-checks. Both the predicate and
 * the Prisma filter below are exported from here so that no caller ever spells the
 * condition out by hand.
 */

import type { Prisma } from '@prisma/client';

/** The fields the predicate reads. Any ticket row satisfies it. */
export interface OperationalStateFields {
  isSpam: boolean;
  archivedAt: Date | null;
  mergeParentId: string | null;
}

/**
 * Whether a request counts toward operational metrics: SLA timers, CSAT sampling, workload
 * (including Smart Balance load in Ref E7.2), and volume counts.
 *
 * Note that this is orthogonal to status. A Closed ticket *is* operationally active in this
 * sense — it happened, it was worked, it counts in volume and in SLA compliance. What these
 * three flags say is that the ticket should never have been in the numbers at all.
 */
export function isOperationallyActive(request: OperationalStateFields): boolean {
  if (request.isSpam) return false;
  if (request.archivedAt !== null) return false;
  // The secondary side of a merge. The primary keeps counting; counting both would
  // double-count one piece of work (Ref B5).
  if (request.mergeParentId !== null) return false;
  return true;
}

/**
 * The same rule as a Prisma `where` fragment, for queries that must not load rows to
 * discard them.
 *
 * Spread into a filter: `where: { ...operationallyActiveFilter(), statusId }`.
 *
 * Kept beside the predicate deliberately. Two expressions of one rule will drift if they
 * live apart, and the drift is invisible — `isOperationallyActive()` and a hand-written
 * filter disagreeing shows up as a report that does not match a list.
 */
export function operationallyActiveFilter(): Prisma.TicketWhereInput {
  return {
    isSpam: false,
    archivedAt: null,
    mergeParentId: null,
  };
}
