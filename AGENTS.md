# AGENTS.md

XO Space's web UI: plain ES modules and CSS, no framework. [ARCHITECTURE.md](ARCHITECTURE.md) is how the code is organised and how to write it; [DEVELOPING.md](DEVELOPING.md) is how to run, extend and check it.

## Commands

```sh
npm ci                                     # dev tools; once
python3 serve.py                           # the app on http://127.0.0.1:5180
node tools/check.mjs --fast                # lint, layers, conformance; seconds (pre-commit runs it)
node tests/run.mjs <filter>                # unit tests whose path contains <filter>
node tools/check.mjs --conformance-base <start>   # full check: types, build, all tests; once, before a merge
```

The exit code is the verdict. A `note` line doesn't fail the check.

## Working a task

- **Start from the owner's own words and screenshot.** Open the screenshot at full size, zoom in, and say in one line what is wrong in it before you touch code. If that line doesn't match the request, ask.
- **Change only what was asked.** Keep what the owner didn't mention as it is.
- **The loop is: edit, fast check, the tests you touched, commit.** Run the full check once, before a merge, not per commit.
- **Look at a visual change once,** in the theme and width where the problem showed. Share that before/after; skip it for changes nobody can see.
- **Report the result in a few sentences:** what was wrong, what changed, the commit.

## Rules here

- Layers run `core/kernel` → `core/platform` → `core/ui` → `core/services` → `shell` → `modules/*` → `apps-host`; import only your own folder or lower. Modules never import each other.
- Visual values come from `core/ui/tokens.css` and change app-wide, never for one surface. No literal colours, no `!important`.
- Only `modules/conversation/follow.js` moves a conversation's scroll.
- `js/app.js` only imports and boots modules. `css/` only shrinks.
- A bug fix comes with a test that fails without it.
- Quote commit hashes only from git output.

## The owner's rules

- Nothing is pushed or deployed without the owner's OK.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Files save only on ⌘S.
- Browser suites (`e2e/`, `tests/browser/`) run only when the owner asks.
- Apps use xo-space's local routes.
- No personal details or secrets in the repo.
