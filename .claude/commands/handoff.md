---
description: End-of-session ritual — update state, verify, commit, push. Run before switching machines.
---

I'm finishing work on this machine (possibly switching to another one). Leave the repo in
a state I can pick up cleanly anywhere.

Do all of this:

1. **Report uncommitted work.** Run `git status` and tell me what's outstanding before
   touching anything.

2. **Update the docs** exactly as `/update-state` describes — `docs/PROJECT_STATE.md`, and
   `CLAUDE.md` if a convention or gotcha changed.

3. **Verify**, unless the tree only contains documentation changes:

   ```
   npm run lint && npm run typecheck && npm run test && npm run build && npm run format:check
   ```

   If anything fails, stop and tell me. Do not commit broken work without saying so.

4. **Commit and push** to the current working branch. If work is incomplete, say so in the
   commit message body — an honest `WIP: <what's done> / <what remains>` is fine and far
   better than a commit that implies more than it delivers.

5. **Tell me where things stand**, covering:
   - what's committed and pushed, and to which branch
   - anything deliberately left uncommitted, and why
   - the exact commands to resume on another machine
   - anything that does **not** travel via git and must be recreated there — `.env`,
     `node_modules`, Docker volumes (the local Postgres data), and any locally seeded
     database state

Never push to `main` directly. If the branch is ready for review, offer to open a PR
rather than opening one unprompted.
