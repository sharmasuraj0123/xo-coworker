# Who does what: the waves of the modular rebuild

The plan is `architecture/PLAN.md`; this file is the assignment sheet. One owner thread holds `coworker/modular` and merges.

## How every thread works
1. **Branch** from `coworker/modular`. Name it `modular/<area>`, e.g. `modular/core-platform`.
2. **Read first:** `AGENTS.md`, the PLAN sections for your area, and your analysis files in `architecture/modular/analysis/`. Their risk lists name the behaviours you must keep.
3. **Characterise before moving.** Write behaviour tests against today's code for what you are about to move. They must pass before and after the move.
4. **Extract, then wire.**
   - Legacy files (`js/*.js`, `css/*.css`) may only shrink: the size ratchet refuses growth.
   - So first move a piece to its new home (`core/…`, `shell/…`, `modules/…`); the legacy file gets smaller.
   - Then point the old call sites at it. A legacy file may re-export the new module for one phase (a shim); the shims are deleted in phase 6.
5. **Move commits change no behaviour.** A bug you find goes in a separate commit with its own test, or on the list in PLAN §9.
6. **Update the ledger in the same commit.** In `tools/ledger/ledger.json`, set each moved file or item to `moved` (home = new path) or `split`. Run `python3 tools/ledger/ledger_md.py .`.
7. **Run `node tools/check.mjs`; it must pass.** Never raise a baseline.
8. **Ask for review.** A second agent reviews the diff. Then the owner thread merges. Nothing is pushed or deployed.
9. **Source-reading tests.** Some tests read the source text of the file you moved (114 do). Rewrite each as a behaviour test, or re-point it to the new path, in the same commit. Never delete one without a written reason.

## Wave 1 (started 19 Nov)
| Who | What |
|---|---|
| owner thread | phase 0 (check, runner, rules, ledger) ✓ · kernel ✓ (`core/kernel`, 1.0.0) |
| A | fast UI lane in `e2e/`: seeded store, settle barrier, accessibility-text snapshots, < 3 min |
| B | research and mockups out to the design archive (owner D4); test fixtures into `e2e/fixtures` |
| C | xo-space app host backend: store, grants, local-route proxy, supervisor, sandbox |

## Wave 2: core extraction (the kernel contract is ready: `core/kernel/types.d.ts`)
| Thread | Takes (see LEDGER) | Must keep (analysis) |
|---|---|---|
| core-platform | `api.js` → `core/platform/http.js` (one error parser); `sse.js` → `core/platform/sse.js` (lpapi reuses it); `keys.js` engine, `gestures.js`, `fuzzy.js`, `pending.js`, `merge.js` → `diff.js`, the time helpers from `ui.js`/`util.js`/`stage.ago` → `time.js`, `util.js` | analysis/2 §2.4 items 12, 17, 19; analysis/4 §2.4 item 20 |
| core-ui | `redraw.js` and `ui.reconcile`, icons (`icon.js`, `xoicons.js`, `fileicons.js`), `motion.js` with ui's `morph/expand/EASE` (one EASE, one reduced-motion query), `dropdown.js`, the hold button from `kit.js`, a11y (`keynav.js`, `focusview.js`, `ring.js`), `markdown/rich/chart/highlight`, `lightbox.js`; tokens and foundation CSS, with `@layer` declared on every sheet | analysis/2 §2.4 items 13, 14; analysis/3 §2.4 item 4; analysis/6 CSS risks 1–4 |
| core-services | `storm.js` split into client / stream / reducers / selectors / commands, **after** tests for its 20 rules (analysis/4 §2.4); `world.js`, `shape.js` (+ presets), `paths.js`, `herald.js` queue → `notices`, `runtimes.js`, `paid.js`, `blocks.js`, `hopstate.js`, timeline's normalisers | analysis/4 §2.4 (all 20); analysis/2 §2.4 items 15, 16 |

## Wave 3: the shell and the first proofs
`shell/` (from `stage.js`, the rail, the header, `index.html` markup, one layer stack); then `modules/shells` (the first proof); then `apps-host` (frontend), against thread C's backend.

## Wave 4: features, in parallel by area
1. files + changes;
2. conversation + composer + decisions, last;
3. map + home + since + artifacts + projects;
4. settings group + search + create-project;
5. launchpad.
