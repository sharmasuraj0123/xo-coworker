# xo-coworker: how we build

`CLAUDE.md` only imports this file; edit here. We build and ship daily, at the bar of a strong production team. How the code fits together is in [DEVELOPING.md](DEVELOPING.md); the owner's decisions are in `architecture/decisions/`.

## Engineering
- Fix problems at their root; no patches, workarounds or special cases layered on top.
- Clear boundaries: a file has one owner and one job. Split for ownership, not for a line count.
- Real types: files start with `// @ts-check` and have JSDoc types, no `any`. Server data goes through the typed readers in `core/platform/*-response.js`.
- No dead code. No swallowed errors: handle an expected failure; report the rest with `reportFailure` or rethrow. No bare `console` calls.
- No sleeps or timeouts hiding a race; order the work or cancel the stale read.
- A bug fix comes with a test that fails without the fix.
- Comments are rare and one line; JSDoc on one line.

## Code
- Layers: a file imports only its own folder and lower layers. Modules never import each other; they talk through services, places and the bus, declared in their manifest.
- Every listener, timer, observer and request is owned by a scope (`createScope()` or the module's `ctx`); requests take its signal.
- Caches are bounded (`createLru()`), duplicate reads shared (`once()`, `latest()`), storage goes through `core/platform/storage.js`, and a renamed key gets a migration.
- Render in place with `core/ui/redraw`. Focus never falls to BODY. Only `modules/conversation/follow.js` moves a conversation's scroll. Dialogs are `createDialog()`.
- Visual values come from `core/ui/tokens.css` and change app-wide, never one surface at a time: one type scale, sizes from content, no literal colours, no `!important` (use `@layer`).
- Keep functions under 150 lines and lines under 140 characters. A file past 400 lines usually hides a second owner.
- `js/app.js` only imports and boots modules; `css/` only shrinks.

## Commits and checks
- Small single-purpose commits whose titles say what changed. Quote commit hashes from git output.
- While working: `node tools/check.mjs --fast` (the pre-commit hook runs it) and the tests you touched, `node tests/run.mjs <filter>`.
- Before a merge or deploy: the full `node tools/check.mjs --conformance-base <start>`, once, on the tip you hand over.
- Baselines in `tools/baselines/` record old debt. A raise is fine when the commit says why.

## The owner's rules
- Nothing is pushed to a remote or deployed without the owner's OK.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Files save only on ⌘S; no autosave.
- Browser suites run when the owner asks.
- Apps use xo-space's local routes.
- No personal details or secrets in the repo.
