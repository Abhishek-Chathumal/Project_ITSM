# The In-House IT Support Portal — Development Constitution

**Version:** 1.1
**Status:** Foundational specification — governs all development decisions
**Framework Alignment:** ITIL 4
**Reference Systems:** Motadata ServiceOps, ServiceNow, Jira Service Management
**Intended Consumer of This Document:** Development team / AI coding agent (Claude Code)

---

## Preamble

This document is the single source of truth for the design, build, and evolution of the in-house IT Support Portal ("the Portal"). Like a constitution, it does not describe every implementation detail line-by-line — it establishes the **non-negotiable structure, principles, and contracts** that every module, screen, and API must respect. Where an implementer must choose between two paths and this document is silent, the choice must be justified against Part I (Principles) and recorded in an Architecture Decision Record (ADR) per Part XIV.

This document supersedes the original lightweight specification. Nothing in the original scope is lost — it is expanded, structured, and made buildable.

---

## Table of Contents

- Part I — Vision, Principles & Scope
- Part II — Functional Specification (Core ITIL4 Modules)
- Part III — Customization Framework
- Part IV — Automation Engine
- Part V — Access Control, Identity & Security
- Part VI — System Architecture
- Part VII — Data Model
- Part VIII — API Design
- Part IX — UI/UX Specification & Prototypes
- Part X — Technology Stack
- Part XI — Non-Functional Requirements
- Part XII — Development Roadmap
- Part XIII — Testing Strategy
- Part XIV — Governance & Amendment Process
- Appendices

---

# PART I — VISION, PRINCIPLES & SCOPE

## 1.1 Vision Statement

A single, self-hosted portal that gives a small-to-mid-size organization enterprise-grade IT service management (ITSM) capability — incident, request, problem, change, and asset management under one ITIL4-aligned roof — without the license cost, vendor lock-in, or bloat of commercial platforms, while remaining as configurable as those platforms for the workflows that matter to this organization.

## 1.2 Guiding Principles (Articles)

These principles override convenience or shortcuts at every layer of development:

1. **Article I — API-First.** Every capability the UI offers must exist as a versioned REST API first. The web, mobile, and desktop clients are consumers of the same API — never a special back-door.
2. **Article II — Configuration Over Code.** Ticket types, fields, workflows, SLAs, and roles must be admin-configurable through the UI wherever technically feasible, not hardcoded, so the organization can evolve the system without a developer.
3. **Article III — Least Privilege by Default.** No user, role, or integration receives more access than its function requires. New roles start with zero permissions.
4. **Article IV — Auditability.** Every state-changing action (ticket update, permission change, automation firing, login) is attributable, timestamped, and immutable in the audit trail.
5. **Article V — Single Data Model, Multiple Surfaces.** Web, mobile, and desktop render the same underlying entities. No surface may maintain its own divergent schema or business logic.
6. **Article VI — Progressive Disclosure.** Simple tasks (raise a ticket) must take a novice end-user under 60 seconds. Power/admin features are layered behind roles, not hidden entirely.
7. **Article VII — Fail Safe, Not Silent.** Automations and integrations must log failures visibly to admins; a broken automation must never silently drop a ticket.
8. **Article VIII — Own Your Data.** No mandatory third-party SaaS dependency for core function. Self-hosted database, file storage, and auth must always be a supported deployment path.

## 1.3 ITIL 4 Alignment

The Portal implements the following ITIL 4 practices. This mapping is authoritative — module names in Part II map 1:1 to these practices.

| ITIL 4 Practice                     | Portal Module                        | Priority |
| ----------------------------------- | ------------------------------------ | -------- |
| Incident Management                 | 2.1 Incident Management              | P0 (MVP) |
| Service Request Management          | 2.2 Service Request Management       | P0 (MVP) |
| Service Desk (practice, not module) | Realized via 2.1 + 2.2 + 2.8         | P0 (MVP) |
| Problem Management                  | 2.3 Problem Management               | P2       |
| Change Enablement                   | 2.4 Change Enablement                | P2       |
| Knowledge Management                | 2.5 Knowledge Management             | P1       |
| Service Configuration Management    | 2.6 Asset & CMDB                     | P1       |
| Service Level Management            | 2.7 SLA/OLA Management               | P1       |
| Monitoring & Event Management       | Integration hook only (Part IV.8)    | P3       |
| Continual Improvement               | 2.9 Reporting & Analytics feeds this | P2       |

Priority key: **P0** = MVP/Phase 1, **P1** = Phase 2, **P2** = Phase 3, **P3** = Phase 4+.

## 1.4 Personas

| Persona                         | Description                                                             | Primary Surface                 |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| **Requester** (End User)        | Any employee raising tickets. No ITSM knowledge assumed.                | Self-service portal, mobile     |
| **Technician (Agent)**          | Handles assigned tickets, works the queue.                              | Agent web console, mobile       |
| **Team Lead**                   | Owns a queue/department, reassigns, monitors SLA breaches.              | Agent console + team dashboards |
| **Change/Problem Manager**      | Runs CAB, links problems to incidents.                                  | Agent console, advanced modules |
| **Administrator**               | Configures fields, workflows, roles, automations, integrations.         | Admin console                   |
| **Auditor** (read-only)         | Views audit logs, reports; cannot modify data.                          | Reporting + audit views only    |
| **Integration/Service Account** | Non-human identity used by monitoring tools, email-to-ticket, webhooks. | API only                        |

## 1.5 Scope

**In scope:** Incident, Service Request, Problem, Change, Knowledge, Asset/CMDB, SLA, self-service portal, RBAC, automation/business rules engine, custom fields/forms, dashboards & reporting, notifications (email + in-app + push), CSAT surveys, audit logging, REST API, responsive web app usable on desktop and mobile browsers, installable PWA, optional native wrapper.

**Out of scope (v1):** Full CMDB dependency mapping/service maps, native React Native apps (deferred — see 10.3), billing/chargeback, multi-tenant SaaS hosting for external customers, AI-based ticket triage (flagged as a future extension point, not built in v1).

## 1.6 Success Metrics

- Ticket creation to first-response median time (tracked, not hardcoded target — org sets its own SLA)
- % of tickets resolved via self-service/KB deflection
- SLA compliance %
- Automation coverage: % of tickets touched by at least one automation
- Admin configuration changes made without developer involvement (proves Article II)

---

# PART II — FUNCTIONAL SPECIFICATION (CORE ITIL4 MODULES)

## 2.1 Incident Management

**Purpose:** Restore normal service operation as fast as possible after an unplanned interruption.

- Unified ticket object shared with Service Requests (`ticket.type = INCIDENT`), per original spec — see Part VII.
- **Status workflow (configurable per Article II, default below):**
  `New → Open → In Progress → Pending (Customer) → Pending (Vendor) → Resolved → Closed → Reopened`
- **Priority Matrix:** Priority is _derived_, not freely chosen, from Impact × Urgency (standard ITIL 5x5 or 3x3 matrix, admin-configurable grid — see 3.x).
- **Major Incident flag:** any incident can be escalated to "Major Incident," which triggers: dedicated Slack/email broadcast, war-room ticket linking, executive-visible dashboard, and mandatory post-incident review task.
- Multi-level categorization: `Category > Subcategory > Item` (e.g., Hardware > Laptop > Screen).
- Rich text description & replies (inline image paste, drag-drop attachments, PDF/log uploads), full reply history threaded like an email client.
- **Merge & Link:** duplicate incidents can be merged; related incidents can be linked to a Problem (2.3).
- **Reopen window:** configurable number of days after Closed during which a user reply reopens the ticket automatically.

## 2.2 Service Request Management (+ Service Catalog)

- Requests use the same ticket table (`ticket.type = SERVICE_REQUEST`) but a distinct workflow template is allowed per catalog item (Article II).
- **Service Catalog:** admin-built grid/list of catalog items, each with: icon, name, description, category, a **dynamic request form** (custom fields, see 3.1), optional approval requirement, and a target fulfillment SLA.
- Catalog items can require **multi-stage approval** (e.g., manager approval → IT approval) before entering the fulfillment queue — see 4.4.
- Catalog items can auto-generate **fulfillment tasks/checklists** for the assigned technician (e.g., "Provision Laptop" → 5 sub-tasks).

## 2.3 Problem Management

- A `Problem` entity, distinct table, represents the underlying root cause of one or more Incidents.
- Incidents can be linked to a Problem (many-to-one).
- Problem workflow: `New → Investigating → Known Error → Resolved → Closed`.
- **Known Error Database (KEDB):** a Problem marked "Known Error" with a documented workaround is surfaced to technicians when a matching Incident is raised (basic keyword/category match in v1; can be manual-link only in MVP).
- Root Cause Analysis (RCA) field: structured template (Root Cause, Workaround, Permanent Fix, Preventive Action).

## 2.4 Change Enablement (Change Management)

- `ChangeRequest` entity, distinct table and workflow.
- Change types: **Standard** (pre-approved, low-risk, template-driven, no CAB needed), **Normal** (requires CAB approval), **Emergency** (expedited approval path, post-implementation review mandatory).
- Workflow: `Draft → Submitted → CAB Review → Approved/Rejected → Scheduled → In Progress → Implemented → Review → Closed`.
- Fields: Risk level, Impact, Rollback plan, Implementation plan, Scheduled window (start/end), linked Assets, linked Incidents/Problems that necessitated the change.
- **Change Calendar:** a calendar view of all Scheduled/In Progress changes to detect conflicts (blackout windows configurable by admin).

## 2.5 Knowledge Management

- `KnowledgeArticle` entity: title, body (rich text), category, tags, visibility (Public/Internal/Team-restricted), status (Draft/Review/Published/Archived), version history.
- Full-text search across articles, surfaced in: (a) self-service portal search bar, (b) suggested articles panel while a Requester is typing a new ticket (deflection), (c) technician-side "insert into reply" shortcut.
- Article feedback (thumbs up/down + comment) feeds into 2.9 reporting.
- Simple approval workflow before publishing (Draft → Review → Published) — reuses the generic Approval mechanism (4.4).

## 2.6 Asset & Configuration Management (Lightweight CMDB)

- `Asset` entity: tag, type, model, serial, status (In Stock/Active/In Repair/Retired), assigned user, assigned department, location, purchase date, warranty expiry.
- **Asset Types** are admin-definable with **custom attributes** (Article II) — e.g., a "Laptop" type might have CPU/RAM/OS fields; a "Software License" type has seat count/expiry.
- Ticket–Asset association (many-to-many): full history of tickets per asset is visible on the asset record.
- **Basic relationship graph** (v1): Asset → Asset (e.g., "Monitor connected to Laptop"), rendered as a simple node graph — not a full dependency-mapping CMDB (explicitly out of scope per 1.5).
- CSV import/export for bulk asset onboarding.
- Warranty/license expiry gets an automated reminder (ties into Part IV automation).

## 2.7 SLA / OLA Management

- `SLAPolicy` entity: name, conditions (matches on ticket type, priority, category, department), response time target, resolution time target, business-hours calendar reference.
- **Business Hours Calendar:** admin-defined working hours, holidays, timezone — SLA timers pause outside business hours (configurable per policy: 24x7 vs business-hours-only).
- SLA timers: **First Response** and **Resolution**, each with Warning threshold (e.g., 80% elapsed) and Breach state, both visually flagged (amber/red) on ticket lists.
- Pending states pause the resolution clock; policy defines which statuses pause vs. continue the clock.
- OLA (Operational Level Agreement) — same structure as SLA but between internal teams (e.g., Network team owes Service Desk a 4-hour ack) — reuses `SLAPolicy` table with a `scope = OLA` flag.

## 2.8 Self-Service Portal

- Service Catalog grid (2.2) as the front door.
- "My Tickets" — list + detail, with comment/attachment ability, satisfaction rating on close.
- Global search (tickets + KB articles).
- "Report an Issue" quick form with AI-free keyword-based KB suggestions before submission (deflection).
- Organization announcements/banner (e.g., "Email outage in progress" — tied to Major Incident flag in 2.1).

## 2.9 Reporting & Analytics

- Pre-built dashboards: SLA compliance, ticket volume trend, agent workload/leaderboard, CSAT trend, category breakdown, asset inventory summary.
- **Custom Report Builder** (Article II) — see 3.5.
- Scheduled report emails (PDF/CSV export) to stakeholders.
- Export raw data (CSV) for any list view.

## 2.10 Notification System

- Channels: in-app (bell icon + toast), email, and push (web push for PWA / mobile push if native app exists).
- Every notification type is a row in a `NotificationTemplate` table — admin-editable subject/body with merge fields (`{{ticket.id}}`, `{{ticket.title}}`, etc.) — Article II compliance.
- Per-user notification preferences (which events, which channel).
- Digest mode option (batch non-urgent notifications hourly/daily) to avoid alert fatigue.

## 2.11 Surveys / CSAT

- Auto-sent 1–5 star (+ optional comment) survey on ticket Closed.
- Results roll into 2.9 dashboards and can be filtered by technician/team/category.

---

# PART III — CUSTOMIZATION FRAMEWORK

Customization is a first-class module, not an afterthought — this section exists because Article II demands it.

## 3.1 Custom Fields Engine

- Field types: Text, Text Area, Number, Date, Datetime, Dropdown (single), Multi-select, Checkbox, User Picker, Asset Picker, Attachment.
- Fields are attachable to: Ticket (per type/catalog item), Asset (per Asset Type), Change Request, Problem.
- Field metadata: label, help text, required flag, default value, visibility conditions (see 3.3 conditional logic), validation regex (for text).
- Stored via an EAV-style `CustomFieldValue` table (Part VII) to avoid schema migrations every time an admin adds a field.

## 3.2 Custom Forms & Templates

- Each Service Catalog item / Ticket Type has a **Form Builder**: drag-and-drop ordering of standard + custom fields, section grouping, conditional show/hide ("if Category = Hardware, show Asset Picker").
- Form versioning: editing a live form doesn't retroactively alter already-submitted tickets' stored data.

## 3.3 Workflow / Status Customization

- Admins define **Status Sets** per ticket type/catalog item (not one global workflow) — e.g., a "New Hire Onboarding" request might have `Requested → Approved → Provisioning → Ready → Closed` instead of the generic Incident flow.
- **Transition rules:** which roles can move a ticket from Status A → B; optional required fields on a given transition (e.g., "Resolution Notes" mandatory to move to Resolved).
- Visual workflow editor (state diagram, drag to connect) — see prototype in Part IX.

## 3.4 Business Rules Engine

Covered fully in Part IV (it is the automation engine), but the **authoring UI** is a customization surface: Trigger → Condition(s) → Action(s), built with dropdowns, no code required.

## 3.5 Dashboard & Report Builder

- Widget types: Number/KPI tile, Bar chart, Line/trend chart, Pie/donut, Table, Leaderboard.
- Data source = any entity + filter + group-by + aggregate (count, avg, sum) chosen via UI, not SQL — this keeps report authoring inside the "no code" boundary of Article II while power users can still request a raw CSV export for anything advanced.
- Dashboards are personal (per user), team, or organization-wide (admin-pinned).

## 3.6 Branding / Theming

- Logo, primary/accent color, portal name, custom email footer — stored as a single `OrgSettings` config, applied via CSS variables at runtime (ties to frontend design system, Part IX).
- Light/Dark mode toggle, per-user preference, is a baseline requirement (not "branding" but grouped here as a personalization feature).

## 3.7 Multi-Department Considerations

- `Department`/`Team` entities scope: queues, SLA policies, custom fields (some fields may be department-specific), and dashboards.
- Not a full multi-tenant architecture (single organization, single DB schema) — see 1.5 scope and Article VIII.

---

# PART IV — AUTOMATION ENGINE

## 4.1 Automation Engine Architecture

A generic **Trigger → Condition(s) → Action(s)** model, evaluated by a rules-processing service, decoupled from the main request/response cycle via a job queue (Part VI.7) so automation never blocks the user-facing API.

```
Event occurs (ticket created / updated / SLA tick / scheduled cron)
        │
        ▼
  [ Event Bus / Queue ]
        │
        ▼
 [ Automation Worker ] ── loads matching Rules for this event type
        │
        ▼
 For each Rule (ordered by priority):
    evaluate Conditions (AND/OR groups)
        │  match?
        ▼
   Execute Actions (in order) ── logged to AutomationExecutionLog
        │
        ▼
   On failure: retry (configurable) → else flag to Admin (Article VII)
```

**Trigger types:** Ticket Created, Ticket Updated (field-level: status/priority/assignee changed), Comment Added, SLA Threshold Reached (warning/breach), Scheduled/Cron, Asset Warranty Approaching, Webhook Received (inbound, from 4.8).

**Condition types:** field equals/not-equals/contains, field changed from X to Y, requester/department equals, custom field value comparisons, time-based (e.g., "created > 3 days ago").

**Action types:** Change field (status/priority/assignee/etc.), Add comment (internal or public), Send notification (email/in-app), Assign to user/team (see 4.2), Create linked task/sub-ticket, Call outbound webhook (4.8), Add tag.

## 4.2 Auto-Assignment / Routing

Selectable strategy per queue/department:

- **Round Robin** — even rotation among available agents.
- **Load-Based** — assign to the agent with fewest open tickets.
- **Skill/Category-Based** — mapping table of Category → preferred team/agent.
- **Manual** — falls into an unassigned queue for a Team Lead to triage.

## 4.3 SLA Escalation Engine

- Runs as a scheduled worker (ticking every N minutes) checking open tickets against their `SLAPolicy` timers.
- At Warning threshold: notify assigned agent. At Breach: notify agent + Team Lead, optionally auto-reassign or auto-raise priority (admin-configured action chain, reusing 4.1's Action list).

## 4.4 Approval Workflows

- Generic `ApprovalRequest` entity: linked to any approvable object (Service Request, Change Request, Knowledge Article).
- Supports **sequential** (Manager → IT Director) and **parallel** (any 2 of 3 approvers) chains, defined per catalog item/change type.
- Approvers act via in-app action or one-click email approve/reject link (secure, signed token, single-use).

## 4.5 Scheduled / Recurring Tickets

- `TicketSchedule` entity: cron-like recurrence (e.g., "create a Server Health Check ticket every Monday 8am") — generates a real ticket at each fire, using a stored template.

## 4.6 Auto-Close / Auto-Resolve Rules

- E.g., "If status = Resolved and no customer reply in 5 days → auto-Close." Configurable per ticket type.

## 4.7 Macros / Canned Responses

- Agent-facing: predefined text snippets (and optionally field changes bundled together) triggered with one click while replying — reduces repetitive typing, distinct from admin-authored automation rules but stored in a similar Action-list structure for reuse.

## 4.8 Integration-Triggered Automation

- **Inbound:** Email-to-ticket (a monitored mailbox creates/updates tickets), generic inbound webhook endpoint (for monitoring tools like Zabbix/Nagios/Uptime Kuma to open incidents automatically).
- **Outbound:** Any Action in 4.1 can be "Call Webhook" — posts a JSON payload to a configured URL (e.g., push into Slack/Teams, or a CI/CD system for a Change ticket).
- All integrations are configured through Admin > Integrations, with per-integration enable/disable and a delivery log (Article VII — visible failures).

---

# PART V — ACCESS CONTROL, IDENTITY & SECURITY

## 5.1 Authentication

- **Local auth** (email + password, bcrypt/argon2 hashed) always available as a fallback (Article VIII — never mandatory third-party dependency).
- **SSO** via SAML 2.0 and OIDC/OAuth2 — pluggable, configured in Admin > Authentication, so the org can wire in Azure AD/Entra ID, Google Workspace, Okta, or Keycloak.
- **LDAP/Active Directory** bind-based auth as an additional pluggable provider (common for on-prem banking/enterprise environments).
- **MFA:** TOTP (authenticator app) mandatory-by-policy option, enforceable per role (e.g., mandatory for Admin role).

## 5.2 RBAC Model

- `Role` → set of `Permission`s. Permissions are granular and resource-scoped, e.g. `ticket.view.own`, `ticket.view.team`, `ticket.view.all`, `ticket.edit.assigned`, `ticket.delete`, `asset.manage`, `automation.manage`, `role.manage`, `report.view.org`.
- Default roles shipped out of the box (all editable/cloneable, never hardcoded into logic — Article III): **Requester, Technician, Team Lead, Change Manager, Admin, Auditor.**
- Permission checks happen **server-side on every API call** — the frontend hides UI it has no permission for, but this is UX only, never the security boundary.

### Sample Permission Matrix (abridged — full matrix in Appendix B)

| Permission               | Requester | Technician    | Team Lead | Admin    | Auditor             |
| ------------------------ | --------- | ------------- | --------- | -------- | ------------------- |
| Create ticket            | ✅ (own)  | ✅            | ✅        | ✅       | ❌                  |
| View own tickets         | ✅        | ✅            | ✅        | ✅       | ✅                  |
| View team tickets        | ❌        | ✅ (assigned) | ✅ (team) | ✅ (all) | ✅ (all, read-only) |
| Edit ticket status       | ❌        | ✅ (assigned) | ✅ (team) | ✅       | ❌                  |
| Manage SLA policies      | ❌        | ❌            | ❌        | ✅       | ❌                  |
| Manage roles/permissions | ❌        | ❌            | ❌        | ✅       | ❌                  |
| View audit log           | ❌        | ❌            | ❌        | ✅       | ✅                  |
| Configure automations    | ❌        | ❌            | ❌        | ✅       | ❌                  |

## 5.3 Scoping (ABAC layer on top of RBAC)

- Attribute-based narrowing: Department and Team membership scope "team"-level permissions automatically — a Team Lead of Networking only sees Networking's queue even though their Role grants "view team tickets" generically.

## 5.4 Multi-Factor Authentication

- Covered in 5.1; additionally: forced MFA re-challenge for sensitive admin actions (role changes, integration secrets) — step-up auth pattern.

## 5.5 Audit Logging

- `AuditLog` entity: actor, action, entity type/id, before/after diff (JSON), timestamp, IP/user-agent.
- Logged: logins (success/fail), permission/role changes, ticket field changes, automation rule changes, integration credential changes, data exports.
- Immutable (append-only table, no update/delete permission at the application layer).

## 5.6 Data Security

- TLS 1.2+ enforced in transit (reverse proxy terminates TLS, internal traffic on a private network/VPC).
- Encryption at rest for the database volume and file storage volume (disk-level, e.g., LUKS, or managed-disk encryption if cloud-hosted).
- Secrets (SSO client secrets, webhook signing keys, DB credentials) stored in a secrets manager or `.env` outside version control — never in the database in plaintext.
- Automated encrypted backups (Part XI).

## 5.7 API Security

- JWT-based session tokens (short-lived access token + rotating refresh token), or server-side session with secure/httpOnly cookies — **decision recorded as ADR-001**, default recommendation: httpOnly cookie session for the first-party web app + separate long-lived API keys (scoped, revocable) for service accounts/integrations.
- Rate limiting per user/IP at the reverse proxy and app layer.
- Input validation and output encoding to prevent injection/XSS; parameterized queries only (ORM enforced).
- CSRF protection on cookie-based sessions.

## 5.8 Session Management

- Configurable session timeout (idle + absolute), forced logout on password/role change, "active sessions" self-service view + admin-forced revoke.

## 5.9 Compliance Considerations

- Since this may serve banking-adjacent proposal work (per organizational context), the design should not preclude alignment with common controls: audit trail (5.5), access review support (role/permission export), data retention policy fields (configurable ticket/attachment retention period), and the ability to fully self-host with no data leaving the organization's network (Article VIII).

---

# PART VI — SYSTEM ARCHITECTURE

## 6.1 High-Level Architecture

```
                        ┌─────────────────────────────┐
                        │   Clients                     │
                        │  Web (SPA) · PWA (mobile)      │
                        │  Desktop (installed PWA/Tauri) │
                        └───────────────┬───────────────┘
                                        │ HTTPS / REST + WebSocket
                                        ▼
                        ┌─────────────────────────────┐
                        │  Reverse Proxy / API Gateway   │
                        │  (nginx/Traefik, TLS, rate-lim)│
                        └───────────────┬───────────────┘
                                        ▼
        ┌───────────────────────────────────────────────────────┐
        │                Application Layer (Backend API)          │
        │  ┌────────┐ ┌───────────┐ ┌────────────┐ ┌───────────┐ │
        │  │  Auth  │ │ Ticketing │ │ Asset/CMDB │ │  Reporting│ │
        │  └────────┘ └───────────┘ └────────────┘ └───────────┘ │
        │  ┌────────────────┐ ┌────────────────┐ ┌─────────────┐│
        │  │ Automation Svc │ │ Notification Svc│ │ Integration ││
        │  └────────────────┘ └────────────────┘ └─────────────┘│
        └───────────┬───────────────────┬───────────────┬────────┘
                    ▼                   ▼               ▼
        ┌───────────────────┐ ┌─────────────────┐ ┌──────────────┐
        │ Relational Database│ │ Redis (cache/    │ │ File Storage │
        │   (PostgreSQL)      │ │  queue/pubsub)   │ │  Volume       │
        └───────────────────┘ └─────────────────┘ └──────────────┘
                                        ▲
                                        │
                        ┌───────────────┴───────────────┐
                        │  Background Workers (queue)     │
                        │  automations · SLA ticks ·      │
                        │  notifications · scheduled jobs │
                        └─────────────────────────────────┘
```

## 6.2 Component Breakdown

| Component            | Responsibility                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| Auth Service         | Login, SSO/OIDC/SAML/LDAP handshake, session/JWT issuance, MFA                    |
| Ticketing Service    | Incident/Request/Problem/Change CRUD, workflow engine, SLA linkage                |
| Asset/CMDB Service   | Asset CRUD, ticket-asset linking, relationship graph                              |
| Automation Service   | Rule evaluation (Part IV), runs primarily as queue consumers                      |
| Notification Service | Renders templates, dispatches email/in-app/push                                   |
| Reporting Service    | Aggregation queries, dashboard data, scheduled exports                            |
| Integration Service  | Inbound email/webhook ingestion, outbound webhook dispatch, SSO provider adapters |
| Background Workers   | Queue consumers for anything not required to be synchronous                       |

## 6.3 Real-Time Updates

- WebSocket (or Server-Sent Events) channel per user, subscribed to their visible tickets/queues, pushes live updates (new comment, status change, new assignment) so agents don't need to poll — critical for a responsive multi-tab technician console (original spec's requirement).

## 6.4 Caching & Queue Layer

- **Redis** serves three roles: (1) cache for expensive dashboard aggregates, (2) job queue backing (e.g., BullMQ if Node, Celery+Redis if Python), (3) pub/sub backbone for WebSocket fan-out across multiple app instances.

## 6.5 Search

- v1: PostgreSQL full-text search (`tsvector`) across tickets and KB articles — sufficient at small-organization scale and avoids an extra service (Article VIII simplicity bias).
- Documented extension point to swap in OpenSearch/Elasticsearch later if volume demands it — must not be architecturally blocked.

## 6.6 File Storage

- Local disk volume in v1 (as original spec), abstracted behind a storage interface (`StorageProvider`) so S3-compatible object storage (MinIO, AWS S3) can be swapped in without touching business logic — this is the key architectural correction vs. the original spec, which hard-coded "local disk."

## 6.7 Multi-Platform Strategy (Web / Desktop / Mobile)

- **Single responsive SPA** (mobile-first breakpoints) is the primary deliverable — satisfies web, desktop-browser, and mobile-browser from one codebase (Article V).
- **PWA** manifest + service worker: installable "app" on mobile home screen and desktop, offline shell caching, push notification support — no separate native codebase needed for v1.
- **Desktop packaging (optional, later phase):** wrap the same PWA in Tauri (preferred over Electron for smaller footprint) if a taskbar-native app is desired.
- **Native mobile (deferred):** if push adoption or offline-first ticket drafting becomes essential, a React Native app can reuse business logic via the same REST API — explicitly future scope, not v1 (see 10.3 and Roadmap Phase 5).

---

# PART VII — DATA MODEL

## 7.1 Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ TICKET : creates
    USER ||--o{ TICKET : "assigned to"
    USER }o--|| DEPARTMENT : belongs_to
    USER }o--o{ TEAM : member_of
    ROLE ||--o{ USER : assigned_to
    ROLE ||--o{ PERMISSION : grants

    TICKET }o--|| TICKET_TYPE : classified_as
    TICKET }o--|| CATEGORY : categorized_as
    TICKET }o--|| STATUS : has
    TICKET }o--|| PRIORITY : has
    TICKET }o--|| SLA_POLICY : governed_by
    TICKET ||--o{ COMMENT : has
    TICKET ||--o{ ATTACHMENT : has
    TICKET }o--o{ ASSET : linked_to
    TICKET }o--o| PROBLEM : caused_by
    TICKET ||--o{ CUSTOM_FIELD_VALUE : has

    PROBLEM ||--o{ TICKET : links
    PROBLEM ||--o{ CUSTOM_FIELD_VALUE : has

    CHANGE_REQUEST ||--o{ APPROVAL_REQUEST : requires
    CHANGE_REQUEST }o--o{ ASSET : affects
    CHANGE_REQUEST }o--o| TICKET : originated_from

    ASSET }o--|| ASSET_TYPE : typed_as
    ASSET }o--|| USER : assigned_to
    ASSET ||--o{ CUSTOM_FIELD_VALUE : has
    ASSET }o--o{ ASSET : related_to

    KNOWLEDGE_ARTICLE }o--|| CATEGORY : categorized_as
    KNOWLEDGE_ARTICLE ||--o{ ARTICLE_FEEDBACK : receives

    AUTOMATION_RULE ||--o{ AUTOMATION_CONDITION : has
    AUTOMATION_RULE ||--o{ AUTOMATION_ACTION : has
    AUTOMATION_RULE ||--o{ AUTOMATION_EXECUTION_LOG : produces

    APPROVAL_REQUEST }o--|| USER : "approver"

    AUDIT_LOG }o--|| USER : "actor"
```

## 7.2 Core Table Definitions

| Entity                      | Key Attributes                                                                                                                                                          | Notes                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **User**                    | id, name, email, password_hash (nullable if SSO-only), role_id, department_id, mfa_secret, status (active/disabled), created_at                                         |                                     |
| **Role**                    | id, name, is_system_role (bool)                                                                                                                                         | Editable/cloneable, never hardcoded |
| **Permission**              | id, key (e.g. `ticket.edit.assigned`), description                                                                                                                      | Seeded, referenced by code          |
| **RolePermission**          | role_id, permission_id                                                                                                                                                  | Join table                          |
| **Department / Team**       | id, name, parent_department_id (optional hierarchy)                                                                                                                     |                                     |
| **Ticket**                  | id, title, description (rich text), type_id, category_id, status_id, priority_id, requester_id, assignee_id, team_id, sla_policy_id, created_at, resolved_at, closed_at |                                     |
| **TicketType**              | id, name, default_status_workflow_id                                                                                                                                    | Incident / Service Request / etc.   |
| **Category**                | id, name, parent_category_id                                                                                                                                            | Multi-level via self-reference      |
| **Status / StatusWorkflow** | id, name, workflow_id, is_terminal                                                                                                                                      | Configurable per Ticket Type (3.3)  |
| **Priority**                | id, name, weight                                                                                                                                                        | Derived via Impact×Urgency matrix   |
| **SLAPolicy**               | id, name, scope (SLA/OLA), conditions (JSON), response_target_mins, resolution_target_mins, calendar_id                                                                 |                                     |
| **BusinessCalendar**        | id, name, working_hours (JSON), holidays (JSON), timezone                                                                                                               |                                     |
| **Comment**                 | id, ticket_id, author_id, body, is_internal (bool), created_at                                                                                                          |                                     |
| **Attachment**              | id, file_name, file_path/object_key, mime_type, uploaded_at, owner_type (Ticket/Asset/KB), owner_id                                                                     |                                     |
| **Asset**                   | id, asset_tag, asset_type_id, model, serial, status, assigned_user_id, department_id, purchase_date, warranty_expiry                                                    |                                     |
| **AssetType**               | id, name                                                                                                                                                                | Drives which custom fields apply    |
| **Problem**                 | id, title, description, status, root_cause, workaround, known_error (bool)                                                                                              |                                     |
| **ChangeRequest**           | id, title, type (Standard/Normal/Emergency), risk_level, status, scheduled_start, scheduled_end, rollback_plan                                                          |                                     |
| **ApprovalRequest**         | id, approvable_type, approvable_id, approver_id, sequence_order, status (Pending/Approved/Rejected), decided_at                                                         |                                     |
| **KnowledgeArticle**        | id, title, body, category_id, visibility, status, version                                                                                                               |                                     |
| **ArticleFeedback**         | id, article_id, user_id, helpful (bool), comment                                                                                                                        |                                     |
| **CustomField**             | id, label, field_type, applies_to (Ticket/Asset/etc.), scope_id (type/catalog item), required, validation                                                               |                                     |
| **CustomFieldValue**        | id, custom_field_id, entity_type, entity_id, value                                                                                                                      | EAV pattern                         |
| **AutomationRule**          | id, name, trigger_type, priority_order, enabled                                                                                                                         |                                     |
| **AutomationCondition**     | id, rule_id, field, operator, value, group (AND/OR)                                                                                                                     |                                     |
| **AutomationAction**        | id, rule_id, action_type, params (JSON), order                                                                                                                          |                                     |
| **AutomationExecutionLog**  | id, rule_id, ticket_id, result (success/fail), error_message, executed_at                                                                                               | Article VII                         |
| **NotificationTemplate**    | id, event_type, channel, subject, body_template                                                                                                                         |                                     |
| **AuditLog**                | id, actor_id, action, entity_type, entity_id, diff (JSON), ip_address, created_at                                                                                       | Immutable                           |
| **OrgSettings**             | key, value                                                                                                                                                              | Branding, retention policy, etc.    |

---

# PART VIII — API DESIGN

## 8.1 Conventions

- Base path: `/api/v1/…` — versioned from day one (Article I).
- Auth: `Authorization: Bearer <token>` or session cookie for first-party web client; distinct API keys for service accounts.
- Standard envelope: `{ "data": ..., "meta": {...}, "errors": [...] }`.
- Pagination: cursor or page/limit query params on all list endpoints; consistent across modules.
- Filtering/sorting: `?filter[status]=open&sort=-created_at` convention applied uniformly.

## 8.2 Representative Endpoint Groups

| Group           | Endpoints (representative, not exhaustive)                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth            | `POST /auth/login`, `POST /auth/logout`, `POST /auth/mfa/verify`, `GET /auth/sso/callback`                                                       |
| Tickets         | `GET/POST /tickets`, `GET/PATCH /tickets/{id}`, `POST /tickets/{id}/comments`, `POST /tickets/{id}/attachments`, `POST /tickets/{id}/transition` |
| Service Catalog | `GET /catalog`, `GET /catalog/{id}/form`, `POST /catalog/{id}/request`                                                                           |
| Assets          | `GET/POST /assets`, `GET/PATCH /assets/{id}`, `POST /assets/import`                                                                              |
| Problems        | `GET/POST /problems`, `POST /problems/{id}/link-ticket/{ticketId}`                                                                               |
| Changes         | `GET/POST /changes`, `POST /changes/{id}/approve`, `GET /changes/calendar`                                                                       |
| Knowledge       | `GET /kb/articles`, `GET /kb/search?q=`, `POST /kb/articles/{id}/feedback`                                                                       |
| Automation      | `GET/POST /admin/automation-rules`, `GET /admin/automation-rules/{id}/logs`                                                                      |
| Reporting       | `GET /reports/dashboards/{id}`, `POST /reports/custom`, `GET /reports/export.csv`                                                                |
| Admin/RBAC      | `GET/POST /admin/roles`, `PATCH /admin/roles/{id}/permissions`, `GET /admin/audit-log`                                                           |
| Webhooks        | `POST /webhooks/inbound/{integrationId}` (external → us), Admin-configured outbound targets stored under `/admin/integrations`                   |
| Realtime        | `WS /realtime` — subscribes to ticket/queue channels                                                                                             |

## 8.3 Webhooks (Outbound Contract)

Every outbound webhook payload carries: `event`, `timestamp`, `data` (the affected entity), and an `X-Signature` HMAC header (secret configured per integration) so receivers can verify authenticity.

---

# PART IX — UI/UX SPECIFICATION & PROTOTYPES

## 9.1 Design Principles

- **Mobile-first, responsive breakpoints:** design for a 375px viewport first, then expand — this guarantees the desktop layout is a superset, never an afterthought.
- **Accessibility:** WCAG 2.1 AA minimum — keyboard navigable, sufficient contrast, ARIA labels on icon-only buttons.
- **Consistency:** one component library (Part X) used everywhere; no bespoke one-off widgets.
- **Speed:** ticket list and detail views must feel instant — optimistic UI updates for comments/status changes, real-time sync (6.3) to reconcile.

## 9.2 Navigation Structure

```
┌─ Top Bar: Logo | Global Search | Notifications 🔔 | Profile ▾
├─ Left Nav (collapsible, icon-only on mobile → bottom tab bar)
│   ├─ Dashboard
│   ├─ Tickets (My / Team / All — scoped by permission)
│   ├─ Service Catalog
│   ├─ Assets
│   ├─ Problems         (role-gated)
│   ├─ Changes          (role-gated)
│   ├─ Knowledge Base
│   ├─ Reports
│   └─ Admin            (role-gated: Fields, Workflows, Automation, Roles, Integrations)
```

## 9.3 Wireframe — Requester: Self-Service Home (Mobile, 375px)

```
┌───────────────────────────┐
│ ☰   IT Support        🔔  │
├───────────────────────────┤
│  🔍  Search help & tickets │
├───────────────────────────┤
│  Quick Actions             │
│  ┌───────┐ ┌───────┐      │
│  │ 🔑    │ │ 💻    │      │
│  │Reset  │ │Request│      │
│  │Password│ │Hardware│    │
│  └───────┘ └───────┘      │
│  ┌───────┐ ┌───────┐      │
│  │ 🌐    │ │ ➕    │      │
│  │Network│ │ Other │      │
│  │ Issue │ │ Issue │      │
│  └───────┘ └───────┘      │
├───────────────────────────┤
│  My Open Tickets (2)       │
│  ┌─────────────────────┐  │
│  │ #1042  Laptop screen │  │
│  │ 🟡 In Progress        │  │
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │ #1039  VPN access    │  │
│  │ 🔵 Pending You        │  │
│  └─────────────────────┘  │
├───────────────────────────┤
│ [Home] [Tickets] [KB] [Me] │  ← bottom tab bar
└───────────────────────────┘
```

## 9.4 Wireframe — Technician Console (Desktop, 3-pane)

```
┌──────────────────────────────────────────────────────────────────────┐
│ IT Support Portal        🔍 Search        🔔3   ⚙        [Avatar ▾]  │
├───────────┬──────────────────────────────┬───────────────────────────┤
│ Queues    │ Ticket List (filtered)         │ Ticket Detail (#1042)     │
│           │ ─────────────────────────────  │ ───────────────────────  │
│ ▸ My      │ #1042 Laptop screen  🔴High     │ Laptop screen flickering │
│   Open(5) │ #1039 VPN access     🟡Med      │ Requester: J. Perera      │
│ ▸ Team    │ #1031 Printer jam    🟢Low      │ Status: [In Progress ▾]  │
│   Queue(12)│ #1028 New laptop     🟡Med      │ Priority: High  SLA: 2h  │
│ ▸ Unassigned(3)│ ...                        │ ───────────────────────  │
│           │                                 │ Linked Asset: LAP-0231    │
│ Filters:  │                                 │ ───────────────────────  │
│ Status ▾  │                                 │ 💬 Reply / 📝 Internal   │
│ Priority ▾│                                 │ [Insert KB article] [Macro▾]│
│ Category ▾│                                 │ [   reply text box    ]  │
└───────────┴──────────────────────────────┴───────────────────────────┘
```

## 9.5 Wireframe — Admin: Visual Workflow Builder

```
┌──────────────────────────────────────────────────────────────┐
│ Admin > Ticket Types > Incident > Workflow                    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│   ( New ) ──▶ ( Open ) ──▶ ( In Progress ) ──▶ ( Resolved )   │
│                    │              │                  │        │
│                    ▼              ▼                  ▼        │
│              ( Pending User ) ( Pending Vendor )  ( Closed )   │
│                                                       │        │
│                                                       ▼        │
│                                                  ( Reopened )  │
│                                                                │
│  [+ Add Status]   [+ Add Transition]   Selected: In Progress→Resolved │
│  Transition rules:                                            │
│    Allowed roles: [Technician, Team Lead]                     │
│    Required field on transition: [Resolution Notes ✓]         │
└──────────────────────────────────────────────────────────────┘
```

## 9.6 Wireframe — Admin: Role & Permission Matrix

```
┌───────────────────────────────────────────────────────────┐
│ Admin > Roles > Technician                                  │
├───────────────────────────────────────────────────────────┤
│ Permission                         │ Own │ Team │ All      │
│ ───────────────────────────────────┼─────┼──────┼───────── │
│ View tickets                       │ ✅  │ ✅   │ ⬜        │
│ Edit ticket status                 │ ✅  │ ⬜   │ ⬜        │
│ Delete ticket                      │ ⬜  │ ⬜   │ ⬜        │
│ Manage automations                 │ ⬜  │ ⬜   │ ⬜        │
│                                     │      [Save Role]      │
└───────────────────────────────────────────────────────────┘
```

## 9.7 Ticket Lifecycle Flow (User Journey)

```mermaid
flowchart LR
    A[Requester submits ticket] --> B{Matches KB article?}
    B -- Yes, self-resolved --> Z[No ticket needed]
    B -- No --> C[Ticket Created: New]
    C --> D[Automation: Auto-categorize + Auto-assign]
    D --> E[Technician: Open / In Progress]
    E --> F{Needs more info?}
    F -- Yes --> G[Pending Customer]
    G --> E
    F -- No --> H[Resolved]
    H --> I{Customer confirms?}
    I -- Reopens --> E
    I -- Confirms/Timeout --> J[Closed]
    J --> K[CSAT Survey Sent]
```

## 9.8 Component Library

Use a single design system (Part X specifies shadcn/ui + Tailwind) so every prototype above maps directly to real, reusable components (Button, DataTable, Kanban/Board, Timeline, FormBuilder, StatusBadge, WorkflowGraph). No bespoke CSS per screen.

---

# PART X — TECHNOLOGY STACK

| Layer            | Recommendation                                                                                     | Rationale                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend          | **Node.js + NestJS** (TypeScript) _or_ **Python + FastAPI**                                        | Both offer strong typing/validation and OpenAPI generation for free (supports Article I). Pick one per team's existing skill; document choice as ADR-000. |
| Frontend (Web)   | **React + TypeScript**, Vite build, **Tailwind CSS + shadcn/ui**                                   | Matches original spec's SPA requirement; shadcn/ui gives accessible, themeable components out of the box (supports 3.6, 9.1).                             |
| State/data       | React Query (server-state) + minimal client state (Zustand/Context)                                | Keeps API as single source of truth (Article I).                                                                                                          |
| Mobile           | **PWA** (installable, offline shell, push) from the same React codebase                            | Satisfies "mobile friendly" without a second codebase; native app deferred (see 10.3)                                                                     |
| Desktop          | Same responsive web app; optional **Tauri** wrapper later                                          | Avoids Electron bloat if a taskbar app is ever wanted                                                                                                     |
| Database         | **PostgreSQL 15+**                                                                                 | Relational integrity for users/tickets/assets; JSONB support covers CustomFieldValue/automation condition storage                                         |
| Cache/Queue      | **Redis** (+ BullMQ if Node / Celery if Python)                                                    | Automation queue, SLA ticking, WebSocket pub/sub                                                                                                          |
| Search           | Postgres full-text (`tsvector`) v1; OpenSearch as documented future swap                           | Simplicity first (Article VIII)                                                                                                                           |
| File Storage     | Abstracted `StorageProvider`: local disk (v1) → S3/MinIO-compatible (future)                       | Corrects original spec's hard dependency on local disk                                                                                                    |
| Realtime         | WebSocket via Socket.IO or native `ws`, fanned out through Redis pub/sub                           | Multi-instance safe                                                                                                                                       |
| Auth             | Passport.js/Authlib strategies for Local, SAML, OIDC, LDAP                                         | Pluggable per 5.1                                                                                                                                         |
| Containerization | **Docker** + **Docker Compose** (small deployment); Kubernetes manifests optional for future scale | Matches original spec, keeps small-org deployment simple                                                                                                  |
| CI/CD            | GitHub Actions (lint, test, build, push image)                                                     | Already using GitHub per org tooling                                                                                                                      |
| Observability    | Structured JSON logging + Prometheus metrics endpoint + Grafana (optional)                         | Supports Article VII (visible failures)                                                                                                                   |

## 10.3 Note on Native Mobile Apps

A responsive PWA is the v1 mobile strategy (Article V — single data model, single codebase). If offline ticket drafting or deep OS integration (share-sheet "raise a ticket from this screenshot") becomes a hard requirement, a React Native app is the natural Phase 5 extension, reusing the same REST API and TypeScript types — this is documented so the choice is deliberate, not a gap.

---

# PART XI — NON-FUNCTIONAL REQUIREMENTS

| Category        | Requirement                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Performance     | Ticket list/detail loads < 1s on broadband; API p95 < 300ms for standard CRUD                                       |
| Scalability     | Stateless app layer (horizontally scalable behind the reverse proxy); session state in Redis, not in-process        |
| Availability    | Target 99.5% for an in-house tool; documented RTO/RPO once hosting is finalized                                     |
| Backups         | Nightly encrypted DB dump + continuous file-storage sync (e.g., rclone per original spec), tested restore quarterly |
| Accessibility   | WCAG 2.1 AA                                                                                                         |
| Browser Support | Last 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari and Android Chrome for mobile                          |
| Localization    | English v1; UI strings externalized (i18n-ready) so additional languages are a translation task, not a rebuild      |
| Data Retention  | Configurable per-entity retention (e.g., closed tickets purge/archive after N months) to support compliance (5.9)   |

---

# PART XII — DEVELOPMENT ROADMAP

| Phase                    | Scope                                                                                                                                                          | Depends On |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Phase 0 — Foundation** | Repo scaffold, CI/CD, Docker Compose dev environment, DB schema migration tooling, base auth (local), RBAC skeleton                                            | —          |
| **Phase 1 — MVP (P0)**   | Incident + Service Request ticketing, unified workflow, basic categorization, attachments, My Tickets self-service, basic email notifications, core RBAC roles | Phase 0    |
| **Phase 2 (P1)**         | Asset/CMDB, SLA/OLA engine + business calendars, Knowledge Base, Service Catalog with dynamic forms, CSAT surveys                                              | Phase 1    |
| **Phase 3 (P2)**         | Automation/Business Rules engine, Custom Fields engine, Custom Report/Dashboard builder, approval workflows, SSO/MFA                                           | Phase 2    |
| **Phase 4 (P2/P3)**      | Problem Management, Change Enablement + Change Calendar, inbound/outbound webhook integrations, email-to-ticket                                                | Phase 3    |
| **Phase 5 (P3+)**        | PWA polish + push notifications, optional Tauri desktop packaging, optional native mobile app, OpenSearch swap-in if needed, advanced compliance/reporting     | Phase 4    |

Each phase ends with a demo against this document's relevant Part, and any deviation is logged per Part XIV.

---

# PART XIII — TESTING STRATEGY

- **Unit tests:** business logic (SLA calculation, automation condition evaluation, permission checks) — target high coverage on these specifically, not a blanket %.
- **Integration tests:** API endpoints against a real test database (containerized Postgres), including RBAC enforcement tests (a Requester token must never succeed on an Admin-only endpoint).
- **E2E tests:** critical user journeys (raise ticket → agent resolves → CSAT) via Playwright, run against a staging build in CI.
- **Automation engine tests:** rule evaluation is pure-function testable — every Trigger/Condition/Action combination used in seed data must have a test.
- **Security testing:** automated security scanning in CI plus periodic manual review of the RBAC matrix vs. Part V. Specifically:
  - **SAST** on every pull request (fast pipeline scan, blocking on High and above) and a full policy scan on `main` and weekly.
  - **SCA** — dependency vulnerability scanning, covering both the advisory feed and license posture.
  - **Secret scanning** on every push.
  - **DAST** — deferred until a hosted environment exists; it becomes a release gate at the cloud-hosting milestone, not before. See ADR-0014.
  - A scan finding that is not a genuine defect is dismissed with a written mitigation rationale, never left unreviewed. A gate nobody trusts is worse than no gate.
- **Seed data:** a fixture set (users across all roles, sample tickets in every status, sample assets) so every environment demoes identically.

---

# PART XIV — GOVERNANCE & AMENDMENT PROCESS

1. This document is versioned (semantic: MAJOR.MINOR). Any change to Part I (Principles) is MAJOR; additions to modules/fields are MINOR.
2. Any deviation discovered necessary during implementation must be captured as an **Architecture Decision Record** (short: context, decision, consequences) and linked back to the relevant Part/Article here — the spec is corrected to match reality, not silently ignored.
3. No module ships that contradicts Part I Articles without an explicit, written exception in an ADR.

---

# APPENDICES

## Appendix A — Glossary (ITIL 4 Terms)

| Term              | Meaning                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Incident          | An unplanned interruption to a service or reduction in quality                             |
| Service Request   | A formal request for something to be provided (access, information, standard change)       |
| Problem           | A cause, or potential cause, of one or more incidents                                      |
| Known Error       | A problem that has a documented root cause and workaround                                  |
| Change Enablement | The practice of managing risk when making changes to services                              |
| CMDB              | Configuration Management Database — a store of configuration items and their relationships |
| SLA               | Service Level Agreement — a target agreed with the customer/business                       |
| OLA               | Operational Level Agreement — a target between internal teams                              |
| CAB               | Change Advisory Board — group that reviews Normal changes                                  |
| Major Incident    | A high-impact incident requiring a dedicated, expedited response                           |

## Appendix B — Full Permission Matrix

_(To be maintained as a living table in the Admin > Roles UI once built — the abridged version in 5.2 is illustrative; the UI-generated matrix is the authoritative one going forward, per Article II.)_

## Appendix C — Original Specification Cross-Reference

This document is a superset of and fully preserves the original "In-House Support Portal Specification": Unified Ticketing → 2.1/2.2; Asset Linking → 2.6; Self-Service Portal → 2.8; System Architecture diagram → 6.1 (extended); Data Model table → 7.2 (extended); Technology Stack → Part X (extended and corrected for file-storage abstraction and multi-platform support).

---

_End of document. This specification is the working constitution for development — treat any conflicting instruction encountered mid-build as a signal to raise an ADR, not to silently override this document._
