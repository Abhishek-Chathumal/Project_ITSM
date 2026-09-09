# ADR-0018: Reconcile the request model with Functional Reference B2/B3 — and split the four ownership axes

**Status:** Accepted
**Amends:** [ADR-0016](0016-ticket-data-model.md) (the ticket data model — specifically its treatment of departments as teams, and its 3×3 priority grid)
**Relates to:** [ADR-0017](0017-adopt-amendments-a001-a006.md) · Constitution Article II, §2.1, Part VII, 5.2 · Functional Reference B1, B2, B3, B4, B5, I3

## Context

ADR-0016 was written against the constitution's 7.2 table, the only source at the time. The
Functional Reference specifies the same object in far more detail, and ADR-0016 already
carries a header note listing two things it got wrong: the priority grid is 3×4, not 3×3, and
derivation must be conditional.

Reconciling those was the whole of Phase 1 Slice 2b as planned. Reading Part I alongside
Part B turned up something larger, and it is the reason this is an ADR rather than a commit.

### The planned scope was one silent-narrowing trap. There were four.

`PROJECT_STATE` §4b and `PHASE_PLAN` both name a single blocker for Phase 0's
`applyScope()`: Reference I3.1 defines `own` scope as **requester, assignee, watcher, or
collaborator**, and the last two do not exist in the schema — so a scope helper written first
would implement a narrower `own` than the spec, pass its tests, and be wrong.

That reasoning is correct and it generalizes. Of the seven scope values in I3.1, four could
not have been implemented correctly against the merged schema:

| Scope        | State before this ADR                                  | How it would have failed                                                   |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `own`        | requester + assignee only                              | **too narrow** — a watcher cannot see the ticket they are watching         |
| `group`      | no such table; `Ticket.teamId` pointed at `Department` | **wrong set, both directions** — see below                                 |
| `department` | parent FK only, no materialized path                   | sub-department scope becomes a recursive query, or is quietly single-level |
| `location`   | **no table, no column, anywhere**                      | unimplementable — and a `default:` fall-through would render it as `all`   |

`group` is the worst of the four and the least visible. Reference I3.1 lists `group` ("the
user's technician group(s)") and `department` as two different scope values. Reference B1
defines a Technician Group as its own entity — _"a team a ticket can be assigned to; a
technician may belong to several"_ — and B2's Ownership group lists Technician Group **and**
Department as separate fields on a request. G3.3 gives each group its own business hours,
which is what makes SLA calculation team-aware in Phase 2 (D3).

ADR-0016 collapsed the two, with the comment _"Departments double as teams (Part VII)."_
Against the constitution alone that was defensible. Against I3.1 it means `group` and
`department` scope resolve through the same column, and a technician who covers three groups
is modelled as covering one.

### The failure mode is the one 5.2 exists to prevent

None of these four announces itself. A too-narrow scope produces a support ticket; a
too-wide one produces nothing at all until someone notices they can read another
department's records. Constitution 5.2 puts it plainly — _"the miss is a data leak, not a
visible bug"_ — and the point of building this before `applyScope()` is that the helper
cannot be written correctly against a schema that cannot express what it must filter on.

## Decision

### 1. Four ownership axes, four columns

`Ticket.teamId → Department` is replaced by three columns:

- `groupId → TechnicianGroup` — who works it (`group` scope)
- `departmentId → Department` — which department it belongs to (`department` scope)
- `locationId → Location` — which site it concerns (`location` scope)

plus `TicketWatcher` and `TicketCollaborator` join tables completing `own` scope, and
`User.locationId` + `TechnicianGroupMember` giving the user side of each predicate.

Group membership is **many-to-many**. That is the part a single FK could not express and the
reason the change is structural rather than a rename.

### 2. `TechnicianGroup` is a first-class entity, distinct from `Department`

Departments describe where a person works; groups describe what they work on. Reference I3.2
makes the analogous point about the reporting tree — _"They are frequently not the same
shape, which is why one cannot substitute for the other"_ — and it applies here for the same
reason.

`businessHoursId` is **not** added, though G3.3 implies it. ADR-0016's rule holds: a column
pointing at a table that does not exist carries no foreign key and no meaning. It arrives
with business hours in Phase 2.

### 3. One materialized-path tree helper, serving four trees

Reference B4 asks for this directly: _"Implement once with a shared tree helper (materialized
path) plus a configurable depth guard — not three bespoke implementations."_

`apps/api/src/common/tree/materialized-path.ts` is that helper — pure functions over ids and
paths, touching no database. `Category`, `Department` and `Location` all carry `path` and
`depth`; `User.reporting_path` (Reference I3.2) becomes the fourth user in Phase 0 Slice 0b
rather than a second implementation.

Two details that are load-bearing rather than stylistic:

- **Both separators are mandatory.** A root is `/X/`, not `/X`. Without the trailing
  separator, `startsWith('/1/7')` also matches `/1/70/` — a sibling subtree silently pulled
  into a scoped query. There is a test for exactly this.
- **The index is `text_pattern_ops`.** A subtree test is `path LIKE '/a/b/%'`, and PostgreSQL
  will not use a default btree on a text column for a prefix `LIKE` unless the database
  collation is C. The plain index this started as was one that every scoped list query would
  have sequential-scanned past — correct results, silently linear.

Cycle protection and the depth ceiling are enforced in the helper and throw rather than
return a boolean, because the failure mode of a caller forgetting to check is a corrupted
tree.

### 4. The priority grid becomes 3×4 by widening, not rewriting

Reference B3 defines four urgency levels. The fourth (`urgent`) is added and the three
resulting cells are seeded; **all nine original cells keep the priority they had.** So the
change adds a classification that was previously inexpressible rather than reclassifying
anything already recorded. Impact labels move to B3's vocabulary (`On User` → `On
Department` → `On Business`); the keys do not, because a key is the contract and renaming one
would orphan every matrix cell.

### 5. `resolvePriority()` fires on create only

B3: _"It fires only when Priority is left blank at creation. An explicitly set priority is
never overridden."_

`PriorityResolverService` exposes `resolveForCreate()` and a separate, deliberate
`rederive()`. There is **no update path**, which is how the rule is enforced rather than
merely intended — an ordinary edit has nothing to call. `rederive()` is gated by
`request.priority.override` (Reference I2.1) at the caller in Slice 3.

The service does not validate an explicit priority against what the matrix would have
produced. They are allowed to disagree; that disagreement is the entire meaning of an
override.

### 6. `isOperationallyActive()` is one predicate, in one place

Reference B5 names three states that are not Closed — Spam, Archived, Merged-secondary — and
asks for the exclusions in one predicate. `requests/request-state.ts` holds it, alongside the
equivalent Prisma `where` fragment so no caller ever spells the condition out by hand. Both
are asserted to agree, because two expressions of one rule drift invisibly: a report and a
list disagreeing, with neither erroring.

## Alternatives rejected

- **Add watchers and collaborators only, as planned, and leave the rest to Slice 0c.** The
  smallest change that satisfies the written plan, and it leaves three of the four traps in
  place for the helper that must not have any. `location` in particular has no table at all,
  so `applyScope()` would have needed a branch it could not implement.
- **Keep `teamId → Department` and treat `group` scope as an alias for `department`.** No
  migration, and it makes two distinct scope values silently identical — a technician in
  three groups sees one, and a grant of `group` quietly widens to a whole department.
- **Model watchers and collaborators as one table with a `kind` discriminator.** One fewer
  table. They are separately managed and separately meaningful (subscribed versus involved),
  and every query wanting one would carry a filter that is easy to omit.
- **`tags` as a join table.** Consistent with how every other lookup here is modelled, and
  wrong for this one: tags are user data an agent types, not configuration an admin curates,
  so there is nothing to rename or reorder. A `String[]` with a GIN index is the right shape.
- **A plain btree on `path`.** What Prisma generates by default, and it produces correct
  results — which is why this would have survived review and shown up as latency later.

## Consequences

- **`Ticket.team_id` is dropped, and with it any data in that column.** Nothing writes it: the
  request API is Slice 3 and does not exist. Verified against a real Postgres from an empty
  database.
- **ADR-0016's "Departments double as teams" no longer holds.** Its header note now points
  here. Everything else in that ADR stands — one ticket table, priority derived then stored,
  workflows per type, `StatusCategory` as the code contract.
- **`applyScope()` can now be written against a schema that can express all seven scope
  values.** That was the point. Phase 0 Slice 0c is unblocked, and its `own` branch has four
  participant kinds to join rather than two.
- **One trap named in `PHASE_PLAN` remains a Slice 0c responsibility and is not fixed here:**
  a user with a null `departmentId` must contribute _nothing_ to a `department`-scoped
  clause, never `{ departmentId: null }`, which PostgreSQL renders as `department_id IS NULL`
  and which matches every unassigned record. The schema cannot prevent that; only the helper
  can. `verify-slice-2b.ts` records it as a live fact against real data so it is not
  rediscovered.
- **A `default:` branch in `applyScope()` must fail closed.** Four scope values had no schema
  behind them until this change, and a fall-through that returns an unfiltered query turns
  "unimplemented" into `all`. This is the highest-value line in the helper and is called out
  here because the schema work is what made it possible to forget.
- **`RequestsModule` is registered in `AppModule` with no controllers.** Deliberate: it
  exercises DI for `PriorityResolverService` at boot. An `@Injectable()` nobody provides
  type-checks, passes its unit tests, and fails the first time it is resolved — the
  runtime-only failure mode this project keeps meeting.
- **Type conversion (Incident ↔ Service Request) is designed but not built.** Reference B1
  makes it first-class and Part XII puts it in Phase 1. The schema supports it already —
  one table, `typeId` a column — but each type points at its own workflow, so conversion must
  **map the current status onto the target workflow**, not merely swap `typeId`. A ticket
  sitting in `pending_vendor` on the incident flow must land on a real status in the service
  request flow. That mapping is a Slice 3/4 operation with an audit entry, and building it
  before the transition rules of Slice 4 exist would mean guessing at the target set.
- **`verify-slice-2b.ts` ships with the migration.** Every Phase 0 bug in this project was
  runtime-only; a script that writes a real ticket across all four ownership axes and reads
  the trees back is the cheapest defence against the next one. It is not a substitute for the
  integration-test harness Slice 0c needs, which does not exist yet.
