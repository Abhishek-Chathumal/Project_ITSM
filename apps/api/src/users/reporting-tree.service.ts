import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TreeIntegrityError,
  buildPath,
  depthOf,
  planMove,
  subtreePrefix,
} from '../common/tree/materialized-path';

/**
 * Maintains the reporting tree on `User.managerId` / `User.reportingPath`.
 *
 * Functional Reference I3.2 adds reporting lines to a constitution that had no concept of
 * them, and asks for two things that are easy to get wrong in opposite ways:
 *
 * > Materialize the reporting path (`/1/7/22/`) on the user record and maintain it on manager
 * > change, so subtree queries are an indexed prefix match rather than a recursive query per
 * > request. **Guard against cycles on every manager assignment** — a reporting loop makes
 * > subtree resolution non-terminating.
 *
 * So: the path is derived data that must never drift from `managerId`, and a cycle must be
 * **rejected at assignment**, not detected afterwards. 7.3.2 is explicit — *"Reject the
 * assignment; do not merely detect it later."*
 *
 * The tree arithmetic itself is not reimplemented here. It is the same materialized-path
 * helper the Category, Department and Location trees use, which is what Ref B4 asks for and
 * what makes the `/1/7/` vs `/1/70/` prefix collision a solved problem rather than a fourth
 * opportunity to reintroduce it.
 */
@Injectable()
export class ReportingTreeService {
  private readonly logger = new Logger(ReportingTreeService.name);

  /**
   * How deep a reporting line may go.
   *
   * Not in the specification, and deliberately finite anyway: `hierarchy` scope walks this
   * path on the hot path of every scoped query, and an accidental hundred-deep chain — the
   * usual cause being an import that chained everyone to their predecessor — makes those
   * paths long enough to matter. Generous enough that no real org chart meets it.
   */
  static readonly MAX_DEPTH = 20;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign (or clear) a user's manager, rejecting anything that would corrupt the tree, and
   * rewrite the moved user's whole subtree.
   *
   * Runs in a transaction: a partial rewrite would leave descendants claiming an ancestry
   * they no longer have, which is worse than the move failing — `hierarchy` scope would then
   * return a wrong row set rather than an error.
   */
  async setManager(userId: string, managerId: string | null): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, reportingPath: true, managerId: true },
    });
    if (!user) throw new BadRequestException(`No such user: ${userId}`);

    if (managerId === userId) {
      throw new BadRequestException('A user cannot report to themselves');
    }

    let manager: { id: string; reportingPath: string } | null = null;
    if (managerId !== null) {
      const found = await this.prisma.user.findUnique({
        where: { id: managerId },
        select: { id: true, reportingPath: true },
      });
      if (!found) throw new BadRequestException(`No such manager: ${managerId}`);
      manager = found;
    }

    // A user seeded before this column existed has an empty path. Repair it in place rather
    // than propagating the emptiness — an empty path used as a subtree prefix would match
    // every row in the table, which is the widest possible failure.
    const currentPath = user.reportingPath || buildPath(user.id, null);

    const descendants = await this.prisma.user.findMany({
      where: { reportingPath: { startsWith: currentPath } },
      select: { id: true, reportingPath: true },
    });

    const nodes = descendants.map((d) => ({
      id: d.id,
      path: d.reportingPath,
      depth: depthOf(d.reportingPath),
    }));
    // The moved user must be in its own subtree even if its path was empty a moment ago.
    if (!nodes.some((n) => n.id === user.id)) {
      nodes.unshift({ id: user.id, path: currentPath, depth: depthOf(currentPath) });
    }

    let plan;
    try {
      plan = planMove(
        { id: user.id, path: currentPath, depth: depthOf(currentPath) },
        manager
          ? {
              id: manager.id,
              path: manager.reportingPath || buildPath(manager.id, null),
              depth: depthOf(manager.reportingPath || buildPath(manager.id, null)),
            }
          : null,
        nodes,
        { maxDepth: ReportingTreeService.MAX_DEPTH, treeName: 'Reporting' },
      );
    } catch (error) {
      if (error instanceof TreeIntegrityError) {
        // A cycle or a depth breach. Surface it as a 400 — this is a rejected assignment,
        // not an internal fault, and the message names which user made it invalid.
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { managerId },
      }),
      ...plan.map((node) =>
        this.prisma.user.update({
          where: { id: node.id },
          data: { reportingPath: node.path },
        }),
      ),
    ]);

    this.logger.log(
      `Reporting line updated: ${userId} -> ${managerId ?? 'no manager'} (${plan.length} path(s) rewritten)`,
    );
  }

  /**
   * The prefix selecting a user and everyone beneath them — what `hierarchy` scope filters on.
   *
   * Returns null when the user has no usable path, and a caller must then produce **no rows**
   * rather than all of them. This is the same class of trap as a null `departmentId`
   * contributing `{ departmentId: null }` to a query: the empty case has to fail closed, and
   * the only way to guarantee that is to make it impossible to express accidentally.
   */
  async subtreePrefixFor(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reportingPath: true },
    });
    if (!user?.reportingPath) return null;
    return subtreePrefix({ path: user.reportingPath });
  }

  /**
   * Backfill paths for users that have none — the seeded population, and anyone created
   * before the column existed.
   *
   * Walks generation by generation so a parent's path is always written before its children
   * read it. Bounded by MAX_DEPTH so a pre-existing cycle in the data cannot spin forever;
   * anything left unreachable after that is reported rather than silently skipped.
   */
  async backfillPaths(): Promise<{ written: number; unreachable: string[] }> {
    const users = await this.prisma.user.findMany({
      select: { id: true, managerId: true, reportingPath: true },
    });
    const pathById = new Map<string, string>();
    for (const u of users) {
      if (u.managerId === null) pathById.set(u.id, buildPath(u.id, null));
    }

    let changed = true;
    let rounds = 0;
    while (changed && rounds < ReportingTreeService.MAX_DEPTH) {
      changed = false;
      rounds += 1;
      for (const u of users) {
        if (pathById.has(u.id) || u.managerId === null) continue;
        const parentPath = pathById.get(u.managerId);
        if (parentPath) {
          pathById.set(u.id, buildPath(u.id, parentPath));
          changed = true;
        }
      }
    }

    const updates = users
      .filter((u) => pathById.has(u.id) && pathById.get(u.id) !== u.reportingPath)
      .map((u) =>
        this.prisma.user.update({
          where: { id: u.id },
          data: { reportingPath: pathById.get(u.id)! },
        }),
      );
    if (updates.length > 0) await this.prisma.$transaction(updates);

    const unreachable = users.filter((u) => !pathById.has(u.id)).map((u) => u.id);
    if (unreachable.length > 0) {
      this.logger.warn(
        `${unreachable.length} user(s) have no resolvable reporting path — a cycle or a ` +
          `missing manager. They will match no hierarchy-scoped query until repaired.`,
      );
    }

    return { written: updates.length, unreachable };
  }
}
