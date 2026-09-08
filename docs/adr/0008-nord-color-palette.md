# ADR-0008: Nord color palette for light/dark theming

**Status:** Accepted
**Relates to:** Constitution Part 3.6 (Branding/Theming), Part IX.1 (Design Principles)

## Context

Part 3.6 requires light/dark mode as a baseline personalization feature, themed via CSS variables applied at runtime. The initial Phase 0 scaffold used a generic slate/blue palette; the project owner requested a Nord-inspired look instead.

## Decision

Adopt the [Nord](https://www.nordtheme.com) palette for both themes, mapped onto the existing Tailwind CSS-variable tokens in `apps/web/src/styles/globals.css`:

- **Light:** background/border from Snow Storm (nord4–nord6), foreground from Polar Night (nord0), primary accent from Frost (nord10).
- **Dark:** background/card from Polar Night (nord0–nord2), foreground from Snow Storm (nord6), primary accent from a lighter Frost tone (nord8) for contrast against the dark background.
- **Destructive** uses Aurora red (nord11) in both themes.

Because theming is already token-driven (Article II/3.6 — no component hardcodes a color), this was a CSS-variable-only change; no component code changed.

## Consequences

- Any future rebrand or palette change is again a token edit in `globals.css`, not a component rewrite.
- The browser `theme-color` meta tag was updated to Nord's Polar Night (`#2E3440`) to match the dark background for mobile browser chrome.
