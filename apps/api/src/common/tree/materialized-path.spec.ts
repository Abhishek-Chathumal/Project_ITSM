import {
  TreeIntegrityError,
  assertNoCycle,
  assertWithinDepth,
  buildPath,
  depthOf,
  idsInPath,
  isAtOrBeneath,
  planMove,
  rewriteDescendantPath,
  selfIdOf,
  subtreePrefix,
} from './materialized-path';

describe('materialized-path', () => {
  describe('buildPath', () => {
    it('bounds a root path with separators on both sides', () => {
      expect(buildPath('a', null)).toBe('/a/');
    });

    it('treats an empty parent path as a root', () => {
      // The column defaults to '' before the tree helper has written to it, so a node
      // seeded and then pathed in a second step must not produce '//a/'.
      expect(buildPath('a', '')).toBe('/a/');
    });

    it('appends to a parent path', () => {
      expect(buildPath('c', '/a/b/')).toBe('/a/b/c/');
    });

    it('refuses a malformed parent path rather than propagating it', () => {
      expect(() => buildPath('c', 'a/b')).toThrow(TreeIntegrityError);
      expect(() => buildPath('c', '/a/b')).toThrow(TreeIntegrityError);
    });

    it('refuses a node with no id', () => {
      expect(() => buildPath('', null)).toThrow(TreeIntegrityError);
    });
  });

  describe('the trailing separator', () => {
    // This is the reason the separator is mandatory rather than tidy. Without it,
    // startsWith('/1/7') matches '/1/70/', so a `department` scope silently pulls in a
    // sibling subtree — a data leak that a test using ids 1, 2 and 3 would never catch.
    it('stops a sibling with a numerically-prefixed id from matching', () => {
      const seven = { path: buildPath('7', '/1/') };
      const seventy = { path: buildPath('70', '/1/') };

      expect(seven.path).toBe('/1/7/');
      expect(seventy.path).toBe('/1/70/');
      expect(isAtOrBeneath(seventy, seven)).toBe(false);
      expect(seventy.path.startsWith('/1/7')).toBe(true); // the bug, if the separator were dropped
    });

    it('still matches a genuine descendant', () => {
      const seven = { path: '/1/7/' };
      const child = { path: '/1/7/22/' };
      expect(isAtOrBeneath(child, seven)).toBe(true);
    });

    it('counts a node as within its own subtree, which is what scope requires', () => {
      // "My department including sub-departments" includes my department.
      const node = { path: '/1/7/' };
      expect(isAtOrBeneath(node, node)).toBe(true);
    });
  });

  describe('depth and path parsing', () => {
    it('reports a root as depth 0', () => {
      expect(depthOf('/a/')).toBe(0);
    });

    it('counts each ancestor', () => {
      expect(depthOf('/a/b/c/')).toBe(2);
    });

    it('lists ancestors root-first including self', () => {
      expect(idsInPath('/a/b/c/')).toEqual(['a', 'b', 'c']);
    });

    it('reads the node id off the end of the path', () => {
      expect(selfIdOf('/a/b/c/')).toBe('c');
      expect(selfIdOf('')).toBeNull();
    });

    it('refuses to build a subtree prefix from an unpathed row', () => {
      // An empty path is the column default. Treating it as a prefix would match every
      // row in the table, which is the widest possible failure.
      expect(() => subtreePrefix({ path: '' })).toThrow(TreeIntegrityError);
    });
  });

  describe('assertNoCycle', () => {
    const node = { id: 'b', path: '/a/b/', depth: 1 };

    it('permits a move to an unrelated parent', () => {
      expect(() => assertNoCycle(node, { id: 'x', path: '/x/', depth: 0 })).not.toThrow();
    });

    it('permits a move to a root', () => {
      expect(() => assertNoCycle(node, null)).not.toThrow();
    });

    it('rejects a node becoming its own parent', () => {
      expect(() => assertNoCycle(node, node)).toThrow(/cannot be its own parent/);
    });

    it('rejects a move beneath its own descendant', () => {
      // Ref I3.2: a reporting loop makes subtree resolution non-terminating. In the other
      // three trees it is quieter — the paths simply stop describing reality.
      const descendant = { id: 'c', path: '/a/b/c/', depth: 2 };
      expect(() => assertNoCycle(node, descendant)).toThrow(/cycle/);
    });
  });

  describe('assertWithinDepth', () => {
    it('permits a depth at the ceiling', () => {
      expect(() => assertWithinDepth(5, 5, 'Department')).not.toThrow();
    });

    it('rejects a depth past the ceiling, naming the tree', () => {
      expect(() => assertWithinDepth(6, 5, 'Department')).toThrow(/Department tree depth 6/);
    });
  });

  describe('rewriteDescendantPath', () => {
    it('swaps the ancestor prefix and keeps the tail', () => {
      expect(rewriteDescendantPath('/a/b/c/d/', '/a/b/', '/x/b/')).toBe('/x/b/c/d/');
    });

    it('refuses a path that is not beneath the old ancestor', () => {
      expect(() => rewriteDescendantPath('/z/', '/a/b/', '/x/b/')).toThrow(TreeIntegrityError);
    });
  });

  describe('planMove', () => {
    const node = { id: 'b', path: '/a/b/', depth: 1 };
    const descendants = [
      node,
      { id: 'c', path: '/a/b/c/', depth: 2 },
      { id: 'd', path: '/a/b/c/d/', depth: 3 },
    ];

    it('rewrites the whole subtree and recomputes every depth', () => {
      const plan = planMove(node, { id: 'x', path: '/x/', depth: 0 }, descendants, {
        maxDepth: 5,
        treeName: 'Location',
      });
      expect(plan).toEqual([
        { id: 'b', path: '/x/b/', depth: 1 },
        { id: 'c', path: '/x/b/c/', depth: 2 },
        { id: 'd', path: '/x/b/c/d/', depth: 3 },
      ]);
    });

    it('promotes a subtree to the root', () => {
      const plan = planMove(node, null, descendants, { maxDepth: 5, treeName: 'Location' });
      expect(plan).toEqual([
        { id: 'b', path: '/b/', depth: 0 },
        { id: 'c', path: '/b/c/', depth: 1 },
        { id: 'd', path: '/b/c/d/', depth: 2 },
      ]);
    });

    it('measures the ceiling against the deepest descendant, not the moved node', () => {
      // Moving a node to depth 3 is fine on its own; its grandchild landing at depth 5 is
      // what breaches a ceiling of 4. Checking only the moved node is the subtle version
      // of this bug.
      const deepParent = { id: 'p', path: '/p1/p2/p3/p/', depth: 3 };
      expect(() =>
        planMove(node, deepParent, descendants, { maxDepth: 4, treeName: 'Department' }),
      ).toThrow(/exceeds the configured maximum of 4/);
    });

    it('checks for a cycle before planning anything', () => {
      const descendant = { id: 'c', path: '/a/b/c/', depth: 2 };
      expect(() =>
        planMove(node, descendant, descendants, { maxDepth: 9, treeName: 'Category' }),
      ).toThrow(/cycle/);
    });
  });
});
