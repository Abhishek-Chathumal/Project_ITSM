# Phase plan

What each phase delivers, broken into slices you can actually start. Derived from the
constitution's Part XII roadmap; **the constitution remains the source of truth** — this
document sequences it, it does not replace it.

Companion docs: [`PROJECT_STATE.md`](PROJECT_STATE.md) (what exists right now),
[`WORKFLOW.md`](WORKFLOW.md) (how to work), [`adr/`](adr/) (why).

---

## How to use this

A session starting new work should be able to say _"do Phase 1, slice 3"_ and know exactly
what that means. Each slice is scoped to be **independently shippable and verifiable** — a
PR of its own, green CI, testable in the running app.

Later phases are deliberately less detailed than Phase 1. Specifying Phase 4 now would be
guessing; it gets detailed when we reach it, informed by what we learn earlier. Adding
detail to an upcoming phase is itself a valid piece of work.

---

## Standing rules — every phase, every slice

These are not optional and apply without being restated:

1. **Security first.** New public endpoint → rate limit it. New capability → a permission
   key guarding it, server-side. New user input → validated. New secret → env var, never
   committed. Before any hosting milestone, run a dependency audit.
2. **Authorization uses the existing mechanism.** `@RequirePermission(...)` +
   `PermissionGuard`. New capabilities are new seeded `Permission` rows — never new guard
   logic, never a hardcoded role check.
3. **Audit every state change** via `AuditService.record(...)`. Append-only, always.
4. **One DTO shape per concept**, shared from `packages/shared`.
5. **An ADR for every architectural decision or deviation** (constitution Part XIV).
6. **Verify by running it**, not just by tests passing. The bugs that hurt in Phase 0 were
   all runtime-only.
7. **Slices ship green.** Lint, typecheck, tests, build, both smoke jobs.

---

## Phase 0 — Foundation ✅ COMPLETE

Repo scaffold, CI/CD, Docker Compose, migrations, local auth, RBAC skeleton, audit log.
Merged in PRs #1–#5. Details in [`PROJECT_STATE.md`](PROJECT_STATE.md) §2.

---

## Phase 1 — MVP: Incident + Service Request ticketing

**Constitution:** Part II §2.1, §2.2, §2.8, §2.10 · Part VII (data model) · Part IX §9.3–9.4
(wireframes) · Part XII (Phase 1 row)

**Goal:** a person can raise a ticket, a technician can work it to resolution, and both can
see it. This is the phase that makes the product real.

### Slice 1 — Dependency & security triage

_Do this first, before adding surface area._

`npm audit` reports ~31 advisories (1 critical, 9 high) in the Phase 0 tree. Triage: patch
what's safely patchable, document anything deferred with a reason. Add a CI audit step if
it can be made non-flaky.

**Done when:** critical/high advisories are resolved or explicitly accepted in
`PROJECT_STATE.md` §4 with justification.

### Slice 2 — Ticket data model

Entities per Part VII: `Ticket`, `TicketType`, `Category` (self-referencing for
Category > Subcategory > Item), `Status` + `StatusWorkflow`, `Priority`, `Comment`.

Key design points from the constitution:

- **One `Ticket` table** for both Incidents and Service Requests, distinguished by
  `type` (§2.1 — "unified ticket object").
- Priority is **derived from Impact × Urgency**, not freely chosen (§2.1).
- Status workflows are **per ticket type**, configurable — not one global enum (§3.3).

**Done when:** migration applies cleanly, seed creates the default Incident workflow
(`New → Open → In Progress → Pending (Customer) → Pending (Vendor) → Resolved → Closed →
Reopened`), a starter category tree, and the priority matrix.

### Slice 3 — Ticket API + RBAC

CRUD + list/filter endpoints under `/api/v1/tickets`, each guarded by a permission key.

New permission keys (extending the pattern in `packages/shared/src/permissions.ts`;
`ticket.view.own` and `ticket.edit.assigned` already exist as forward declarations):
`ticket.create`, `ticket.view.team`, `ticket.view.all`, `ticket.edit.team`,
`ticket.assign`, `ticket.comment.internal`, `ticket.delete`.

Scoping matters here: "view team" must actually resolve to _the caller's_ team
(constitution §5.3 — ABAC narrowing on top of RBAC). Don't let a team-scoped permission
leak the whole table.

**Done when:** a Requester sees only their own tickets, a Technician sees their team's, and
this is proven by an integration test — not just by inspection.

### Slice 4 — Status transitions

Transition rules: which roles may move A → B, and which fields are mandatory on a given
transition (e.g. Resolution Notes required to reach Resolved) — constitution §3.3.

**Done when:** an invalid transition is rejected by the API with a clear error, and the
required-field rule is enforced server-side.

### Slice 5 — Comments & attachments

Threaded replies with an internal/public distinction (§2.1). Attachments behind the
`StorageProvider` abstraction the constitution mandates (§6.6) — local disk now,
S3-compatible later, without touching business logic.

**Security:** validate file type and size, never trust the client-supplied filename, and
serve downloads through an authorization check rather than a guessable path.

**Done when:** a file uploaded by one user cannot be fetched by a user who can't see the
ticket.

### Slice 6 — Agent console UI

Ticket list with filters + ticket detail. Wireframe in constitution §9.4.

### Slice 7 — Requester self-service UI

"My Tickets" list + detail, raise-a-ticket form, comment ability. Wireframe §9.3.
Constitution Article VI: raising a ticket must take a novice **under 60 seconds**.

### Slice 8 — Basic email notifications

`NotificationTemplate` rows with merge fields, dispatched on ticket created / assigned /
commented / resolved (§2.10). Admin-editable subject and body — Article II.

**Done when:** templates are data, not hardcoded strings, and a failed send is logged
visibly (Article VII) rather than silently dropped.

### Slice 9 — Test coverage

Constitution Part XIII: integration tests against a real containerized Postgres including
RBAC enforcement, plus one E2E journey (raise → assign → resolve) in Playwright.

### Phase 1 exit criteria

- [ ] A Requester can raise a ticket and track it end to end in the browser
- [ ] A Technician can pick it up, comment, and resolve it
- [ ] RBAC scoping is proven by tests, not assumed
- [ ] Attachments work and are access-controlled
- [ ] Notifications fire and failures are visible
- [ ] Both smoke jobs green; `PROJECT_STATE.md` updated

---

## Phase 2 — Asset/CMDB, SLA, Knowledge, Catalog, CSAT

**Constitution:** §2.5, §2.6, §2.7, §2.2 (catalog), §2.11

- **Asset & CMDB** — `Asset`, `AssetType` with custom attributes, ticket↔asset linking,
  CSV import, basic asset↔asset relationship graph.
- **SLA/OLA engine** — `SLAPolicy`, `BusinessCalendar`, first-response and resolution
  timers with warning/breach states, clock pausing on Pending statuses. This is the most
  logic-heavy piece in the phase; the constitution calls out SLA calculation as a prime
  target for unit tests (Part XIII).
- **Knowledge Base** — articles with visibility levels, full-text search (Postgres
  `tsvector` per §6.5), deflection suggestions while typing a ticket.
- **Service Catalog** — catalog items with dynamic forms, fulfillment tasks.
- **CSAT** — survey on close, feeding reporting.

**Exit:** SLA timers demonstrably pause/resume correctly across business hours; KB search
returns sensible results; a catalog request produces a ticket with its form data attached.

---

## Phase 3 — Automation, custom fields, reporting, approvals, SSO/MFA

**Constitution:** Part III (customization), Part IV (automation engine), §3.5, §4.4, §5.1, §5.4

- **Automation engine** — Trigger → Condition → Action, evaluated off the request cycle via
  a Redis-backed queue (Part IV.1). Rule evaluation is pure-function testable; the
  constitution requires a test per Trigger/Condition/Action combination in seed data.
- **Custom fields** — EAV `CustomField`/`CustomFieldValue` so admins add fields without
  migrations (§3.1).
- **Report/dashboard builder** — UI-driven, no SQL for the user (§3.5).
- **Approval workflows** — generic `ApprovalRequest` supporting sequential and parallel
  chains (§4.4).
- **SSO/MFA** — SAML/OIDC/LDAP as pluggable providers; TOTP MFA enforceable per role.
  The Phase 0 auth design already anticipates this: `passwordHash` is nullable, `mfaSecret`
  exists, and SSO plugs into the same session issuance path (ADR-0003).

**Security note:** this phase touches authentication directly. Expect a security review
slice of its own before merge.

---

## Phase 4 — Problem, Change, integrations

**Constitution:** §2.3, §2.4, §4.8

Problem Management with KEDB and RCA structure; Change Enablement with Standard/Normal/
Emergency types, CAB approval, and the change calendar; inbound/outbound webhooks;
email-to-ticket ingestion.

**Security note:** inbound webhooks and an email ingress are externally reachable
attack surface. Signed payloads (HMAC per §8.3), strict validation, rate limiting.

---

## Phase 5 — PWA, packaging, scale

**Constitution:** §6.7, §10.3, Part XI

PWA polish and push notifications; optional Tauri desktop wrapper; optional React Native
app; OpenSearch swap-in if Postgres FTS stops scaling; advanced compliance reporting.

---

## Maintainer-added scope

Raised in conversation, beyond the original constitution. Each needs an ADR when built,
because the constitution assumed **admin-only user creation**.

| Item                                          | Lands in                             | Notes                                                             |
| --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Additional login options / login flow changes | Phase 3 (with SSO)                   | Or earlier if needed standalone                                   |
| Self-service account creation                 | Phase 1–2                            | Reverses a deliberate Phase 0 decision → **ADR required**         |
| Bulk user import                              | Phase 2                              | Pairs naturally with the CSV asset import                         |
| Account activation & email verification       | With self-service creation           | Signed single-use tokens, same pattern as §4.4 approval links     |
| Admin-defined custom permissions              | Phase 3 (with custom fields)         | ⚠️ **Design tension — see below**                                 |
| Cloud hosting                                 | After Phase 2, once genuinely usable | Full security pass first: secrets management, TLS, backups, audit |

### The custom-permissions problem — read before attempting

Permission keys are currently referenced **in code** (`@RequirePermission(PERMISSIONS.X)`).
An admin can invent a new key, but nothing in the codebase reads it, so it gates nothing.
Truly admin-defined permissions therefore can't work the way roles do.

Realistic options, to be weighed when we get there:

1. **Scope custom permissions to data, not routes** — e.g. per-category or per-department
   visibility rules evaluated at query time. Admin-configurable and genuinely enforceable.
2. **Custom permissions gate custom things** — admin-created fields, forms, and workflow
   transitions, which are already data-driven.
3. **Ship a richer fixed catalog** and let admins compose roles freely from it. Less
   flexible, zero new machinery.

Bring options to the maintainer rather than picking one unilaterally — this is an
architectural decision, and Article II ("configuration over code") pulls against the
practical limits of route-level guards.

---

## Definition of done — any slice

- [ ] Works when actually run, not just when tests pass
- [ ] Permission-guarded server-side; scoping proven by a test
- [ ] State changes audited
- [ ] Shared DTOs in `packages/shared`, one shape per concept
- [ ] ADR written if an architectural decision was made
- [ ] `lint`, `typecheck`, `test`, `build`, `format:check`, `smoke`, `smoke-dev` all green
- [ ] `PROJECT_STATE.md` updated (`/update-state`)
