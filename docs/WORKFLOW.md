# Working on this project

How to open, edit, run, version-control, and move this project between machines without
losing the thread.

---

## 1. The mental model

Three things hold state. Knowing which is which prevents almost every "where did my work
go?" moment:

| Thing                                                      | Lives where           | Travels between machines?                               |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| **Source code, docs, CLAUDE.md**                           | Git repo              | ✅ Yes — via GitHub                                     |
| **`.env`, `node_modules`, Docker volumes (your local DB)** | Your machine only     | ❌ No — recreate on each machine                        |
| **Chat history with Claude**                               | The session you're in | ❌ No — but `CLAUDE.md` + `PROJECT_STATE.md` replace it |

**GitHub is the single source of truth.** Your laptop is a working copy. If it's pushed,
it's safe; if it isn't, it exists in exactly one place.

---

## 2. First-time setup on a machine

```powershell
# 1. Prerequisites (see README for install links)
git --version ; node --version ; docker --version

# 2. Clone
git clone https://github.com/Abhishek-Chathumal/Project_ITSM.git C:\Development\Project_ITSM
cd C:\Development\Project_ITSM

# 3. Identify yourself to git (once per machine)
git config --global user.name "Abhishek Wellage"
git config --global user.email "acwellage@gmail.com"

# 4. Recreate what git doesn't carry
copy .env.example .env
#    → then edit .env and set a real SESSION_SECRET

# 5. Run it (this also migrates + seeds the database)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open `C:\Development\Project_ITSM` in Antigravity (File → Open Folder). Optionally run
`npm ci` in its terminal so the editor gets TypeScript IntelliSense — the app itself still
runs in Docker.

**Each machine gets its own database.** The Docker volume holding Postgres data is local.
Tickets you create on your office laptop will not appear at home. That's expected — it's
dev data, re-seeded automatically on first run.

---

## 3. The daily loop

**Arriving at a machine — always start here:**

```powershell
cd C:\Development\Project_ITSM
git checkout main
git pull
```

**Working:**

```powershell
claude          # in Antigravity's integrated terminal
```

Then describe what you want. Claude edits files; Antigravity shows the changes live; the
running Docker stack hot-reloads so you can test immediately.

**Leaving a machine — always end here:**

```
/handoff
```

That one command updates the project docs, runs verification, commits, pushes, and tells
you exactly what to do on the other side. It also flags anything that _won't_ travel.

> **The one rule that matters:** never walk away from a machine with uncommitted work.
> Push even unfinished work as a WIP commit. A messy commit on GitHub beats clean work
> stranded on a laptop you're not sitting at.

---

## 4. Git in Antigravity

Antigravity is VS Code-based, so its Source Control panel (`Ctrl+Shift+G`) works the
familiar way:

- **Changes list** — every modified file; click one to see a side-by-side diff.
- **Stage** (`+`) → **message** → **Commit** → **Sync/Push**.
- **Branch indicator** (bottom-left) — click to switch or create branches.

You don't need to choose between the panel and the terminal. They're the same git repo;
use whichever suits the moment. The panel is best for _reviewing a diff before committing_ —
worth doing on anything Claude wrote that you haven't read yet.

**Checking the connection to GitHub:**

```powershell
git remote -v        # should show origin → github.com/Abhishek-Chathumal/Project_ITSM
git status           # tells you ahead/behind origin
```

If pushes ever start failing on a new machine, it's authentication: install
[GitHub CLI](https://cli.github.com/) and run `gh auth login`, or use a Personal Access
Token as the password when git prompts.

---

## 5. Adding files (images, docs, PDFs, etc.)

Just put the file in the folder — via Windows Explorer, or by dragging it into Antigravity's
file tree. Git picks it up like any other change.

Where things belong:

| What                                     | Put it in                            |
| ---------------------------------------- | ------------------------------------ |
| Specs, references, notes for the project | `docs/`                              |
| Screenshots/diagrams referenced by docs  | `docs/assets/`                       |
| Images the **app itself** displays       | `apps/web/public/`                   |
| Throwaway scratch files                  | anywhere ignored — don't commit them |

Then tell Claude the path: _"Look at `docs/assets/mockup.png` and build that layout."_
Claude can read images, PDFs, and text formats directly from the repo.

**Two cautions:**

- **Never commit secrets** — no credential files, private keys, or real customer data.
  `.env` is already gitignored; keep it that way. GitGuardian scans every push and will
  flag leaks, but don't rely on it as the safety net.
- **Keep large binaries out.** Git stores every version forever. Compress screenshots;
  don't commit videos or datasets. If you genuinely need large files later, that's what
  Git LFS is for.

---

## 6. Switching machines

Because everything meaningful is in git, switching is just push-then-pull:

**Office laptop, end of day:**

```
/handoff
```

**Home laptop, that evening:**

```powershell
cd C:\Development\Project_ITSM
git pull
claude
```

Then: _"Read `docs/PROJECT_STATE.md` and continue where we left off."_

**First time on the home laptop**, do §2 setup first (clone, `.env`, Docker). After that
it's the same two commands forever.

If you were mid-feature on a branch rather than `main`:

```powershell
git checkout claude/<branch-name>
git pull
```

**If you forgot to push** and you're now on the other machine: don't recreate the work
from memory and don't force anything. Wait until you're back at the first machine, push
from there, then pull. Two divergent copies of the same feature is the one genuinely
painful mess in this workflow — and it only happens if you skip `/handoff`.

---

## 7. Keeping usage low

- **`CLAUDE.md` loads automatically.** Never re-explain the project.
- **One session per feature or phase.** Long sessions carry all their accumulated context
  into every turn; a fresh session on a well-documented repo starts lean.
- **`/clear`** when you switch to an unrelated task inside a session.
- **Name files.** "Change `apps/api/src/users/users.service.ts`" is far cheaper than
  "find where users are created."
- **Decide before building.** Agreeing on an approach in one message beats building the
  wrong thing twice.
- **Let CI verify containers.** The `smoke` and `smoke-dev` jobs already prove the stack
  boots; don't have Claude rebuild images to re-check that.
- **`/handoff` at the end.** A good `PROJECT_STATE.md` is what makes the _next_ session
  cheap.

---

## 8. Quick reference

| Situation                                 | Do this                                           |
| ----------------------------------------- | ------------------------------------------------- |
| Starting work                             | `git pull` then `claude`                          |
| Finishing work                            | `/handoff`                                        |
| Just docs, no code change                 | `/update-state`                                   |
| New machine                               | §2 setup                                          |
| Forgot what state things are in           | Read `docs/PROJECT_STATE.md`                      |
| Need to see what changed                  | Antigravity Source Control panel, or `git status` |
| App won't start                           | Check `CLAUDE.md` → "Hard-won gotchas"            |
| Switched base image / weird native errors | `docker compose ... down -v` then rebuild         |
