---
description: Update docs/PROJECT_STATE.md to reflect what changed this session
---

Update `docs/PROJECT_STATE.md` so it accurately describes the project **as it stands right
now**, incorporating everything done in this session.

Work from what actually happened and what is actually in the repo — read files to confirm
rather than writing from memory. Then revise these sections as needed:

- **Header** — bump the "Last updated" date and the phase status line.
- **§2 Current state** — add/adjust modules, endpoints (with their permission guards),
  schema entities, migrations, seeded data, frontend routes, and CI jobs. The endpoint
  table and permission list must match the source.
- **§3 History** — append merged PRs and any bug worth remembering, with its root cause,
  not just its symptom.
- **§4 Known debt** — add anything new we deliberately deferred; remove anything we fixed.
- **§5 Roadmap** — move completed items out, and record any new scope the maintainer
  raised in conversation.

Also update `CLAUDE.md` if this session changed something a future session must know:
a new convention, a new gotcha, a changed run command, or a new permission/guard pattern.
Keep `CLAUDE.md` tight — it loads into every session, so it earns its length.

Do not invent progress. If something is half-finished, say so plainly and note what
remains. An accurate "in progress, blocked on X" is far more useful than an optimistic
"done".

Finally, show me a short summary of what you changed in the docs.
