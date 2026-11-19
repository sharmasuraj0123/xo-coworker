# The plan's open decisions: all settled

- **Decided:** 19 Nov 2026, 19:34Z, by the owner. They accepted every recommendation in review `rv_a78b64c2837f42c6`. D1 and D4 were settled earlier, at 19:08Z.

| # | Decision |
|---|---|
| D1 | A dev-only `package.json` (TypeScript checking of JSDoc, oxlint). The app runs with no build. |
| D2 | Plain ES modules plus in-place `redraw`. No framework, no runtime build. |
| D3 | A module is frozen for feature work while it moves (days, not weeks). |
| D4 | `ui-mockups/`, the tracked `design-research/` files and `PR_DESCRIPTION.md` leave the repo for the design archive. The files the tests need move into `e2e/` first. |
| D5 | Shape ids keep their names. They are stored user data, so a rename always gets a migration. |
| D6 | Dead code is deleted, each piece in its own commit. This covers the unreachable All-threads sheet, diffview's dead editor path and its vendored `edit.js`, the unused lucide folder, map.js's standalone mode, unused helpers and exports, the invalid CSS rules and unused tokens, the 9 uncalled routes, and the one-off probes under `tools/`. |
| D7 | Each likely bug is fixed in the phase that moves its code, in its own commit with a test. Some were already fixed on the release line by 5a2b078: the one ⋯ menu, the Thread page's teardown, ⌘B and Esc. |
| D8 | The first sandboxed app is a sample app made by `xo app new`, then the Design spike. It is not the file viewer. |

- **In the ledger:** no entry waits for a decision any more (`python3 tools/ledger/check_ledger.py`: 0 entries waiting).
