# ADR-0014: Veracode SAST and SCA in CI; DAST deferred to the hosting milestone

**Status:** Accepted
**Relates to:** Constitution Part XIII (Testing Strategy, amended to 1.1 by this ADR), Part V (Security)

## Context

CI checked four things: ESLint, `tsc`, unit tests, and container smoke tests, plus
GitGuardian for secrets. All of that is about correctness and leaked credentials. **No
tool looked at our own code for vulnerabilities**, and Part XIII said only "dependency
vulnerability scanning in CI", which was itself not actually implemented.

The maintainer has a Veracode account covering SAST, SCA and DAST, and asked whether it
was worth wiring into the development loop.

Timing is the strongest argument for doing it now rather than later. Phase 1 adds **file
attachments** to tickets. Unrestricted upload, path traversal via filenames,
content-type confusion, and storage-path escape are the most reliable vulnerability
surface a service desk has, and they are squarely what SAST detects. Installing the
scanner before that code is written is worth considerably more than adding it after.

The project is also destined for cloud hosting, and "security is a standing top priority
at every phase" is an explicit maintainer constraint.

## Decision

**SAST — adopt now, two cadences.** Veracode's full policy scan takes tens of minutes,
which would ruin PR feedback. So: Pipeline Scan on every pull request, and the full
policy scan on `main`, weekly, and on demand.

**SCA — adopt as a supplement, not a replacement.** Veracode SCA adds a different
advisory database, license posture, and reachability analysis. It is gated on its own
credential and skips cleanly when absent.

**DAST — deferred, deliberately.** It needs a reachable running target. Today the app is
~11 endpoints behind session auth on localhost, which would require Veracode's internal
scanning agent for a small return. What DAST is uniquely good at — TLS configuration,
security headers as actually served, cookie flags, runtime auth bypass — only becomes a
live risk once something is deployed. Part XIII now makes DAST a release gate at the
cloud-hosting milestone.

**Gate on High and above only.** The realistic failure mode of a scanner is not missed
findings, it is 200 unreviewed findings that everyone learns to ignore. For a solo
maintainer a credible narrow gate beats a broad one that gets bypassed. Part XIII also
now requires that a dismissed finding carries a written mitigation rationale.

### Implementation notes worth keeping

- **Trigger is `pull_request`, never `pull_request_target`.** The repository is public.
  `pull_request_target` runs with secrets available to code the fork controls, which
  would disclose the Veracode credentials to anyone who opens a PR. Fork PRs therefore
  show these jobs as skipped, which is correct.
- **Every job is gated on its secret being present**, resolved in a `preflight` job
  because the `secrets` context is not available in a job-level `if`. Merging the
  workflow cannot break CI before the secrets are configured.
- **Node must be installed before `veracode package`.** Verified in a Linux container
  against this repo: without Node the CLI reports that npm is unavailable and silently
  degrades to a generic JavaScript package instead of running the NpmPackager. It fails
  quietly, and would have produced materially worse scan coverage with no error.
- **The artifact filename is derived from the source directory basename**, so it is the
  repository name on a runner. The workflow normalises the root artifact to
  `veracode-app.zip` and fails loudly listing what was produced if it is missing, rather
  than hardcoding a name that only held in local testing.
- Packaging emits four artifacts (root, api, web, shared). The root one contains all 94
  source files across every workspace, so a single scan covers the monorepo.
- `packages/shared` must be built before packaging — the other workspaces import from its
  `dist`, and the packager's per-workspace builds fail without it.

Rejected: **GitHub CodeQL**, which is free on this public repository and covers much of
the same JS/TS ground. Not rejected on merit — it is complementary and costs nothing —
but the maintainer chose to consolidate on the tool already paid for. Worth revisiting if
Veracode's PR-time feedback proves too slow.

## Consequences

- SAST findings of High or above block a PR. Everything below is reported without
  failing, and needs periodic review or it accumulates unseen.
- **Scan quality now depends on the packaging step succeeding.** A degraded package still
  produces a green scan, which is the dangerous outcome — a passing gate that inspected
  less than it appeared to. The Node prerequisite and the loud artifact check exist for
  that reason, and the packaging log is worth reading when the scan reports suspiciously
  little.
- The Veracode jobs cannot be verified from a development machine, since scanning needs
  credentials that deliberately live only in GitHub Actions secrets. Packaging _was_
  verified locally; the scan and upload steps are unvalidated until their first real run.
- **`npm audit` still runs nowhere in CI.** The dependency pass took the tree to zero
  advisories, but nothing enforces that. Until SCA is configured or an `npm audit` gate
  is added, a newly introduced vulnerable dependency merges unnoticed. This is a known
  gap, recorded in PROJECT_STATE §4.
- Adding a commercial dependency to CI means scans stop if the licence lapses. The jobs
  skip rather than fail in that case, so the loss would be quiet — worth noticing.
