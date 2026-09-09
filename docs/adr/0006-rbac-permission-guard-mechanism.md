# ADR-0006: RBAC via a single entity-agnostic PermissionGuard

**Status:** Accepted, but **amended by [ADR-0017](0017-adopt-amendments-a001-a006.md)** — do not read this in isolation.
**Relates to:** Constitution Part V.2, Article II (Configuration Over Code), Article III (Least Privilege)

> **What changed.** Amendment A-001 replaced the two-layer role→permission model this ADR
> describes with a three-layer one: roles, per-user grants/revocations, and a **scope attached
> per permission**. The _mechanism_ below still stands — `SessionAuthGuard`, `PermissionGuard`,
> `@RequirePermission`, and shared `PERMISSIONS` constants are unchanged. What no longer holds
> is the assumption that holding a key is the whole authorization answer: scope is enforced
> separately, once, in the data layer via `applyScope()`. See ADR-0017.

## Context

Part V.2 requires granular, resource-scoped permissions (`ticket.view.own`, `role.manage`, etc.) checked server-side on every API call, with default roles that are "editable/cloneable, never hardcoded into logic." Article III requires new roles to start with zero permissions. Every future module (Tickets, Assets, Changes, Automation…) needs the same enforcement without reinventing it.

## Decision

A single reusable mechanism, established once in Phase 0 and never modified by later modules:

- **`Permission`** rows are the catalog of capability keys (seeded, e.g. `role.manage`), **`Role`** rows are named bundles of permissions via the `RolePermission` join table — all plain data, editable through the API, not enum/switch statements in code.
- **`@RequirePermission(key)`** decorator (a thin `SetMetadata` wrapper) marks a route with the single permission key it requires.
- **`PermissionGuard`** (a global `APP_GUARD`) reads that metadata and checks it against `request.currentUser.permissions` — a list already populated by `SessionAuthGuard` from the caller's role. It knows nothing about tickets, assets, or any other domain concept; it only ever compares string keys.
- **`SessionAuthGuard`** (also a global `APP_GUARD`, registered first) is the authentication gate — fail-closed by default, with `@Public()` as the explicit opt-out for routes like `/auth/login` and `/health`.

The permission keys themselves live in `packages/shared` (`PERMISSIONS` const), so the same string is the single source of truth for the server-side check and the frontend's UX-only conditional rendering.

## Consequences

- Adding a Phase 1+ capability (e.g. ticket editing) is: seed a new `Permission` row, add `@RequirePermission(PERMISSIONS.TICKET_EDIT_ASSIGNED)` to the relevant controller method, and reference the same constant from the frontend nav/buttons — no new guard code, ever.
- Phase 0's seed script proves Article III directly: Requester/Technician/Team Lead/Change Manager roles are seeded with **zero** granted permissions (only Admin and Auditor get anything), so "new roles start with zero permissions" is a verifiable data fact, not a claim.
- The frontend's permission checks (`useAuth().isAllowed(key)`) are explicitly documented as UX-only in code — every controller re-checks independently, so hiding a button never substitutes for the server-side guard.
