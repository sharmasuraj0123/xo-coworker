# xo-coworker: rules for every agent and person working here

`CLAUDE.md` only imports this file; edit here. Keep it short: the reasons live in `architecture/decisions/`.

## The work in progress
- Branch `coworker/modular` turns this app into a kernel + modules + apps. Plan: `architecture/PLAN.md`.
- Ledger: `tools/ledger/ledger.json`, readable in `architecture/modular/LEDGER.md`. It maps every file of the base commit to its new home.
- A commit that moves code updates the ledger in the same commit (moved, kept, or deleted with a reason).
- `architecture/modular/LEDGER.md` is generated: never hand-merge it. After a conflict or a ledger edit, run `python3 tools/ledger/ledger_md.py .`; the check fails when it is stale.
- Move commits change no behaviour. Fixes and deletions are separate commits, each with a test.
- One module moves at a time. While it moves, no feature work touches it.

## Before you commit or merge
- `node tools/check.mjs` must pass: lint, types, ratchets, comments, ledger, then every unit test, judged by exit code.
- The pre-commit hook runs `--fast` (no types, no tests: the type checker takes ~430 MB, so only the full check runs it). It is already on: `core.hooksPath` is set in the shared git config, so never run `git config` for it.
- Dev-only tools: run `npm ci` once, and again whenever `package.json` changes, or the types step fails. The app never needs them; it runs from plain files with no build.
- Never weaken a baseline. `--update-baselines` only lowers numbers.
- No browser suites unless the owner asks. Hold the `headless-browser-suite` lease, and run one suite at a time.

## Code
- Comments: avoid them. One line at most, and never one that points at a plan, a phase, a decision or a doc. The `comments` ratchet in `tools/check.mjs` enforces this. Type-only JSDoc goes on one line.
- Fix problems at their root. No patches, workarounds or special cases layered on top.
- Layers, lowest first: `core/kernel` → `core/platform` → `core/ui` → `core/services` → `shell` → `modules/*` → `apps-host`.
- A file imports only its own folder and lower layers. Modules never import each other; they talk through services, places and the bus.
- Render with `core/ui/redraw` (in place). A press must survive a live redraw. No framework re-creates nodes.
- Focus is never left on BODY. Never move a conversation's scroll yourself: `follow.js` owns it.
- New and moved files start with `// @ts-check` and have JSDoc types.
- Size limits: a new file may not pass 400 lines; an old file may shrink, never grow.
- Styles: tokens only, no literal colours or sizes. Every visual change goes through shared tokens, app-wide. No `!important`: use `@layer`.
- Every storage key keeps its name, or gets a migration.
- A module that calls a backend route checks it in its own `modules/<m>/tests/routes-contract.test.mjs` against xo-space's OpenAPI snapshot, as Launchpad's does (`node tools/openapi/snapshot.mjs` refreshes it).

## The owner's standing rules
- Nothing goes to GitHub or any remote unless the owner asks for that push.
- Only the owner's picks reach `:3000`: no switchers, test flags or demo pages.
- Quote a commit hash only after reading it from git output.
- Files save only on ⌘S; there is no autosave.
- Apps use xo-space's local routes; no oneshot completion is exposed.
