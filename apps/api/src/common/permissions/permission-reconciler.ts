/**
 * Reconciles the permission manifest with the `Permission` table.
 *
 * Constitution 7.3.5 specifies this as a **reconciliation**, not an insert:
 *
 * > Each release migration reconciles the manifest with the `Permission` table: **new
 * > permissions are added disabled-by-default for existing custom roles** (so an upgrade
 * > never silently widens anyone's access), and removed permissions are soft-deleted with a
 * > warning naming the roles that referenced them.
 *
 * Both halves of that are about the same failure: an upgrade changing what someone can do
 * without anyone deciding it should. They fail in opposite directions and only one of them
 * is loud, which is why the quiet one gets the warning.
 */
import type { PrismaClient } from '../../generated/prisma/client';
import { PERMISSION_MANIFEST, PERMISSION_MANIFEST_VERSION } from '@itsm/shared';

export interface PermissionReconciliation {
  added: string[];
  updated: number;
  deprecated: string[];
  revived: string[];
  /** Deprecated keys that still have live role grants, with the roles naming them. */
  orphanedGrants: Array<{ key: string; roles: string[] }>;
}

/**
 * Apply the manifest.
 *
 * **New permissions are created and granted to nobody.** That is the whole of "disabled by
 * default for existing custom roles" — there is no separate disable step, because a
 * `Permission` row with no `RolePermission` referencing it confers nothing. System roles get
 * their grants re-asserted from their own definition afterwards (Slice 0d); custom roles an
 * admin built are left exactly as they were.
 *
 * Idempotent: running it twice changes nothing the second time.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<PermissionReconciliation> {
  const result: PermissionReconciliation = {
    added: [],
    updated: 0,
    deprecated: [],
    revived: [],
    orphanedGrants: [],
  };

  const existing = await prisma.permission.findMany({
    select: {
      id: true,
      key: true,
      module: true,
      description: true,
      isSensitive: true,
      deprecatedAt: true,
    },
  });
  const byKey = new Map(existing.map((p) => [p.key, p]));
  const manifestKeys = new Set(PERMISSION_MANIFEST.map((p) => p.key));

  // --- Forward: everything the manifest declares.
  for (const definition of PERMISSION_MANIFEST) {
    const current = byKey.get(definition.key);

    if (!current) {
      await prisma.permission.create({
        data: {
          key: definition.key,
          module: definition.module,
          description: definition.description,
          isSensitive: definition.isSensitive,
        },
      });
      result.added.push(definition.key);
      continue;
    }

    // A key that came back after being dropped. Un-deprecate it rather than leaving a
    // shadowed row that the catalogue claims exists and the database refuses to grant.
    if (current.deprecatedAt !== null) {
      result.revived.push(definition.key);
    }

    const drifted =
      current.module !== definition.module ||
      current.description !== definition.description ||
      current.isSensitive !== definition.isSensitive ||
      current.deprecatedAt !== null;

    if (drifted) {
      await prisma.permission.update({
        where: { key: definition.key },
        data: {
          module: definition.module,
          description: definition.description,
          isSensitive: definition.isSensitive,
          deprecatedAt: null,
        },
      });
      result.updated += 1;
    }
  }

  // --- Reverse: rows the manifest no longer declares.
  const removed = existing.filter((p) => !manifestKeys.has(p.key) && p.deprecatedAt === null);

  for (const permission of removed) {
    // Name the roles before deprecating, so the warning can say who is affected. This is the
    // part 7.3.5 asks for explicitly, and the reason a soft delete beats a hard one: the
    // grants stay visible for an access review instead of disappearing with the row.
    const grants = await prisma.rolePermission.findMany({
      where: { permissionId: permission.id },
      select: { role: { select: { name: true } } },
    });
    const roles = grants.map((g) => g.role.name).sort();

    await prisma.permission.update({
      where: { id: permission.id },
      data: { deprecatedAt: new Date() },
    });
    result.deprecated.push(permission.key);

    if (roles.length > 0) {
      result.orphanedGrants.push({ key: permission.key, roles });
      console.warn(
        `  ⚠ Permission "${permission.key}" was removed from the manifest but is still ` +
          `granted to ${roles.length} role(s): ${roles.join(', ')}. ` +
          `The row is soft-deleted, not dropped, and those grants remain visible for review.`,
      );
    }
  }

  return result;
}

/** Console summary. Kept beside the reconciliation so the two cannot describe it differently. */
export function reportReconciliation(result: PermissionReconciliation): void {
  console.log(
    `Permission manifest v${PERMISSION_MANIFEST_VERSION} reconciled: ` +
      `${PERMISSION_MANIFEST.length} in catalogue, ${result.added.length} added, ` +
      `${result.updated} updated, ${result.deprecated.length} deprecated, ` +
      `${result.revived.length} revived`,
  );
  if (result.orphanedGrants.length > 0) {
    console.warn(
      `  ⚠ ${result.orphanedGrants.length} deprecated permission(s) still carry role grants — see above.`,
    );
  }
}
