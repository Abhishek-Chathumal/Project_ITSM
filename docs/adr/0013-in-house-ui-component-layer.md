# ADR-0013: An in-house, token-driven UI component layer

**Status:** Accepted
**Relates to:** Constitution Part IX (UI/UX), ADR-0002, ADR-0008

## Context

Phase 0's frontend was a placeholder: a text-only sidebar with no routing, a two-item top
bar, and a dashboard that was one paragraph in a card. Phase 1 needs list views with
sorting and filtering, a record-detail layout, status and priority indicators, tabbed
work areas and KPI tiles — none of which existed.

The maintainer supplied screenshots of Motadata ServiceOps as a reference for the target
density and layout language, explicitly as inspiration rather than a specification.

Two standing constraints shape the answer. The constitution expects **significant UI
churn** as the maintainer iterates, and requires the **security core to stay decoupled
from presentation**. Whatever gets built has to be cheap to restyle and must not become
a place where authorization logic accumulates.

## Decision

A small in-house component layer under `apps/web/src/components/ui`, built on the
existing Nord token system, rather than adopting a component library.

**Tokens carry every colour.** `globals.css` gained semantic tones — `success`, `warning`,
`danger`, `info`, `accent`, each with a `-subtle` companion for fills — plus `sidebar`,
`hover` and `ring` surfaces. Components take a `tone` prop meaning _danger_, never a
class meaning _red_. A restyle stays an edit to one file.

**Primitives:** `Badge`/`StatusDot`/`IdChip`, `Avatar`, `Table`, `Tabs`/`TabPanel`,
`DropdownMenu`, `StatTile`, `IconButton`, `Skeleton`/`EmptyState`/`ErrorState`, and an
extended `Button`. Icons are hand-rolled SVGs in `components/layout/icons.tsx`.

**Shell:** a permission-gated sidebar driven by a `NAV_SECTIONS` data model, collapsible
to an icon rail (persisted) and an overlay drawer on mobile; a top bar with a create menu,
theme toggle and account menu; and a `PageHeader` every page shares.

Why not a library (shadcn/ui, MUI, Mantine, Radix):

- The whole set above is a few hundred lines with no runtime dependency. MUI or Mantine
  would be a large addition to the production bundle and a standing supply-chain surface,
  against a project whose first Phase 1 task was cutting advisories to zero.
- Every library brings its own theming model, which would sit awkwardly beside — or
  quietly replace — the Nord token system that ADR-0008 settled on.
- The components a service desk needs are mostly _dense data display_, which is where
  general-purpose libraries help least and impose the most layout opinion.

This is not a permanent rejection. The point at which a library starts paying for itself
is **focus-trapped modals, comboboxes and date pickers** — accessibility-heavy widgets
that are genuinely hard to get right. When Phase 1 needs those, adopting Radix primitives
for those specific components is the expected move, and the `tone`-based API here is
deliberately compatible with that.

## Consequences

- Phase 1 screens compose existing primitives rather than inventing markup, and the
  ServiceOps-style density is available without hand-tuning each screen.
- **Accessibility is our responsibility now.** `DropdownMenu` implements Escape,
  click-outside and focus return; `Tabs` implements the WAI-ARIA arrow-key pattern;
  `IconButton` makes its `label` a required prop. New primitives are held to that bar,
  and the interactive ones carry tests (20 web tests, up from 1).
- Nav entries for modules that don't exist render disabled with a "Soon" tag rather than
  as dead links, and are still permission-gated — a role with no grants sees no
  Administration section at all. This is UX only; `PermissionGuard` remains the boundary.
- The dashboard reads **live counts** from the Phase 0 endpoints, each query gated on the
  caller's permission. Ticket metrics have no source yet and say "Phase 1" instead of
  rendering a `0`, which `StatTile` distinguishes from both a loading state and a real
  zero. Inventing plausible-looking numbers on an ITSM dashboard would be actively
  misleading.
- Light mode moved to white surfaces on a light-grey page. Nord's Snow Storm steps are
  close enough in value that using two of them for page and card left surfaces
  indistinguishable in practice.
