/**
 * The one materialized-path implementation, shared by every tree in the system.
 *
 * Functional Reference B4 names three self-referencing trees — Category, Department and
 * Location — and asks for them to be built once: *"Implement once with a shared tree helper
 * (materialized path) plus a configurable depth guard — not three bespoke implementations."*
 * Reference I3.2 adds a fourth user, the reporting tree on `User.manager_id`, and asks for
 * the same shape for the same reason.
 *
 * These are pure functions over ids and paths. They touch no database and know about no
 * table, which is what lets one implementation serve four of them — and what makes the
 * cycle and depth rules testable without a Postgres.
 *
 * ## Why a materialized path at all
 *
 * Two of the seven scope values in Reference I3.1 are subtree questions: `department`
 * ("optionally including sub-departments") and `location` ("optionally including child
 * locations"). `hierarchy` is a third once the reporting tree lands. Answered from parent
 * pointers alone, each is a recursive query **per request**, on the hot path of every list
 * endpoint. Answered from a materialized path, each is one indexed prefix match.
 *
 * The cost is that the path is derived data and has to be maintained on every insert and
 * every move — which is what {@link buildPath} and {@link rewriteDescendantPath} are for.
 */

import { TREE_PATH_SEPARATOR } from '@itsm/shared';

const SEP = TREE_PATH_SEPARATOR;

/** The subset of a tree row this module needs. Any of the four trees satisfies it. */
export interface TreeNode {
  id: string;
  path: string;
  depth: number;
}

/** Raised when an operation would corrupt the tree. Always fail the write, never repair. */
export class TreeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TreeIntegrityError';
  }
}

/**
 * The path of a node given its parent's path, or of a root when `parentPath` is null.
 *
 * Both separators are always present: a root `X` is `/X/`, its child `Y` is `/X/Y/`. The
 * trailing separator is not cosmetic — without it, `startsWith('/1/7')` matches `/1/70/`
 * as well as `/1/7/`, silently pulling a sibling subtree into a scoped query. That is the
 * classic materialized-path bug and it is precisely the kind that passes a hand-written
 * test with ids 1, 2 and 3.
 */
export function buildPath(id: string, parentPath: string | null): string {
  if (!id) throw new TreeIntegrityError('Cannot build a path for a node with no id');
  if (parentPath === null || parentPath === '') return `${SEP}${id}${SEP}`;
  if (!parentPath.startsWith(SEP) || !parentPath.endsWith(SEP)) {
    throw new TreeIntegrityError(
      `Parent path ${JSON.stringify(parentPath)} is malformed: expected leading and trailing ${SEP}`,
    );
  }
  return `${parentPath}${id}${SEP}`;
}

/** Depth of a node from its path. A root is 0. */
export function depthOf(path: string): number {
  return idsInPath(path).length - 1;
}

/** The ancestor ids of a node, root first, including the node itself. */
export function idsInPath(path: string): string[] {
  return path.split(SEP).filter((segment) => segment.length > 0);
}

/** The node's own id — the last segment. */
export function selfIdOf(path: string): string | null {
  const ids = idsInPath(path);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

/**
 * The path prefix that selects a node and everything beneath it.
 *
 * This is the value a scope predicate compares against, so it is deliberately the whole of
 * the subtree test: `WHERE path LIKE subtreePrefix(node) || '%'`, which in Prisma is
 * `{ path: { startsWith: subtreePrefix(node) } }`.
 *
 * Note that the prefix matches the node itself as well as its descendants. That is correct
 * for scope: "my department including sub-departments" includes my department.
 */
export function subtreePrefix(node: Pick<TreeNode, 'path'>): string {
  if (!node.path) {
    throw new TreeIntegrityError('Cannot build a subtree prefix from an empty path');
  }
  return node.path;
}

/** Whether `candidate` lies at or beneath `ancestor`. */
export function isAtOrBeneath(
  candidate: Pick<TreeNode, 'path'>,
  ancestor: Pick<TreeNode, 'path'>,
): boolean {
  return candidate.path.startsWith(subtreePrefix(ancestor));
}

/**
 * Guard against a move that would make a node its own ancestor.
 *
 * Reference I3.2 requires this on the reporting tree — *"Guard against cycles on every
 * manager assignment — a reporting loop makes subtree resolution non-terminating"* — and
 * the same applies to the other three trees. A cycle in a materialized-path tree does not
 * announce itself: the paths simply stop describing reality, and a subtree query starts
 * returning a wrong row set rather than hanging.
 *
 * Throws rather than returning false. A caller that wanted a boolean would have to remember
 * to check it, and the failure mode of forgetting is a corrupted tree.
 */
export function assertNoCycle(node: TreeNode, newParent: TreeNode | null): void {
  if (newParent === null) return;
  if (newParent.id === node.id) {
    throw new TreeIntegrityError(`Node ${node.id} cannot be its own parent`);
  }
  if (isAtOrBeneath(newParent, node)) {
    throw new TreeIntegrityError(
      `Node ${node.id} cannot be moved beneath its own descendant ${newParent.id}: ` +
        `that would create a cycle (${newParent.path} lies under ${node.path})`,
    );
  }
}

/**
 * Guard the configurable depth ceiling from Reference B4.
 *
 * Applied to the deepest node the operation would produce, not to the node being moved —
 * moving a three-level subtree under a node at depth 4 overruns a limit of 5 even though
 * the moved node itself lands at depth 5.
 */
export function assertWithinDepth(depth: number, maxDepth: number, treeName: string): void {
  if (depth > maxDepth) {
    throw new TreeIntegrityError(
      `${treeName} tree depth ${depth} exceeds the configured maximum of ${maxDepth}`,
    );
  }
}

/**
 * The path a descendant takes when its ancestor moves.
 *
 * A move rewrites the whole subtree: every descendant's path has the old ancestor prefix
 * swapped for the new one, and its depth shifts by the same delta. Doing this in one pass
 * over `path LIKE oldPrefix%` is the reason the column is worth maintaining.
 */
export function rewriteDescendantPath(
  descendantPath: string,
  oldAncestorPath: string,
  newAncestorPath: string,
): string {
  if (!descendantPath.startsWith(oldAncestorPath)) {
    throw new TreeIntegrityError(
      `Path ${descendantPath} is not beneath ${oldAncestorPath} and cannot be rewritten`,
    );
  }
  return newAncestorPath + descendantPath.slice(oldAncestorPath.length);
}

/**
 * Plan the full set of row updates a move implies, without performing any of them.
 *
 * Returned rather than executed so the caller can apply it inside its own transaction, and
 * so the cycle and depth checks run before anything is written. `descendants` is every row
 * whose path starts with the moving node's current path, the node itself included.
 */
export function planMove(
  node: TreeNode,
  newParent: TreeNode | null,
  descendants: TreeNode[],
  options: { maxDepth: number; treeName: string },
): Array<{ id: string; path: string; depth: number }> {
  assertNoCycle(node, newParent);

  const newPath = buildPath(node.id, newParent ? newParent.path : null);
  const depthDelta = depthOf(newPath) - node.depth;

  const deepest = descendants.reduce((max, d) => Math.max(max, d.depth), node.depth);
  assertWithinDepth(deepest + depthDelta, options.maxDepth, options.treeName);

  return descendants.map((descendant) => {
    const path = rewriteDescendantPath(descendant.path, node.path, newPath);
    return { id: descendant.id, path, depth: depthOf(path) };
  });
}
