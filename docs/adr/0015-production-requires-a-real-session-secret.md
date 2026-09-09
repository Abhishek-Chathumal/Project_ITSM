# ADR-0015: Production refuses to boot without a real `SESSION_SECRET`

**Status:** Accepted
**Relates to:** Constitution Article VII (Fail Safe, Not Silent), Part V.7 (CSRF), Part XIII (Security testing)

## Context

`apps/api/src/config/configuration.ts` resolved the session secret with a fallback:

```ts
sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
```

That value is not decorative. It signs the session cookie (`session.middleware.ts:16`) and
seeds the CSRF tokens (`csrf.middleware.ts:11`). With it known, an attacker can mint a
session cookie the server accepts and a CSRF token that passes the double-submit check —
the two controls that stand between an anonymous request and an authenticated one, both
keyed on a string committed to a public repository.

Nothing failed, which was the problem: an API booted without `SESSION_SECRET` came up
looking healthy and served traffic that only appeared protected.

The deploy path made it worse rather than better. `docker-compose.yml` runs
`NODE_ENV: production` and supplied its own default:

```yaml
SESSION_SECRET: ${SESSION_SECRET:-change-me-to-a-long-random-string}
```

So the production stack never reached the code fallback — it substituted a _different_
published placeholder, from `.env.example`, and that one is 33 characters. A presence check
would have passed it, and so would a naive length check. Both were therefore insufficient
on their own.

Veracode SAST had been reporting this the whole time as CWE-259 (Use of Hard-coded
Password), severity Medium, at `configuration.ts:16`. It sat below the High-and-above
pipeline gate, so every PR went green while the policy scan on `main` reported "Did Not
Pass". The finding only became reviewable once ADR-0014's scan started publishing the full
`results.json` (PR #9) rather than just the gate breaches. Part XIII requires a finding to
be fixed or dismissed with a written rationale, never left unreviewed; this one is a
genuine defect, so it is fixed here rather than dismissed.

## Decision

Two independent layers, because either alone leaves a gap.

**The application validates at boot.** `resolveSessionSecret(nodeEnv)` runs inside the
config factory, which `ConfigModule.forRoot` evaluates during `NestFactory.create` — so a
throw aborts startup before the app binds a port or accepts a request. When
`NODE_ENV === 'production'` the secret is rejected if it is missing or blank, if it matches
a known published placeholder (case-insensitively), or if it is shorter than 32 characters.
Error messages state the remedy (`openssl rand -base64 48`) and never echo the secret
itself, only its length, because they land in the logs.

Outside production the stable dev fallback is kept deliberately, so a local login survives
the frequent restarts of `nest start --watch`.

**Compose stops supplying a default.** `SESSION_SECRET: ${SESSION_SECRET:?...}` makes the
production stack fail during interpolation, before an image is even started, with a message
pointing at `.env.example`.

Rejected alternatives:

- **Generate a random dev secret at boot, removing the literal entirely.** This clears
  CWE-259 at the source with no suppression, which is attractive. Rejected because dev
  sessions would then break on every watch-mode reload, which is most code edits — a
  standing tax on the maintainer to satisfy a scanner about a value that production can no
  longer reach.
- **Validate presence only.** Would have been defeated by the compose default, which is
  exactly the path a real deployment takes.
- **Dismiss the finding with a mitigation rationale.** Available under Part XIII, but the
  silent-insecure-default was a real defect, not a false positive.

## Consequences

- **A deploy that forgot the secret now fails loudly instead of running insecurely.**
  Verified, not inferred: `docker compose config` with `SESSION_SECRET` unset errors with
  `required variable SESSION_SECRET is missing a value: set SESSION_SECRET in .env, see
.env.example`; and the built API under `NODE_ENV=production` with the compose placeholder
  exits 1 during `NestFactory.create` with
  `SESSION_SECRET is still a placeholder from the setup docs, so it is public.` — before
  any database connection is attempted. A strong secret, and development with no secret at
  all, both proceed past config normally.
- **This is a breaking change for any existing deployment** that relied on the compose
  default. That is the intent: such a deployment has a publicly-known signing key and
  should stop until it is given a real one. Rotating the secret invalidates all live
  sessions, so every user re-authenticates once.
- 12 unit tests cover the resolver, including both placeholders, the case-insensitive
  match, the length floor, the whitespace trim, and the assertion that the secret never
  appears in the thrown message.
- The CI smoke secret was exactly 32 characters and so cleared the new floor only by
  coincidence; it was lengthened to make the intent explicit and keep the floor free to
  rise.
- `.env.example` still ships the placeholder — it is the right value for local development
  — but now says in place that production rejects it.
- **The Medium SAST finding does not clear, and is dismissed here rather than fixed
  further.** Measured on this change's own pipeline scan: CWE-259 simply retargets from the
  old fallback to `DEV_SESSION_SECRET` at `configuration.ts:15`, because a hard-coded string
  is still literally present. It stays below the High-and-above gate.

  This is the written mitigation rationale Part XIII requires, so the finding is reviewed
  rather than unreviewed: the literal cannot be used in production, because
  `resolveSessionSecret` rejects it there by name — it is in `PUBLISHED_SESSION_SECRETS` —
  and a unit test asserts that; and the production deploy path can no longer supply any
  value silently at all. What remains is a development convenience with no production
  reachability. Clearing it outright would mean the random-per-boot dev secret rejected
  above, trading a real maintainer cost for a scanner's satisfaction.

  **Confirmed after merge:** `sast-policy` on `main` ended `Did Not Pass` on exactly this
  Medium, with the scan itself healthy. So this is a known disposition with a rationale
  attached rather than an unexplained red — but the policy scan's verdict is not a usable
  signal while it stands, and `sast-findings` is what to read instead.

  Writing the rationale here satisfies Part XIII's intent but does not reach Veracode, which
  still counts the finding against policy. **The step that actually clears it** is approving
  a mitigation on the finding in the Veracode platform (latest static scan → the CWE-259
  finding → Mitigate by Design, citing this ADR). That needs platform access and an approver
  role, so it can be done neither from CI nor by an agent. Tracked in PROJECT_STATE §4.
