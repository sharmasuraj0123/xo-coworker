# xo-coworker: rules for every agent and person working here

`CLAUDE.md` only imports this file; edit here. We build and ship daily, at the bar of a strong production team: good engineering, without ceremony. How to do the work is in [DEVELOPING.md](DEVELOPING.md); the owner's decisions and their reasons are in `architecture/decisions/`.

## Engineering
- Production quality. Fix problems at their root; no patches, workarounds or special cases layered on top.
- Clear module boundaries: a file has one owner and one job. Split for ownership, not for a line count.
- Real types: new and moved files start with `// @ts-check` and have JSDoc types. No `any`; server data goes through the typed readers in `core/platform/*-response.js`.
- No dead code, no swallowed errors: handle an expected failure explicitly; report the rest with `reportFailure` or rethrow it. No bare `console` calls.
- No sleeps or timeouts hiding a race; order the work or cancel the stale read.
- A bug fix comes with a behaviour test that fails without the fix. New behaviour gets tests where they earn their keep.
- Comments: rarely, one line, never citing a plan, doc or decision. JSDoc on one line.

## Code
- Layers: a file imports only its own folder and lower layers. Modules never import each other; they talk through services, places and the bus, and declare them in their manifest.
- Own every listener, timer, observer and request with a scope (`createScope()` or the module's `ctx`) and pass its signal to requests. A mount's test checks that disposal leaves nothing behind.
- Bound caches with `createLru()`; deduplicate reads with `once()` or `latest()`; storage goes through `core/platform/storage.js`, and a key keeps its name or gets a migration.
- Render with `core/ui/redraw` (in place); a press must survive a live redraw. Focus is never left on BODY. Only `modules/conversation/follow.js` moves a conversation's scroll.
- A dialog is `createDialog()` with the shared dialog style.
- Visual values come from the shared tokens in `core/ui/tokens.css` and change app-wide, never one surface at a time. One type scale; size by content, no hard-coded sizes or positions, no literal colours, no `!important` (use `@layer`).
- Size: functions stay under 150 lines and lines under 140 characters (the check enforces these on new code). A file past 400 lines is a prompt to look for a second owner inside it, not a gate.
- `js/app.js` only imports modules and boots them; `css/` only shrinks.

## Commits and checks
- Small single-purpose commits with titles that say what changed; never "WIP" or "Draft". Quote a commit hash only after reading it from git output.
- While working: the pre-commit hook runs `node tools/check.mjs --fast` (a few seconds); run the tests you touched or added with `node tests/run.mjs <filter>`.
- Once, on the tip you hand over for merge or deploy: the full `node tools/check.mjs --conformance-base <start>`. Not per commit, per phase or per fix. Its exit code is the verdict.
- Baselines in `tools/baselines/` record old debt. Don't raise one quietly to get past the check; if a raise is right, say why in the commit.
- No browser suites (`e2e/`, `tests/browser/`) unless the owner asks.

## This sandbox (8 GiB, 2 cores, shared)
- The full check and browser runs are the heavy jobs: one at a time project-wide, under a lease (DEVELOPING.md has the command). The fast check and single test files need no lease.
- No sub-agents inside a thread: each agent costs about 300 MiB.
- Never `git stash`: the stash is shared by every worktree. Commit on your own branch instead.
- Stop only processes you started. No new folders in the home directory; scratch goes in your worktree or `/tmp`.

## The owner's standing rules
- Nothing goes to GitHub or any remote unless the owner asks for that push. Deploys go through the coordinator after the owner approves.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Files save only on ⌘S; there is no autosave.
- Apps use xo-space's local routes; no oneshot completion is exposed.
- No personal details or secrets in the repo, commits or docs.
