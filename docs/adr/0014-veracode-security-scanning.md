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
- **`npm audit` still runs nowhere in CI, and SCA does not cover for it.** The SCA agent
  installs with `--omit=dev`: measured on this repo it scans 184 production libraries out
  of 941 in the full tree. The vite/vitest/esbuild advisories fixed in the dependency pass
  were all dev-only and would not have been caught. Recorded in PROJECT_STATE §4.
- The **policy scan is now validated, and it returns `Did Not Pass`** — see the measured
  result below. Its verdict carries no signal until the one Medium is mitigated in the
  Veracode platform, so `sast-findings` is the artifact to read, not the job's conclusion.
- Adding a commercial dependency to CI means scans stop if the licence lapses. The jobs
  skip rather than fail in that case, so the loss would be quiet — worth noticing.
- **Every run publishes the full `results.json` as a `sast-findings` artifact, 30-day
  retention.** The action only uploads `filtered_results.json`, which holds the findings
  above the fail threshold — normally an empty array — leaving everything below the gate in
  a job log that ages out. Part XIII requires a sub-gate finding to be reviewed and a
  dismissal to carry a written rationale, and neither is possible against a file nobody
  kept. This changes no gate; it is visibility only, and it is what made the CWE-259 Medium
  in ADR-0015 attributable to a line number.

### What the first runs actually taught

Worth keeping, because both failures were silent and both looked like success:

- **The pipeline scan reported green having scanned nothing.** `fail_on_severity` is
  appended to the CLI unquoted (only `include` is special-cased), so `Very High, High`
  word-split and aborted the command; and `fail_build` only matches
  `/FAILURE: Found \d+ issues!` in the scan output, which an aborted scan never emits.
  Fixed by quoting the value, adding `fail_build_error`, and — because neither of those
  is trustworthy alone — an explicit step asserting `results.json` parses and carries a
  scan result.
- **SCA reported clean having read only the root `package.json`**: `Direct Libraries 0`,
  62 lines of code, against a workspace of four packages. `recursive: true` is required
  for npm workspaces.
- **A deprecation warning outlives the job it is printed in, and reads like a cause.**
  `sast-policy`'s log ends with a Node 20 `##[warning]` emitted during `Complete job` —
  after the scan has completed and after the real failure line. Being last, it reads as the
  reason the job failed; it is not, and never has been. `actions/upload-artifact` and
  `actions/download-artifact` are pinned to `v7.0.1` / `v8.0.1` so they no longer appear in
  it, but `veracode/veracode-uploadandscan-action@0.2.11` declares `using: node20` and is
  the newest release Veracode ships, so the warning stays. Worth re-checking whenever that
  action publishes a release; nothing else to do.
- **The policy scan works, and disagrees with the PR gate by design.** Its first three runs
  on `main` all ended `Did Not Pass`, with the scan itself healthy (`Results Ready`, no
  error). The cause is the deliberate narrow gate this ADR chose: `sast-pipeline` blocks on
  High and above, while Veracode's _policy_ counts Mediums too, so one CWE-259 Medium keeps
  `main` red while every PR is green. That divergence is a consequence of the gate decision
  above, not a misconfiguration — but it does mean a red `sast-policy` must never be read as
  "something just broke". Dismissed under Part XIII in ADR-0015; PROJECT_STATE §4 records
  the platform mitigation that would clear it.

The generalisation: **a security tool's default failure mode is a confident pass over
nothing.** Never accept a green scan that has not been shown to fail on purpose, and read
the coverage numbers, not just the verdict.
