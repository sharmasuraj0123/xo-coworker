# AGENTS.md

XO Space's web UI: plain ES modules and CSS, no framework, no runtime build. [README.md](README.md) is the overview, [DEVELOPING.md](DEVELOPING.md) explains the kernel, modules, places and services, and `architecture/decisions/` holds the owner's decisions.

## Commands

```sh
npm ci                                     # dev tools (lint, types, build); once
python3 serve.py                           # the app on http://127.0.0.1:5180
node tools/check.mjs --fast                # lint, layers, conformance; seconds (pre-commit runs it)
node tests/run.mjs <filter>                # unit tests whose path contains <filter>
node tools/check.mjs --conformance-base <start>   # full check: types, build, all tests; once before a merge or deploy
```

The exit code is the verdict. A `note` line doesn't fail the check; raise a baseline in `tools/baselines/` only with the reason in the commit.

## How code is written here

- Layers run `core/kernel` → `core/platform` → `core/ui` → `core/services` → `shell` → `modules/*` → `apps-host`; import only your own folder or lower. Modules never import each other: they use services, places and the bus, declared in their manifest.
- `// @ts-check` and JSDoc types, no `any`. Server data goes through the typed readers in `core/platform/*-response.js`.
- A scope (`createScope()` or the module's `ctx`) owns every listener, timer, observer and request; requests take its signal.
- Render in place with `core/ui/redraw`; focus never falls to BODY. Only `modules/conversation/follow.js` moves a conversation's scroll. Dialogs are `createDialog()`.
- Storage goes through `core/platform/storage.js` (a renamed key gets a migration); caches are `createLru()`; shared reads use `once()` or `latest()`.
- Unexpected failures go to `reportFailure` or are rethrown; never swallowed, no bare `console`.
- Visual values come from `core/ui/tokens.css` and change app-wide, never for one surface: one type scale, sizes from content, no literal colours, no `!important` (use `@layer`).
- `js/app.js` only imports and boots modules. `css/` only shrinks: styles live beside their module.
- Fix the root cause, not a patch on top. Delete dead code. A bug fix comes with a test that fails without it.
- Comments are rare and one line.

## Commits

Small, single-purpose commits whose titles say what changed. Quote commit hashes only from git output.

## The owner's rules

- Nothing is pushed or deployed without the owner's OK.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Files save only on ⌘S.
- Browser suites (`e2e/`, `tests/browser/`) run only when the owner asks.
- Apps use xo-space's local routes.
- No personal details or secrets in the repo.
