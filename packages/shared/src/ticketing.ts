/**
 * Stable handles for the Phase 1 ticketing model (Article II: Configuration Over Code).
 *
 * The rule these follow is the one `permissions.ts` already established: a `key` is the
 * contract between code and data and never changes; a `name` is a label an admin is free
 * to edit, and nothing branches on it. See ADR-0016.
 *
 * Seed rows, ticket-type defaults and status semantics all resolve through these. Response
 * DTOs for tickets arrive with the API in Slice 3.
 */

/** Ticket types shipped out of the box. Admins may add more (§2.1, §2.2). */
export const TICKET_TYPES = {
  INCIDENT: 'incident',
  SERVICE_REQUEST: 'service_request',
} as const;

export type TicketTypeKey = (typeof TICKET_TYPES)[keyof typeof TICKET_TYPES];

/** Default status workflows. One per shipped type, so an admin can diverge them (§3.3). */
export const STATUS_WORKFLOWS = {
  INCIDENT_DEFAULT: 'incident_default',
  SERVICE_REQUEST_DEFAULT: 'service_request_default',
} as const;

export type StatusWorkflowKey = (typeof STATUS_WORKFLOWS)[keyof typeof STATUS_WORKFLOWS];

/**
 * What a status *means*, as opposed to what it is called.
 *
 * This is the one part of the workflow an admin cannot rename, because code has to reason
 * about the lifecycle: which tickets are still work, when to stop an SLA clock (Phase 2),
 * whether a reopen window applies. Matching on `Status.name` would break the moment
 * someone renamed "In Progress" to "Being Worked" — so nothing does. Mirrors the
 * `StatusCategory` enum in `schema.prisma`.
 */
export const STATUS_CATEGORIES = {
  /** Raised, not yet picked up. */
  TRIAGE: 'triage',
  /** Actively being worked. */
  OPEN: 'open',
  /** Waiting on someone outside the team; this is what pauses an SLA clock. */
  PENDING: 'pending',
  /** A fix is in place, awaiting confirmation. */
  RESOLVED: 'resolved',
  /** Done. */
  CLOSED: 'closed',
} as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[keyof typeof STATUS_CATEGORIES];

/**
 * Semantic display tokens, mirroring the `DisplayTone` enum in `schema.prisma`.
 *
 * A status or priority row stores one of these, never a colour — the values map to the
 * tones the UI primitives already take, and a restyle edits `styles/globals.css` rather
 * than any row in the database (ADR-0013).
 */
export const DISPLAY_TONES = {
  NEUTRAL: 'neutral',
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  ACCENT: 'accent',
} as const;

export type DisplayTone = (typeof DISPLAY_TONES)[keyof typeof DISPLAY_TONES];

/** Default priorities. Derived from Impact x Urgency, never chosen directly (§2.1). */
export const PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type PriorityKey = (typeof PRIORITIES)[keyof typeof PRIORITIES];

/** Default impact levels — how much of the organization is affected. */
export const IMPACTS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ImpactKey = (typeof IMPACTS)[keyof typeof IMPACTS];

/**
 * Default urgency levels — how time-critical it is.
 *
 * Four levels, not three. Functional Reference B3 defines Urgency as
 * `Low, Medium, High, Urgent` against three Impact levels, making the grid 3x4 = 12 cells.
 * The 3x3 seeded by Slice 2 was written against the constitution's 7.2 table, which predates
 * B3; see ADR-0018. The three original keys keep their values and their matrix cells, so
 * adding `URGENT` widens the grid rather than rewriting it.
 */
export const URGENCIES = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type UrgencyKey = (typeof URGENCIES)[keyof typeof URGENCIES];

/**
 * Channels a request can arrive through (Ref B1, B2 "Identity").
 *
 * B1 is emphatic that source is **metadata on the ticket, never a separate data path** —
 * an email-raised incident and a portal-raised incident are the same row in the same table,
 * differing in one column. `Source is changed` is an automation trigger (Ref E5), which is
 * the other reason it is a stored field rather than something inferred at intake.
 *
 * Rows rather than an enum, following the same Article II rule as everything else here: an
 * admin adding a channel must not need a migration.
 */
export const TICKET_SOURCES = {
  PORTAL: 'portal',
  EMAIL: 'email',
  PHONE: 'phone',
  CHAT: 'chat',
  WALK_IN: 'walk_in',
  API: 'api',
  MONITORING: 'monitoring',
} as const;

export type TicketSourceKey = (typeof TICKET_SOURCES)[keyof typeof TICKET_SOURCES];

/**
 * How a request ended, as distinct from why it was raised (Ref B2 "Resolution").
 *
 * Kept separate from `Status`: a ticket reaching Closed says the workflow finished, while a
 * closure code says what actually happened — the same terminal status covers "we fixed it",
 * "the user withdrew it" and "it was never a fault". Reporting (Ref K2) needs the second
 * distinction and cannot recover it from the first.
 */
export const CLOSURE_CODES = {
  RESOLVED: 'resolved',
  WORKAROUND_PROVIDED: 'workaround_provided',
  NOT_REPRODUCIBLE: 'not_reproducible',
  DUPLICATE: 'duplicate',
  WITHDRAWN: 'withdrawn',
  NO_FAULT_FOUND: 'no_fault_found',
  REJECTED: 'rejected',
} as const;

export type ClosureCodeKey = (typeof CLOSURE_CODES)[keyof typeof CLOSURE_CODES];

/**
 * Depth ceilings for the three classification trees (Ref B4).
 *
 * B4 gives Department an explicit five-level limit and leaves Category and Location
 * "multi-level" / "N-level". Unbounded in a tree that a scope predicate walks is not a
 * neutral choice: `department` scope with sub-departments resolves to a prefix match over
 * the materialized path, and an admin who nests a tree fifty deep makes that path long
 * enough to matter. These are the configurable depth guard B4 asks for, applied in the
 * shared tree helper rather than per-tree.
 */
export const TREE_MAX_DEPTH = {
  CATEGORY: 5,
  DEPARTMENT: 5,
  LOCATION: 8,
} as const;

/**
 * Separator for materialized tree paths (Ref I3.2 shows the shape as `/1/7/22/`).
 *
 * Both leading and trailing separators are always present, which is what makes a subtree
 * test a plain `startsWith` on `path` with no ambiguity: `/1/7/` prefixes `/1/7/22/` but
 * not `/1/70/`. Dropping the trailing separator reintroduces exactly that collision, and it
 * is the classic materialized-path bug.
 */
export const TREE_PATH_SEPARATOR = '/';
