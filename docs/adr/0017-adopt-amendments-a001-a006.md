# ADR-0017: Adopt Amendments A-001 … A-006, and re-open Phase 0

**Status:** Accepted
**Amends:** [ADR-0006](0006-rbac-permission-guard-mechanism.md) (the two-layer role→permission model)
**Relates to:** Constitution Part XIV (Governance), Part V (rewritten), 7.3 and 8.3 (added), Part XII (rephased) · Functional Reference Part I, Part Q

## Context

Two documents arrived together: a revised `Support_Portal_Development_Constitution.md`, and a
new companion, `Support_Portal_Functional_Reference.md`. The companion is not commentary —
its **Part Q formally amends the constitution**, and the constitution's own preamble now names
it as the exception to "the constitution governs where the two differ."

Six amendments are in force. Five are minor and mostly forward-looking. **A-001 is MAJOR and
invalidates work already merged**, which is the reason this ADR exists rather than a commit
message.

## Decision

Adopt all six. Record here what that costs, because the honest accounting is not obvious from
the diff.

### A-001 replaces the model ADR-0006 built

ADR-0006 established a two-layer model: a `Role` bundles `Permission` rows through
`RolePermission`, and a single `@RequirePermission(key)` decorator checks the key server-side.
That mechanism was correct against the constitution as it then stood. A-001 supersedes it with
three layers:

```
EFFECTIVE = (union of ROLE permissions)
          + (user-level GRANTS)
          − (user-level REVOCATIONS)     ← revocation always wins
          ⨯ SCOPE (own | group | department | location | hierarchy | custom | all)
```

**What survives:** `SessionAuthGuard`, `PermissionGuard`, `@RequirePermission`, the
`PERMISSIONS` constants in `packages/shared`, and the rule that the frontend check is UX only.
The guard still answers "does this caller hold this key?" and is still entity-agnostic.

**What does not:** the assumption that holding a key is the whole answer. Scope is now attached
**per permission, not per role**, so `RolePermission` carries `scope` and the guard's yes/no is
only the first half of an authorization decision. The second half is a data-layer concern.

### Scope is enforced once, in the data layer

Constitution 5.2 is explicit, and it is the single most important line for our codebase:

> Scope is enforced in the **data layer, once**, via a single `applyScope(query, user, permission)`
> helper. Enforcing scope per endpoint guarantees an endpoint eventually gets missed — and the
> miss is a data leak, not a visible bug.

This is a direct instruction about how to build, and it forbids the shape Slice 3 was heading
towards (see below).

### Phase 0 is no longer complete

Part XII was rephased because scope enforcement and the reporting hierarchy are load-bearing:
retrofitting them means auditing every query in the system. Phase 0 now additionally requires
the permission catalogue seeded **from a versioned manifest**, the
`Permission`/`PermissionSet`/`Role`/`UserRole`/`RolePermission` tables, the `applyScope()`
helper, and `User.manager_id` + `reporting_path` with cycle protection.

Measured against `schema.prisma` as merged, the gap is:

| Required by 7.3.1                                                   | Status                                     |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `Permission` + `module`, `is_sensitive`                             | partial — has `key`, `description` only    |
| `PermissionSet`, `PermissionSetItem`, `RolePermissionSet`           | **missing**                                |
| `RolePermission` + `scope`, `scope_depth`, `custom_scope_id`        | partial — join columns only                |
| `UserRole` (a user may hold several roles)                          | **missing** — `User.roleId` is a single FK |
| `User.manager_id`, `reporting_path` + cycle protection              | **missing**                                |
| `applyScope()` helper                                               | **missing**                                |
| `StatusTransition` with `allowed_permissions[]`                     | **missing** (was already Slice 4)          |
| `UserPermissionOverride`, `CustomScope`, `EffectivePermissionCache` | **missing** — Phase 3 per A-001            |
| `PermissionDelegation`                                              | **missing** — `[Defer]` per A-006          |
| Append-only `AuditLog`                                              | ✅ done                                    |

So "Phase 0 complete" is withdrawn. The foundation is sound; it is now measured against a
larger requirement.

### The permission catalogue changes shape, and the Slice 3 groundwork with it

The catalogue moves from ~10 illustrative keys to the ~150-entry catalogue in Functional
Reference I2, named `module.action[.qualifier]` and seeded from a manifest rather than
hand-maintained in `seed.ts`.

Concretely, **the keys committed on `claude/ticket-api-rbac` are superseded before they were
ever used.** That branch introduced `ticket.view.own`, `ticket.view.team` and
`ticket.view.all` as three separate keys, with `view.own` designed as a "floor" the other two
widened. Under A-001 that is one permission — **`request.view`** — carrying a scope of `own`,
`group`, `department` or `all`. The module prefix is `request.`, not `ticket.`, per I2.1.

The reasoning behind the floor design was sound _for the old model_: `@RequirePermission` takes
one key, so a union of view rights had to be expressed as a baseline key plus wideners. A-001
removes the problem rather than solving it — scope is a column, not a key. The `ticket.edit.all`
key added in the same commit is likewise dissolved: it becomes `request.edit` at `all` scope.

That branch should be **rebuilt, not rebased**.

## Alternatives rejected

- **Adopt A-001 but defer scope to Phase 3.** Rejected by the amendment itself, and for the
  reason it gives: scope retrofitted onto built modules means auditing every query. Phase 1
  requires "scope enforcement live on every query."
- **Keep `ticket.*` keys and map them to the new catalogue later.** A rename across seed data,
  guards, tests and the frontend is cheap now and expensive after Slice 3 ships routes.
- **Treat the Functional Reference as advisory.** Its Part Q is constitutionally binding by the
  constitution's own preamble. Treating it as advisory would mean building the superseded model
  knowingly.

## Consequences

- **`PROJECT_STATE.md` no longer claims Phase 0 is complete**, and `PHASE_PLAN.md` is rephased
  against the new Part XII. Slice 3 is rewritten around `request.*` and `applyScope()`.
- **`docs/Support_Portal_Functional_Reference.md` joins the constitution as a document to read
  before designing a feature.** It is where field-level, algorithmic and administrative detail
  now lives — the priority matrix's exact behaviour, the SLA calculation, the automation
  trigger catalogue, the permission catalogue.
- **ADR-0006 is amended, not revoked.** Its mechanism stands; its model does not. The header of
  that ADR now says so, so nobody reads it as current in isolation.
- **The privilege safety rules (5.3a / I8) become mandatory acceptance criteria** for any work
  touching permissions: no self-escalation, no privilege amplification, last-administrator
  protection, justification on every override, forced logout on permission change, step-up MFA,
  periodic access review. A granular grant/revoke system without them is, in the constitution's
  own words, more dangerous than the fixed model it replaces.
- **A-002 pulls automation observability into the same phase as the automation engine** —
  execution logs, dry-run, auto-disable, cascade-depth protection. Not a later slice.
- **A-005 narrows a Phase 0 assumption**: deterministic, CPU-cheap intelligence (duplicate
  detection, knowledge deflection, priority-weighted routing) is now _in_ scope. The standing
  ceiling is no model training, no vector database, no GPU, no per-request LLM call in the hot
  path.
- **Nothing already built is wrong.** Auth, sessions, CSRF, the audit trail, the ticket data
  model and the guard mechanism all stand. What changes is that the access-control model they
  serve is larger than the one they were built against.
