# Modularization handoff

## Standing rules for every phase

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.
- Run only one full check or browser run across the project at a time. Use `modular-full-check` for a full check and `headless-browser-suite` for a browser run. Before starting, confirm neither kind of run is active elsewhere. Use `JOBS=1` and a memory `ulimit` for each run.
- Before a full check, read `free -m` and wait if available memory is below about 1.5 GB. Use no helper sub-agents. Run at most one TypeScript checker or Node test process of your own at a time, and only stop processes you started.

## Exit criteria

- Code is efficient and readable, with small cohesive modules and clear boundaries.
- Comments and docstrings are one line at most. Each P3 package records each file's size against its target and checks for comment blocks, dead code and duplicate helpers.
- Every merge review checks production readiness in addition to test results. Inspect ownership and naming, readability, types, existing tokens, error propagation, listener and observer lifetimes, and work added to startup. Require behavior tests with deliberate breaks. Send any new regression back with file and line evidence. Record inherited problems for the post-P4 fix phase.
- After P4 and the fix phase, an independent audit covers the whole codebase and lists remaining patches, workarounds, oversized files, docstrings and duplicates by file and line before P5.
- Send any audit finding that would change looks or behaviour to the coordinator as a proposal for the owner. Make verified behaviour-preserving cleanups in their own checked commits.

## P1 integration, resumed 23 November 2026

The integration branch is `modular/integration-bc5bb3`, based on `coworker/modular` at `7b94496e`. The full check passed from an archived copy of that baseline and again after merging route types at `82155c9d`. The icon move at `e546c9b1` passed the same check and dropped the final ledger from 1,719 to 1,334 problems. Git reports 385 byte-identical icon renames. The shape presets from services-2 came across separately at `5caa28f2` and reduced the count to 1,332. The store's loader test failed on the old path before the move.

The P1 candidate at `43e65c75` passed the clean-export full check with `JOBS=1`. The independent Sol review found no blocking issues, verified the 387 byte-identical renames and confirmed the ledger and baseline changes. The P1 rollback point is the local `modular-gate-P1` tag. Take the release head from git just before the P2 forward merge. The owner controls browser runs and deployment.

### Branch review and carryover

| Source | P1 disposition and next action |
|---|---|
| `modular/route-types` | Integrated. The route argument types and narrower project chat ID change compile-time checks only. |
| `modular/launchpad` | Parked at the reviewed trial `modular/trial-p1-launchpad-bc5bb3`. App boot still creates Launchpad directly, leaving the new kernel module unused. A pending focusout callback can outlive unmount and read a subsequent mount's state. Wire the module through the live panel, and separately test the unmount and remount paths through the public entry point. |
| `modular/shell` | Parked. The frame watcher needs real frame contracts and coverage for removal across all supported frames. The in-place confirm still has open review items. App boot registration at `70096b01` remains held. |
| `modular/apps-v0` | Parked. View open, heartbeat and close swallow lifecycle errors. An interval can queue heartbeats while open is pending. Cover open, close and rejection through the host and its client boundary before integration. Real install waits for the approved Space routes. |
| `modular/map-home` | Parked for the timeline and record group. The Made move uses untyped dependencies and callbacks where the moved code already depends on specific record fields. Port against the release record and cover Home, the panel and quick open through their public entry points. |
| `modular/files` | Parked for the media and viewer group. The scope and marks extraction introduces untyped thread and file contracts. The branch also changes how Changes receives its API. Carry the moves and wiring changes as separate slices. |
| `modular/threads` | Parked for the panels and lists group. The new chat and run modules introduce untyped dependencies and records. Keep the existing stop and undo timing covered while extracting the runs sheet. |
| `modular/services-2` | Shape presets integrated independently. The remaining timeline move and test relocation stay parked for the timeline group. Type the new world module contracts and check that the public timeline exports and their behavior are preserved. |
| `modular/finish` | Icon source integrated independently. The DOM and sound move mixes an application selector fix with extraction. The test-kit move and shim deletion remain available as separate slices. |
| `xo/thread-7ea52a` | Parked for the conversation group. The branch also contains the attachment tray extraction, platform file helpers and Thread-page composer e2e coverage. A thread entered by touch must focus a landmark without raising the phone keyboard. Desktop must still focus the input. |

## P2 gate and pre-P3 release catch-up

The first forward merge of release `f0144d5f` is committed at `c7bc7dbc` on `modular/integration-bc5bb3`. Local tag `modular-gate-P2` points to `0a723c47`, which passed the independent re-review and all checks. The P1 tag is the rollback point for that merge. The coordinator requested a second forward merge before P3. Commit `f55c6255` brings in release through `d639012b`, including primary button tokens, card button ink and Accounts sign-in. Before P5, read the release head from Git and merge forward again if it has moved.

- The panel uses release's single visible page, one level of Back, shared width and Files close behavior, with page registration and mounting through the kernel.
- Launchpad uses the release window and home implementation under `modules/launchpad/`. Since still renders the quiet one-line release summary. The grouped-card helpers had no live caller in the release pin.
- The versioned static server includes the modular paths. The GitHub page retains the three optional release routes with 404 behavior checked by the route contract and page tests.
- The ledger is pinned to the merged release tree. Its plan check passed and final obligations fell from 1,332 to 1,328.
- Back and Escape use release's separate orders on one kernel stack. Phone Back asks before closing a standalone viewer with unsaved edits. Tests check both complete orders and reject an ordered handler whose layer is missing from its order.
- The committed clean export passed the full check, including all 263 unit files by exit code.
- The first browser lane exposed missing startup responses in the fake Space, six outdated accessibility snapshots, and two Apps cases for an entry point absent from both parent branches. Commit `5532a1a6` added and tested the fixture responses. The next run passed all 16 fast-lane cases against fresh accessibility captures from the pinned release served by its own `serve.py`. Run both deferred cases with `node e2e/run.mjs apps` at the Apps gate.
- The independent P2 review found two lost release behaviors. The panel now reflects the visible page and its Shell tooltip on each paint, and Settings navigation queries only inside Settings. DOM regressions reproduced both failures on the merge before the fixes.
- All 16 paired Chromium screenshots matched byte for byte. Both builds ran through their own `serve.py` with the same seed. The pairs cover Home, conversation, the right panel and Settings on desktop and phone in light and dark mode.
- Commit `13cd882a` removed all stale and multiline comments identified in the P2 review. The sidebar fold test now anchors its existing assertions to a rule rather than a comment.
- The release catch-up passed the full check on the exact commit tree, including all 265 unit files by exit code, and all 16 fast-lane browser cases. The route contract matches Claude Code and Codex to OpenAPI. Only Antigravity's POST start and callback are optional, with separate DOM tests for their 404 paths. Launchpad and Accounts use the same platform reader for JSON events.
- The catch-up also matched release `d639012b` byte for byte in 20 paired Chromium screenshots through each build's production server. The pairs cover Home, conversation, the right panel, Settings, and Accounts in light and dark on Stone desktop and Onyx phone. The pinned ledger remains at 1,328 open items.
- The short review restored three release comments in `css/app.css`. The rules, their order and the file length match the browser-verified merge.
- [The six P3 packages](P3-WORK-PACKAGES.md) contain the launch order, file and ledger boundaries, and gate checks. Start the first two in parallel from the pinned integration commit after the short review. The integrator reviews and merges each package.

## P3 integration follow-ups

- Groups 1 and 2 started in parallel from `90c903a9`. Panels and lists at `28f61f23` merged first, followed by media, viewer and Files at `bfbce027`. The merge keeps both packages' coverage in the shared icon tests and retains both sets of ledger and baseline reductions. Group 3 builds from the combined clean-export gate `modular-gate-P3-groups-01-02` at `10cc0c85`.
- When a test reads legacy source, each worker updates only the assertions affected by its move, in the same commit. Review both groups' hunks and retain both sets of assertions where a test file overlaps.
- Home's first-paint script lives at `modules/home/skeleton.js`. It retains its direct slot before `boot.js` without imports, and app and record wiring point to the same module. The first-paint test follows the entry in `index.html` and verifies the remembered Home shape before loading the app.
- The direct media and sidebar stylesheet links now point to `modules/conversation/media/media.css` (`c21c8221`) and `shell/sidebar.css` (`af211a25`). The moves preserve CSS rules and their order and retain both links' positions. Only comments were removed from the stylesheets.
- Runs opening is in `modules/runs/controller.js`. Pending stops and receipts run through `modules/runs/stop.js`, with the shared store and `stopsHerald` wired in `js/app.js`. The Group 2 selector import change was isolated in `7c014c48`.
- Group 3 moved timeline, turn rendering, message decoration and Made from `10cc0c85`. The reviewed package head is `bdcc7389`. Group 4 takes the app wiring from the verified Group 3 checkpoint. Groups 5 and 6 follow serially.
- The direct message stylesheet moved to `modules/conversation/msgx.css` in its original cascade slot. The move removes comments and transfers the existing seven-declaration priority ratchet with the file. Selectors, declarations and rule order are unchanged.
- The Group 4 review revision at `2beded2d` assigns `threadTargetHtml` to Group 6 with the composer renderer. P4 owns the remaining overlay functions (`runsEscape`, `openAll`, `closeAll`, `focusOverlay`, `syncInert`, `keyLayer`, `openKeys`, `closeKeys`, `runGlobal`) and their keyboard ledger keys (`Escape`, `ArrowDown`, `ArrowUp`, `Enter`, `Tab`, `/`, `End`, `ArrowRight`, `ArrowLeft`).
- Group 4 integrates app wiring and styles from `6dcef4db`. The eight files flagged for growth match the worker's base byte for byte. The merge carries the direct Home script and message stylesheet paths forward and preserves the separate ledger changes. Group 5 starts from the `modular-gate-P3-group-04` checkpoint.
- Group 5 has a coordinator-approved size exception for the existing mount files `shell/frame.js` and `shell/overlays.js`. Review growth against the byte-identical hidden-region markup and unchanged sibling positions specified in the Group 5 brief.
- Group 5 at `91986c6c` mounts the hidden page regions, decision panel, viewer, toast and Shells at their original sibling positions through the existing shell frame. All 12 moved IDs still have one live node after boot. The head, 18 stylesheet slots, import map and script tail keep their original bytes. The 79 open index keys are resolved. Group 6 starts from `modular-gate-P3-group-05`.
- The [Group 6 brief](P3-WORK-PACKAGES.md#6-conversation-composer-and-decisions) records the conversation holdbacks. Reconcile it with the Group 5 mount handoff before launch. The [P4 brief](P4-WORK-PACKAGE.md) takes the 18 keyboard and overlay ledger keys, compatibility removals and final ledger passes after the Group 6 gate.
- Group 6 integrates at `bd73625e`. It closes 133 ledger obligations and leaves 574 open, including the 18 P4 app keys. The revision removes the sibling-module type imports and makes the layer check scan declarations and JSDoc imports. An independent AST comparison verified that the type revision preserves all ten changed application files at runtime.
- At the P3 gate the owner approved the fast browser lane and paired screenshots against release `d639012b`. Run the capped full check first, release its lease, then take the browser lease separately. Compare the tested integration tree and pinned release through their own `serve.py` with the same fake Space seed, on Home, conversation, the panel, Settings and Accounts in both themes on desktop and phone. Record mismatches as findings and leave approved snapshots untouched. Tag `modular-gate-P3-group-06` with the gate evidence. The coordinator starts the independent read-only quality audit from that tag alongside P4. Fold its file-and-line findings into the post-P4 fix phase and keep the later pre-P5 audit.

## P4 keyboard and compatibility handoff

- The P3 rollback point is `modular-gate-P3-group-06` (`bb4fef4d`). The integration overlap is `js/app.js` and `tests/run.mjs`. P4 remains on the P3 base for review against Package A.
- The order fixtures match release `d639012b`: Back treats Chats setup and the standalone viewer separately, while Escape gives Settings priority over Files. The shell uses the existing stack for those priorities, Tab order and app-wide inert ownership. Files retains its own inert bookkeeping. The All Threads, shortcuts, Runs and project-icon handlers now live with their surfaces.
- Deliberate mutations swapped Chats setup and Runs for Back, swapped Settings and Files for Escape, swapped the shortcuts and All Threads Tab order, disabled the application inert hold, and removed the IME guard. The respective focused tests failed before each mutation was reverted.
- The test-discovery probe exited 1 at a module root and the serial runner discovered it under the module's `tests/` directory (313 passed). The probe was removed.
- The static graph resolves 326 JavaScript files from Home, boot and main conversation decoration. Home retains the first module slot, decoration follows boot, and the 18 stylesheet slots match the P3 gate. Static serving checks cover the import map and these entry URLs. The browser execution check belongs to P5.
- Settings and Home Record still assemble sibling modules at the application boundary. Their former consumers import their public helpers from their owners. The versioned stylesheet paths, Geist assets, and existing favicon bytes are recorded as kept. The Styles work stays with the CSS package, and generating a favicon from different artwork needs a separate decision.
- Keep the P5 lane and the full legacy browser coverage. The P5 cases cover the drawer and Settings Back, Settings Escape focus return, the Threads panel, Home at two viewports, boot, project open, send and draft restoration. They cover only part of the retained browser suites. The deferred Apps cases stay in `e2e/specs/apps.spec.mjs`.
- `js/app.js` went from 1,388 to 1,228 lines. The extracted modules are keyboard layers (40), global keys (35), All Threads sheet (80), shortcuts sheet (11), project-icon keyboard (18), conversation lightbox (14), and main conversation decoration (13). The runtime upward-import baseline is empty. The existing oversized file and comment limits only decreased.

## Findings for the post-P4 fix phase

P3 and P4 preserve release behavior. Bring findings from every package handoff here with file, line and evidence. The references below identify the trees where the evidence was recorded. Recheck the paths and reproduce the findings on the P4 gate before assigning fixes.

| Finding | Evidence |
|---|---|
| Files drag-and-drop rejects the drop | Release `d639012b`, `js/files.js:822,841–843`. The drop handler saves the dragged item locally, clears `dragging`, then calls `fits`, which still reads `dragging`. The guard returns before `moveTo`. Reproduce with a valid file and target directory through the Files DOM. |
| Media item registry and scroll observers retain entries | Group 1 checkpoint `0e2c4685`, `js/media.js:112,162–171`. Each render adds items to a registry without eviction. The watcher map holds scroll roots strongly and has no removal path. Verify retention across project and conversation changes. |
| Files host resize observer has no disposal path | Group 1 checkpoint `0e2c4685`, `js/files.js:782–785`. Mount observes the host without retaining a disconnect handle. The callback repaints when the host crosses the layout threshold. Verify the host lifecycle before changing it. |
| Chats reads titles eagerly | Group 2 handoff `d7b083f2`, `modules/chats/chats.js:41–56,125–136`. After a session-list fetch, up to 24 history reads run concurrently before loading clears and the final draw is scheduled. In the active chat, each observed turn-count increase also schedules another history read. Record request counts and initial render timing with a large list. |
| GitHub replaces each page's DOM on redraw | Group 2 `8bf12571`, `modules/github/page.js:222–244,259–266`. List refreshes and fold changes replace the whole list pane. A late item response replaces the entire detail pane. Check focus and node identity during these updates. |
| Chat permission radios miss the Tab stop | Group 2 `d3b34ff0`, `modules/chats/setup.js:115` and `core/ui/a11y/keynav.js:33`. The permission rows are radio-role `div`s. The roving helper returns no `tabindex` for the selected or first row and `-1` for the others. `role="radio"` alone gives a `div` no Tab stop. Verify Tab entry and arrow navigation through the rendered picker. |
| Shells schedules polling and installs page-level listeners | Group 2 handoff `d7b083f2`, `modules/shells/dock.js:81–106` and `modules/shells/dock-input.js:130–135`. The dock schedules another refresh after every read, watches document visibility, and registers window unload and media-query listeners. Verify request cadence while closed and the lifetime of each subscription. |
| Intelligence warms catalogs during render and leaves a fallback timer pending | Group 2 handoff `d7b083f2`, `modules/chats/intel-catalog.js:52–56` and `modules/chats/intel.js:142–146`. Chip rendering can start a model catalog read, and the continue picker races its catalog against a 20-second timer with no cancellation after success. Measure the requests and confirm timer lifetime. |
| The Shells sidebar count drives a relational selector | Group 2 handoff `d7b083f2`, `shell/sidebar.css:54`. A scoped `:has()` selector changes toggle width and padding when the count becomes nonempty. Measure style recalculation before deciding whether it needs a fix. |
| Mask SVG requests lose immutable caching | P2 and catch-up, `core/ui/tokens.css:159–162` and `serve.py:447–456`. Release requests use `/v/<hash>/assets/` and get immutable caching. Modular requests from the root-relative mask URLs revalidate. Chromium resolved a trial relative URL from the consuming stylesheet, returning 404 from `css/app.css`. Review the serving fix with the coordinator and verify headers, SVG bytes and rendering. |
| Message decoration makes several passes over the conversation | Group 3, `modules/conversation/decoration.js:86–166,271–279`. The child-list observer and the synchronous redraw handler both invoke a pass that walks the rows several times. Count passes and measure their cost in long active threads. |
| Conversation observers can outlive their decorator | Group 3, `modules/conversation/decoration.js:266–271` and `modules/conversation/latest-button.js:45–68`. Observers are installed without adding disconnects to the destroy path. The thread page is retained today. Check callback lifetime at actual disposal. |
| Working turns interleave layout reads and writes and scan the document | Group 3, `modules/conversation/working-turn.js:139,217–221,232–244`. Each sizing pass appends a probe and reads its width. Each decorator's interval scans all working elements. Measure layout and timer cost with both conversations active. |
| A quote jump scrolls outside the follow controls | Group 3, `modules/conversation/message-reply.js:95`. An explicit quote jump calls `scrollIntoView` directly. Verify the resulting follow state and focus. |
| Made warms thumbnails and retains a document listener | Group 3, `modules/artifacts/made.js:62,150,164`. The panel warms the first 48 filtered thumbnails and each record creation registers a document click listener. Count requests and test the listener lifetime if the record is remounted. |
| Theme refusal leaves the old theme selected | Group 4 review head `82abf208`, `modules/settings/appearance.js:20–26` and `modules/settings/shape-page.js:15`. If storage rejects the write, Appearance reloads the stored mode. The DOM test verifies that the old theme stays while the notice says “Applied for now.” Decide what the UI should do on storage refusal. |
| Accounts keeps polling after Settings closes | Group 4 review head `82abf208`, `modules/settings/accounts.js:161–173` and `js/app.js:3262`. The device-login poll runs until completion or expiry. Closing Settings does not cancel it. Confirm whether sign-in should finish in the background. |
| Map retains listeners and an observer | Group 4 review head `82abf208`, `modules/map/map.js:42,327,362`. The font-loading listener and host ResizeObserver have no disconnect path. Hiding Map invalidates its pending wake callback, but the quiet scheduler retains its input listeners until the timer runs. Verify the listener and observer lifetimes across mount and hide. |
| Map, navigation and theme read layout after writes | Group 4 review head `82abf208`, `modules/map/drawing.js:65–74`, `shell/navigation.js:30` and `core/ui/theme.js:21`. Source inspection found synchronous layout or computed-style reads after writes. Measure the cost in a browser before choosing a change. |
| Inferred project icons can stay stale after a rename | Group 4 review head `82abf208`, `modules/projects/icon-choice.js:17–25`. The cache key uses thread count and the icon override. Renaming a project or thread without changing the count can keep the old inferred icon. |
| Explicit Map folder retries can overlap | Group 4 review head `82abf208`, `modules/map/folders.js:17–33`. An explicit refresh on a ready entry keeps it ready during the request, so another retry can start before the first resolves. Check which result wins with reversed responses. |
| The Runs strip does not retry an automatic read at the same count | Group 4 review head `82abf208`, `modules/runs/strip.js:30`. A failed request retains the last count, so the next same-count render skips the read. The manual Runs page has a separate retry path. |
| An existing browser test looks for the Map palette in the wrong file | Group 4 review head `82abf208`, `tests/browser/flows.test.cjs:2171–2172`. The test reads `js/map.js` for a `PALETTE` literal that was already absent at the Group 4 base. Point the check at the actual palette or verify its rendered result before the approved P5 browser run. |
| A thrown record Undo callback leaves the record active | Group 4 review revision `2beded2d`, `modules/chats/record-lines.js:35–37`. The inherited Undo callback runs before the record is cleared and the next render is scheduled. Reproduce with a callback that throws. |
| The decision panel's focus fallback targets an unfocusable section | Group 5 base `312186c3`, `js/decide.js:234–239` and `index.html:121`. Unparking focuses `#panel` when there is no `#card`, but the panel section has no `tabindex`. Reproduce by restoring an open decision panel with no card and checking where focus lands. |
| Opening a thread beside a conversation by touch focuses the composer | Group 6 base `0ef1bf97`, `modules/threads/open-panel-thread.js:10` and `js/app.js:2049,2054`. The panel open passes `{ focus: true }` for pointer and touch alike, and both rendering paths focus the textarea. Reproduce the keyboard opening on a touch device before implementing touch focus on a landmark. Cover desktop entry and explicit composer focus as well. |
| Group 6 increases the startup stylesheet graph | Group 6 checkpoint `adf511bf`, `index.html:14–31` and `css/app.css:1–18`. The same 18 direct links lead to 45 distinct stylesheets, up from 30 at the Group 5 gate and 20 in release `d639012b`. Imported styles start after their parent sheet is read and can block rendering. At the P3 browser gate, compare cold navigation first paint, first contentful paint and the stylesheet waterfall with release. Use those results to assess bundling in the post-P4 or performance phase. |
| The decision dock renders card markup twice on open | Group 6 review `1c12c1d7`, `modules/decisions/dock.js:60,78`. The first render parses a heading. The second renders the card when open. Measure this path and verify the folded heading and rendered card before reducing the work. |
| The side-thread page retains its subscriptions while closed | Group 6 review `1c12c1d7`, `modules/conversation/thread-page.js:51–55,82–87`. Closing keeps the mounted page, decoration, resize observer and scroll listener. Check idle work while closed and lifetime if the page is disposed. |
| A pending message jump can run after a view switch | Group 6 review `1c12c1d7`, `modules/conversation/navigation.js:12–21`. Delayed retries query the shared conversation without checking the original view. Reproduce by jumping to a missing message and switching conversations on the same surface. |
| An unexpected older-page rejection can escape the retry callback | Group 6 review `1c12c1d7`, `modules/conversation/paging.js:21–31`. Focus after a read is handled in an unobserved promise returned by `.finally()`. The normal read handles network failures internally. Verify the public retry path with an unexpected rejection. |

## Previous handoff from 19 November 2026

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
