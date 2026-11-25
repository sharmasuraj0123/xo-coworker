# xo-coworker: rules for every agent and person working here

`CLAUDE.md` only imports this file; edit here. How to do the work is in [DEVELOPING.md](DEVELOPING.md); the reasons behind the owner's rules are in `architecture/decisions/`.

## Engineering
- Production quality. Fix problems at their root; no patches, workarounds or special cases layered on top.
- Clear module boundaries. Split a file for clear ownership, not to meet a line count.
- Real types: new and moved files start with `// @ts-check` and have JSDoc types. No `any`; server data goes through the typed readers in `core/platform/*-response.js`.
- No dead code, no swallowed errors: handle an expected failure explicitly; report the rest with `reportFailure` or rethrow it. No bare `console` calls.
- No sleeps or timeouts hiding a race; order the work or cancel the stale read.
- Every fix has a behaviour test, proven by breaking the fix on purpose and watching the test fail.
- Comments: avoid them. One line at most, never citing a plan, doc, phase, ledger or decision. JSDoc on one line.
- Baselines in `tools/baselines/` only go down. Never raise one to pass a check.

## Code
- Respect the layers: a file imports only its own folder and lower layers. Modules never import each other; they talk through services, places and the bus.
- A module declares in its manifest every service it needs or provides and every place it contributes to.
- Own every listener, timer, observer and request with a scope (`createScope()` or the module's `ctx`) and pass its signal to requests. A mount's test checks disposal leaves nothing behind.
- Bound caches with `createLru()`; deduplicate reads with `once()` or `latest()`; use `core/platform/storage.js` for storage. A storage key keeps its name or gets a migration.
- Render with `core/ui/redraw` (in place); a press must survive a live redraw. Focus is never left on BODY. `modules/conversation/follow.js` alone moves a conversation's scroll.
- A dialog is `createDialog()` with the shared dialog style.
- Every visual value comes from shared tokens in `core/ui/tokens.css`, app-wide, never one surface at a time. One type scale. Size by content: no hard-coded sizes or positions, no literal colours, no `!important` (use `@layer`).
- Review a file over 400 lines for distinct responsibilities and split it at ownership boundaries. Keep functions within 150 lines and lines within 140 characters. `js/app.js` only imports modules and boots them; `css/` only shrinks.

## Commits and checks
- Small single-purpose commits with titles that say what changed; never "WIP" or "Draft".
- `node tools/check.mjs` must pass on the tip you hand over, with `--conformance-base <start>`. The exit code is the verdict.
- No browser suites (`e2e/`, `tests/browser/`) unless the owner asks.
- A ledger change goes in the same commit as the move; `architecture/modular/LEDGER.md` is generated, never hand-merged.
- Quote a commit hash only after reading it from git output.

## This sandbox (8 GB, shared)
- One heavy check at a time project-wide, under the `modular-full-check` lease, with `JOBS=1`, a 512 MiB Node heap and at least 3 GiB available first.
- No sub-agents inside a thread.
- Never use `git stash`: the stash is shared by every worktree. To set work aside, commit it on your own branch.
- Stop only processes you started. Don't make new folders in the home directory; scratch goes in your worktree or `/tmp`.

## The owner's standing rules
- Nothing goes to GitHub or any remote unless the owner asks for that push. Deploys go through the coordinator after the owner approves.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Files save only on ⌘S; there is no autosave.
- Apps use xo-space's local routes; no oneshot completion is exposed.
- No personal details or secrets in the repo, commits or docs.
