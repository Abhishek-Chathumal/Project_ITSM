# ADR-0020: The permission catalogue is a versioned manifest, reconciled — not a seed list

**Status:** Accepted
**Implements:** Constitution 7.3.5 (seeding), 7.3.1 (`Permission` columns) · Functional Reference **I2** (the catalogue) · Amendment A-001 via [ADR-0017](0017-adopt-amendments-a001-a006.md)
**Amends:** [ADR-0006](0006-rbac-permission-guard-mechanism.md) — its guard mechanism stands; the ten illustrative keys it seeded do not
**Relates to:** Phase 0 Slice 0a

## Context

Phase 0 shipped ten permission keys hand-listed in `seed.ts`. They were illustrative, and
ADR-0017 recorded that Amendment A-001 replaces them with the ~174-entry catalogue in
Functional Reference I2, seeded from a **versioned manifest checked into the repo**.

The constitution is specific about why the manifest is not simply a longer list (7.3.5):

> Each release migration reconciles the manifest with the `Permission` table: **new
> permissions are added disabled-by-default for existing custom roles** (so an upgrade never
> silently widens anyone's access), and removed permissions are soft-deleted with a warning
> naming the roles that referenced them.

Both halves guard the same failure — **an upgrade changing what someone can do without
anyone deciding it should** — and they fail in opposite directions. A new permission that
arrives pre-granted widens access silently. A removed permission that is hard-deleted takes
its grants with it, so an access review later cannot tell a revoked grant from one that was
never made. Only one of those is loud, which is why the quiet one gets the warning.

## Decision

### 1. One source object; `PERMISSIONS` and the manifest are both derived from it

`packages/shared/src/permissions.ts` holds a single `CATALOGUE` object. From it:

- `PERMISSIONS` — the key lookup `@RequirePermission(...)` and the frontend use, with literal
  types preserved through a mapped type, so a typo in a guard is a compile error rather than
  a permanent 403.
- `PERMISSION_MANIFEST` — the seedable list the reconciliation walks.

A second hand-maintained list is a second thing to forget to update, and the two drifting
apart would mean a guard referencing a key that was never seeded — which fails closed, but
only at runtime and only on the route nobody tested.

### 2. Reconciliation lives in `src/`, not `prisma/`

`common/permissions/permission-reconciler.ts`. It began in `prisma/` beside the seed and was
moved, for a concrete reason: jest's `rootDir` is `src`, so a spec next to it **never ran**.
That was the signal — this is application logic with rules worth testing, not seed data. The
seed script calls it; `prisma/` keeps the reference data.

### 3. "Disabled by default" needs no disable step

A `Permission` row with no `RolePermission` referencing it confers nothing. So the
reconciliation creates permissions and **grants them to nobody**, and that is the whole of
7.3.5's requirement — there is no separate flag to set and therefore none to forget. Custom
roles an admin built are never touched; only system roles have their grants re-asserted, and
that comes from their own definition.

### 4. Removal is a soft delete that names names

`Permission.deprecatedAt` marks it. The roles holding it are read **before** the row is
marked, so the warning can list them, and the grants themselves are left in place so an
access review still sees them. A key that returns to the manifest is revived rather than left
shadowed — otherwise the catalogue claims a permission exists while the database refuses to
grant it, a disagreement nothing would surface.

### 5. `module`, `description` and `isSensitive` are re-asserted on every seed

Unlike `Status.name`, which the ticketing seed deliberately preserves because an admin may
have renamed it, these are statements the catalogue makes. `isSensitive` in particular drives
step-up MFA (Ref I5) — if it could be edited in the database, MFA would silently stop
applying to a permission that still needs it.

### 6. Admin no longer gets everything

The old seed granted Admin every key it defined. Against ten illustrative keys that was a
defensible shortcut. Against 174 it would hand one role every destructive and
code-execution permission in the system — including `user.permission.grant`, which Ref I2.5
calls one of "the two most powerful permissions in the system" — **before the privilege
safety rules of 5.3a / Ref I8 exist to constrain it**. Admin now gets the administrative
surface that is actually built, and nothing guarding a feature that does not exist yet.

The full answer is Slice 0d: twelve permission-locked roles composed from permission sets,
each grant carrying a scope. These grants are interim and marked as such.

## Alternatives rejected

- **Keep the list in `seed.ts`, just longer.** What 7.3.5 forbids, and the reason is the
  reconciliation, not the length: a seed script can create rows but has nowhere to express
  "this key used to exist".
- **Hard-delete removed permissions.** Simpler, and it destroys the audit trail exactly when
  someone is trying to reconstruct who had what.
- **Generate `PERMISSIONS` constants by hand alongside the manifest.** Conventional, and
  invites the two to disagree. The mapped-type derivation gives the same editor experience
  with no second list.
- **A `permission.view` key for the catalogue screen.** The old seed had one. Ref I2.5 folds
  it into `role.view` ("View roles and the permission catalogue"), and inventing keys outside
  a catalogue described as "the complete required set" would start exactly the drift the
  manifest exists to prevent.
- **Splitting `org.department.manage` into view/manage.** The department controller has GET
  routes that now require a `.manage` key. Ref I2.8 provides no view-level key, and adding
  one is a change to the catalogue, not to this slice.

## Consequences

- **Every previously seeded key is deprecated on upgrade, and this is the designed path
  working, not a fault.** All ten (`role.manage`, `audit.view`, `ticket.view.own`, …) predate
  A-001 and appear nowhere in I2. Verified against a database that already held them: 174
  added, 10 deprecated, each warning naming the roles that held it.
- **The migration adds `module` in three steps, not one.** It is `NOT NULL` with no default
  and the table is non-empty in every existing environment, so it is added with a temporary
  default, backfilled with a `'legacy'` sentinel, and the default dropped. The sentinel is
  deliberate: those rows are about to be deprecated, and inventing a plausible module for
  them would only make the deprecation harder to spot.
- **Guards moved from class-level to per-route on `roles` and `users`.** Ref I2.5 separates
  view / create / edit / delete, and one key on a controller that both reads and deletes
  cannot express that. `departments` and `org-settings` stay class-level because the
  catalogue gives them one key each.
- **Frontend keys moved with them.** Still UX only — the 403s below come from the server.
- **`prisma generate` before `nest build` bit immediately.** Changing `schema.prisma` and
  running `typecheck` produced seven "property does not exist" errors until the client was
  regenerated. Exactly the ordering ADR-0019 documents, encountered the first time it could
  be.
- **Verified by running it, not by tests passing.** From an empty database: migrations apply,
  174 seed, a second run is a no-op. Against a populated one: 10 deprecate with warnings.
  Both Docker stacks rebuilt from clean volumes — the production image has the columns and an
  empty catalogue (it never seeds), the dev stack reconciles in-container to 174 live /
  63 sensitive / 13 modules and proxies through Vite.
- **The guard was proven in both directions against real HTTP**, which matters more than the
  unit tests here: a zero-permission Requester receives 403 on `/roles`, `/users`,
  `/audit-logs` and `/permissions`, and 200 on `/auth/me`, while Admin's session carries
  exactly its eleven granted keys.
- **`DEFAULT_ROLES` is still the pre-A-001 six.** Twelve permission-locked roles are Slice
  0d; the catalogue has to exist before roles can be composed from it.
- **Scope is still not enforced anywhere.** This slice delivers the keys; `RolePermission`
  has no `scope` column yet (Slice 0b) and `applyScope()` does not exist (Slice 0c). Holding
  a key remains the whole of an authorization decision until then — which is precisely the
  gap A-001 exists to close, and the reason Slice 3 must not start yet.
