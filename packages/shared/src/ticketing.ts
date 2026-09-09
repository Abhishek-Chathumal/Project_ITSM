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

/** Default urgency levels — how time-critical it is. */
export const URGENCIES = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type UrgencyKey = (typeof URGENCIES)[keyof typeof URGENCIES];
