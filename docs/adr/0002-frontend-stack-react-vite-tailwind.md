# ADR-0002: Frontend stack — React + Vite + TypeScript + Tailwind CSS

**Status:** Accepted
**Relates to:** Constitution Part X (Technology Stack), Part IX (UI/UX Specification), Article V/VI

## Context

Part X names React + TypeScript + Vite + Tailwind CSS + shadcn/ui as the recommended web stack, satisfying the original spec's SPA requirement and Part IX's mobile-first, accessible, single-design-system principles.

## Decision

Build `apps/web` as a React 18 + TypeScript + Vite SPA, styled with Tailwind CSS using CSS-variable-driven design tokens (background/foreground/card/border/primary/muted/destructive) so light/dark theming (3.6) and future rebranding are a token swap, not a rewrite. React Query owns server state; Zustand owns small UI-only state (theme, nav-collapsed) — this keeps the API as the single source of truth for data (Article I) while avoiding Redux-scale ceremony for a handful of client-only preferences.

shadcn/ui's copy-in-source model is followed in spirit: rather than pulling shadcn's CLI-generated components verbatim in Phase 0, a small hand-built `components/ui/` set (Button, Input, Card, Switch) uses the same Tailwind-variable conventions, so real shadcn components can be dropped in later without a design-token migration.

## Consequences

- Every screen composes from `components/ui/` primitives and the shared Tailwind tokens — no bespoke one-off CSS per screen (Part IX.1).
- The permission-aware nav (`side-nav.tsx`) reads the same `PERMISSIONS` constants the API enforces, from `packages/shared` — UI gating is explicitly documented as UX-only; the server re-checks every request (Part V.2).
- Because this is a token-driven system, later UI/theme rewrites (expected as the project evolves) can replace individual components or the token palette without touching the auth/RBAC wiring underneath.
