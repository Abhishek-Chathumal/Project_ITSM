# ADR-0016: The ticket data model — configurable rows, with the few enums code must branch on

**Status:** Accepted
**Relates to:** Constitution Article II (Configuration Over Code), Part II §2.1/§2.2, Part III §3.3, Part VII (Data Model), Part IX §9.4 · Supersedes nothing · Builds on [ADR-0013](0013-in-house-ui-component-layer.md)

## Context

Phase 1 Slice 2 lays down the tables every later slice writes against: tickets, their
classification, and their lifecycle. Two constitutional pulls act against each other here.

**Article II says configuration over code.** Statuses, workflows, categories, priorities
and ticket types are things an admin is expected to rename, reorder and extend from the UI,
without a migration and without a developer. Modelled as enums, each of those becomes a
schema change.

**But code has to reason about the lifecycle.** "Is this ticket still open?" decides what
appears in a queue. "Is it in a waiting state?" is what pauses an SLA clock in Phase 2.
"Is it closed?" decides whether the reopen window applies. If a status is nothing but an
admin-supplied string, the only way to answer those is to match on the string — and the
first admin who renames "In Progress" to "Being Worked" silently breaks every one of them.
That failure is quiet, data-dependent, and would surface as a wrong queue rather than an
error.

Phase 0 already solved a version of this. `Permission.key` is a stable handle that code
references through `PERMISSIONS.*`, while everything else about a permission is data. The
same seam works here.

## Decision

### One ticket table, with type as data

`Ticket` carries both Incidents and Service Requests, distinguished by the `TicketType` row
it points at (§2.1's "unified ticket object"). `TicketType` has a stable `key`
(`incident`, `service_request`) that code and seeds refer to, and a `name` that is a label.
An admin can add a third type; nothing in the schema is per-type.

### Names are data; a small `StatusCategory` enum is the contract

`Status.name` is admin-editable and nothing branches on it. Every status also carries a
`StatusCategory` — `triage | open | pending | resolved | closed` — and that is what code
reads. `Status.isTerminal` stays a separate flag rather than being derived from
`category = closed`, so an admin can add a terminal "Cancelled" state without it counting
as a closure in reporting.

This is the ServiceNow/Jira "state bucket" pattern, and it is the whole of the compromise:
five fixed values that only change when the _lifecycle model itself_ changes, against
unlimited freedom in everything an admin actually wants to edit.

### Priority is derived, then stored

`Impact` and `Urgency` are rows (not enums) with an integer `level`, and `PriorityMatrix`
holds one row per (impact, urgency) cell. So the grid is data: an admin can rewrite a cell,
or move from the seeded 3x3 to a 5x5, by adding rows. Priority is never chosen directly
(§2.1).

The ticket then stores `impactId`, `urgencyId` **and** the resolved `priorityId`. The
denormalization is deliberate: an admin editing the grid must not silently rewrite the
priority of every ticket already in flight, which is what recomputing on read would do. A
ticket's priority is a fact about how it was classified at the time, and re-deriving it is
an explicit action rather than a side effect of an admin's edit.

### `number` is the public handle; `id` stays a UUID

Tickets get a `number` (Postgres `SERIAL`, unique) alongside the UUID primary key, because
§9.3 and §9.4 both show people referring to `#1042` — a UUID is not something anyone reads
aloud or types into a search box. Keeping them separate means the short handle can be
sequential without making the primary key guessable or enumerable.

### `DisplayTone` is an enum, and that is the point

Statuses and priorities store a `tone` — `neutral | info | success | warning | danger |
accent` — and never a colour. The values are exactly the tones the UI primitives already
take (ADR-0013), so a restyle remains an edit to `styles/globals.css`. It is an enum rather
than a free string precisely because the set is defined by the design tokens, which are
code: an admin inventing `tone = 'purple'` would render nothing.

### What is deliberately not here

- **Transition rules** (which role may move A → B, which fields a transition requires) are
  Slice 4. Slice 2 gives a workflow an ordered set of states, not a graph.
- **`Status.isInitial` uniqueness per workflow is enforced in the service layer**, not by a
  constraint: Prisma cannot express a partial unique index (`WHERE is_initial`), and a
  plain unique index on `(workflow_id, is_initial)` would forbid a second _non_-initial
  status, which is nonsense.
- **No `slaPolicyId` or `problemId` placeholder columns.** Phase 0 added nullable
  `passwordHash`/`mfaSecret` for a provider that plugs into an existing path; a column
  pointing at a table that does not exist can carry no foreign key and no meaning. Those
  arrive with their tables in Phases 2 and 4.
- **Attachments** are Slice 5, behind the `StorageProvider` abstraction §6.6 requires.

## Alternatives rejected

- **Statuses as a global enum.** Simple, and directly contradicts §3.3's requirement that
  workflows be per ticket type and admin-defined.
- **Statuses as pure data, with no category.** Maximal Article II purity, and it makes
  every lifecycle question a string match. Rejected on the rename argument above: the
  breakage is silent.
- **Deriving priority on read from the live matrix.** Removes the denormalized column, and
  makes an admin's grid edit retroactively rewrite history — including the priority a
  breached SLA was measured against.
- **A single `Classification` table for impact, urgency and priority.** Fewer tables, and it
  loses the distinct semantics (`level` orders an axis, `weight` orders a queue) and every
  useful foreign key.
- **Ticket number as the primary key.** Shortest possible model, and it makes every ticket
  URL enumerable and every foreign key a sequential integer that leaks volume.

## Consequences

- **Renaming a status is safe.** Queues, reporting and the Phase 2 SLA engine read
  `category`; the seed's `update` clause deliberately does not overwrite `name`, so a
  re-seed preserves an admin's label while re-asserting the lifecycle flags code depends on.
- **The seed is now substantial enough to need type checking.** It runs under
  `ts-node --transpile-only`, and `apps/api/tsconfig.json` scopes the build to `src`, so
  until now a wrong property name in a seed file was only discoverable by CI's seed step
  failing at runtime. `tsconfig.seed.json` adds a no-emit pass over `prisma/**/*.ts` and
  `npm run typecheck -w @itsm/api` runs it.
- **Two workflow rows are seeded with near-identical states.** That looks redundant and is
  not: it is what makes §2.2's "a distinct workflow template is allowed per type" true in
  the data, so editing the incident flow cannot touch service requests. The Service Request
  workflow already diverges in one label ("Fulfilled" rather than "Resolved"), which
  demonstrates the name/key separation in the seed itself.
- **Adding an axis level to the priority grid is a data change, but not a free one** — an
  admin who adds a fourth impact level must fill in the new cells, or a ticket classified
  against it has no priority to resolve. The Slice 3 API rejects an incomplete cell rather
  than guessing.
- Indexes are laid down for the queues §9.4 names — mine, my team's, unassigned, ordered
  newest-first — rather than added later under load.
