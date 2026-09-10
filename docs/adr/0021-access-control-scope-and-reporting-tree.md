# ADR-0021: Scope on the grant, and a reporting tree that rejects cycles

**Status:** Accepted
**Implements:** Constitution 7.3.1 (tables), 7.3.2 (indexes and constraints) · Functional Reference **I3.1** (scope values), **I3.2** (hierarchy), **I3.3** (custom scopes), **I1.3** (permission sets) · Amendment A-001 via [ADR-0017](0017-adopt-amendments-a001-a006.md)
**Builds on:** [ADR-0018](0018-request-model-reconciled-with-b2-b3.md) (the tree helper), [ADR-0020](0020-permission-manifest.md) (the catalogue)
**Relates to:** Phase 0 Slice 0b — **the additive half**

## Context

ADR-0020 delivered 174 permission keys. Holding a key is still the whole of an authorization
decision, because nothing records _which records_ a grant reaches. This slice adds that, plus
the reporting tree `hierarchy` scope needs, so `applyScope()` (Slice 0c) can be written
against a schema that can express all seven scope values.

**Slice 0b is deliberately split, and this is the additive half.** The other half — replacing
`User.roleId` with a `UserRole` join so a user may hold several roles — changes
`SessionUserDto`, which Article V singles out as having _"diverged once and crashed the
frontend"_. Landing a breaking DTO change alongside four new tables would make one diff carry
two unrelated risks. Everything here is additive: nothing that worked before behaves
differently after.

## Decision

### 1. Scope is a column on the grant, and it has no default

`RolePermission.scope`, per constitution 7.3.1's _"Scope lives here, not on Role"_. The
consequence worth stating is the one that motivates it: the same role can hold `request.view`
at `department` and `request.edit` at `own` — see everything my department raised, change only
what I own.

**No default value, deliberately.** Whichever were chosen would be wrong half the time: `all`
widens silently, and `own` breaks every administrative permission that has no records to scope
by. A grant must say what it reaches. The compiler enforced this immediately — adding the
column broke `roles.service.ts`, which was assigning permissions without one.

### 2. `Scope` is an enum, unlike almost everything else here

Article II says configuration over code, and statuses, priorities and categories are all rows
for exactly that reason. Scope is not, because **each value names a predicate `applyScope()`
has to be able to build**. An admin inventing an eighth value would be naming a filter no code
can express — the failure would be a scope that silently matches nothing, or everything.

What admins _do_ author is a `CustomScope`: a named, reusable JSONB condition set (Ref I3.3),
which is what the `custom` member points at.

### 3. `CustomScope` exists now; evaluating it does not

A-001 puts custom scopes in Phase 3. But 7.3.1 puts `RolePermission.custom_scope_id` in Phase
0, and ADR-0016 established that a column pointing at a table which does not exist can carry
no foreign key and no meaning. Creating the table now — ten columns, no behaviour — resolves
that tension in the direction of a real constraint.

**`applyScope()` must therefore treat `custom` as unimplemented and fail closed.** Which is the
general rule anyway: a `default:` branch returning an unfiltered query turns "unimplemented"
into `all`.

### 4. The reporting tree reuses the tree helper, and rejects rather than detects

`User.managerId` + `User.reportingPath`, maintained by `ReportingTreeService`. Two points:

**It is not a fourth tree implementation.** Category, Department and Location already share
`common/tree/materialized-path.ts` (Ref B4's "implement once"), and the reporting tree is the
fourth consumer Ref I3.2 anticipated. That means the `/1/7/` vs `/1/70/` prefix collision is
already solved here rather than being a fourth chance to reintroduce it.

**A cycle is rejected at assignment.** Constitution 7.3.2 is explicit — _"Reject the
assignment; do not merely detect it later"_ — and the reason is that a recorded cycle makes
subtree resolution non-terminating. `setManager()` runs the cycle check before writing
anything and throws a 400; the whole subtree is rewritten in one transaction, because a
partial rewrite leaves descendants claiming an ancestry they no longer have, and
`hierarchy` scope would then return a wrong row set rather than an error.

The depth ceiling (20) is not in the specification and is deliberate anyway: `hierarchy` scope
walks this path on the hot path of every scoped query, and an import that chains everyone to
their predecessor would otherwise produce paths long enough to matter.

### 5. Predefined roles became permission-locked, here rather than in Slice 0d

Ref G3.4 requires it and `Role.isSystemRole` already existed, but nothing enforced it.
`replacePermissions()` now refuses on a system role. It belongs in this change because this
is the change that made role permissions richer — adding scope to an endpoint that could
still rewrite the built-in roles would have widened the blast radius of the very lockout
guard G3.4 describes.

### 6. The audit diff records scope, not just the key

Widening `request.view` from `own` to `all` changes what a role reaches **without changing
which keys it holds**. A diff of keys alone would record that as no change at all — which is
precisely the change an access review most needs to see.

## Alternatives rejected

- **A default of `all` on `scope`.** One line, no backfill, and every future grant that forgets
  to state a scope silently becomes unrestricted.
- **A default of `own`.** Fails closed, which sounds right, and breaks `org.settings.manage`
  and every other permission with no per-record ownership.
- **Scope as rows, for Article II consistency.** Consistent with Status and Priority, and
  wrong for the same reason `DisplayTone` is an enum (ADR-0016): the value set is defined by
  what code can render — here, by what `applyScope()` can build.
- **Defer `CustomScope` to Phase 3 and leave `custom_scope_id` as a bare string.** Matches
  A-001's phasing and leaves an unconstrained column that can hold anything.
- **Detect cycles with a periodic sweep.** Cheaper per write, and 7.3.2 forbids it by name.
- **A recursive CTE instead of a materialized path.** No derived data to maintain, and it puts
  a recursive query on the hot path of every hierarchy-scoped list — which is the trade Ref
  I3.2 explicitly makes in the other direction.

## Consequences

- **`PATCH /roles/:id/permissions` changes shape.** `permissionKeys: string[]` becomes
  `permissions: [{ key, scope, scopeDepth?, customScopeId? }]`. No client uses it yet — the
  admin UI is Phase 3 — but it is an API change, and the endpoint now also rejects duplicate
  keys, deprecated keys, and `custom` without a `customScopeId`.
- **Deprecated permissions cannot be newly granted.** The lookup filters on
  `deprecatedAt: null`, so a key the manifest retired stays visible for review (ADR-0020) but
  is not re-grantable.
- **The migration backfills `scope = 'all'` for the 13 existing grants, and this is not a
  widening.** Nothing enforces scope yet — `applyScope()` is Slice 0c — so every query already
  returns every row the caller can see. `all` records what is actually in force. The narrower
  scopes arrive with the composed roles in Slice 0d.
- **`ReportingTreeService` is registered but nothing calls `setManager()` yet.** The
  users API does not expose a manager field; that arrives with the user-administration screens.
  It is exported and tested now because Slice 0c depends on the paths being correct.
- **Verified against a real Postgres, not only against fakes.** All seven scope values
  round-trip through the enum; `scopeDepth` stores `1` and null; a four-person reporting tree
  returns the right subtree from two different roots and excludes an unrelated one; the
  `reporting_path` index is confirmed to carry `text_pattern_ops`; permission sets and custom
  scopes link up. 92 unit tests, including cycle rejection and whole-subtree rewriting.
- **Still missing, and still the reason Slice 3 must wait:** `applyScope()` itself (0c), and
  multi-role users (the other half of 0b). Holding a key remains the whole of an authorization
  decision until 0c lands.
