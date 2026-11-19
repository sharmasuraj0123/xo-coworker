# Handoff: the modular rebuild, paused on 19 Nov 2026 at 22:10Z

The owner paused the work here. Nothing resumes until they ask.

## Where things stand

- **The branch:** `coworker/modular`, local only, never pushed, at `f83414e8`.
  - It is clean, and `node tools/check.mjs` passes when run with `JOBS=1`.
  - Re-check it with `git rev-parse coworker/modular`.
- **The live app:** `:3000` still serves `release/2026-11-19`. The rebuild never touched it.
- **Dev tools:** run `npm ci` before checking, because `package.json` has dev-only tools.
- **The ledger:** `python3 tools/ledger/check_ledger.py --final` reports 1,719 entries still planned or split.

## What is merged

- **Safety net:**
  - `tools/check.mjs` runs lint, types, size and `!important` ratchets, comments, layers, places, the ledger, then the tests.
  - `tests/run.mjs` judges each test by its exit code.
  - The fast e2e lane in `e2e/`.
  - The route contract against xo-space's OpenAPI.
- **Kernel and places:** `core/kernel` and `shell/places.js`, documented in `architecture/places.md`.
- **Core layers:**
  - `core/platform`: http, api, sse, keys, gestures, time, util, motion, dom.
  - `core/ui`: redraw, a11y, icons, markdown, lightbox, tokens and foundation layered.
  - `core/services`: storm split under tests, world, shape, paths, notices, runtimes, places, agent-activity.
- **Shell:**
  - `boot.js` starts the kernel.
  - The panel takes its pages and frames from places.
  - The rail, the phone drawer, the favicon and the overlays have moved out of `index.html`, which is down to 139 lines.
  - Header actions are a place.
  - Back and Esc follow one on-screen order.
- **Modules:**
  - settings, routing, rules, worktrees, runtimes, search, create-project;
  - map layout, home sections, since, artifacts (page, cards, store, previews), projects;
  - conversation slices 1–2 (follow, words, typing), decisions (pacing, kit, rank, paid card);
  - changes, and files slice 1 (documents, drafts, editor, page);
  - launchpad.
- **Apps v0:** the apps-host frontend (manifest v2, sandboxed views, bridge, Settings › Apps). Its install and enable flow passes against the e2e stand-in for xo-space.
- **Cleanup, first pass:** orphaned shims are deleted, dead tools and vendor code go (D6), and the README is rewritten.

## Waiting to merge, by branch

Each branch rebases onto the current head first. Each needs a second-agent review, and the full check must pass with `JOBS=1`.

| Branch | Head | State |
|---|---|---|
| `modular/finish` | `97c5832e` | Slice 2: the icon move, `core/ui/test-kit`, the last pieces of `ui.js`, and deleting the `js/api.js` shim. Full check passed. **No second review yet.** |
| `modular/apps-v0` | `9b345089` | 3 commits: apps-host checks its routes against OpenAPI, and calls only routes xo-space has (fixes the `/settings` read). Review status unconfirmed. |
| `modular/shell` | `70096b01` | 3 commits: the `panel.frame` watch (45a27cf4, not reviewed), confirm.js (42ed1aa0, review fixes still open), and 70096b01 (held). Its apps-host registration at boot uses confirm.js. |
| `modular/route-types` | `0416945e` | 2 commits. Full check passed; its review was running. |
| `modular/map-home` | `47e4ffb4` | 3 commits: the rest of Made goes to `modules/artifacts/made.js`, plus review follow-ups and the api import. |
| `modular/files` | `28e308f4` | 4 commits of Files slice 2, not reviewed. |
| `modular/services-2` | `63e09509` | 3 commits of the remaining data services, not reviewed. |
| `modular/launchpad` | `d8b4a5b8` | 4 commits of Launchpad slice 2, not reviewed. |
| `modular/threads` | `ae0dc96f` | 7 commits of chats and intelligence, not reviewed. |
| `xo/thread-7ea52a` | `3bc10d7f` | Conversation slice 3. Its thread-focus change (8d5d6dd9 and earlier 5cc2c5df) **must not raise the phone keyboard**: on touch it must focus a landmark that isn't an input, and on desktop the field. Not merged until then. |

## What is still to move, after those

- The rest of the conversation, composer and decisions. This has the most risk, so it goes last and starts with characterisation tests.
- The rest of Files.
- `js/app.js` (4,396 lines) and `css/app.css` (3,057) shrink down to `boot.js` and module stylesheets. Each sheet gets its `@layer` as its module moves, with no change to which rule wins.
- `index.html` keeps only the visible frame.
- Escape, inert and the Tab trap move onto the kernel's layer stack, as their own behaviour commits.
- The final pass: `check_ledger.py --final` must reach 0, with every shim deleted.
- **xo-space's app routes on `:5002`:** the owner approves them, then the real end-to-end app install runs.

## How to resume

1. Bring back one merging thread to own `coworker/modular`. Then bring back the feature threads, at most four at a time. The container has 8 GiB and runs near its limit.
2. Every thread follows `AGENTS.md`:
   - extract, then wire;
   - legacy files only shrink;
   - the ledger is updated in the same commit;
   - comments are one line at most;
   - fixes go at the root.
3. While working, threads run `node tools/check.mjs --fast`. They run the full check once, with `JOBS=1`, before handing over.
4. After each merge, the merging thread regenerates `LEDGER.md` and never hand-merges it. It runs `--update-baselines`, which only lowers numbers, and reports the head from `git rev-parse`.
