# P3 work packages

Groups 1 and 2 share the pre-P3 integration tree at `f55c62551dcbfab45d7ad26d0644893ec18d0f52`. Start after the coordinator confirms its short independent review. For later groups, the integrator records the exact commit from git after the listed dependencies pass their gates.

Run at most two Codex Sol threads at medium effort. The integrator assigns files before launch, reviews every change, merges group gates in order and applies one locally verified gate tag per group. Run one full check at a time on a clean `git archive` of the commit with `JOBS=1`, offline dev dependencies and a bounded process memory limit. Check each test file's exit code. Run `python3 tools/ledger/check_ledger.py --final` separately and record the lower count. Regenerate `architecture/modular/LEDGER.md` with `python3 tools/ledger/ledger_md.py .`. No browser run at these gates. Keep compatibility shims until P4, and keep all work local.

A ledger claim on a source path covers its file record if open and its open `<path>::` item records. Keep resolved items intact except to correct a destination changed by your move. Group 4 owns the complement of group 6's named `js/app.js` and `css/app.css` keys. The integrator records any boundary adjustment before a group starts. Each slice targets about 400 changed lines. New source files have a 400-line ceiling, and existing files can only shrink. See the phase plan for rollback and deployment.

Groups 1 and 2 may work in parallel on their disjoint source. Group 3 may start alongside group 2 once group 1 and the shared step-icon prerequisite described below are integrated. Keep legacy entry paths stable, so cross-group imports do not require simultaneous edits. Compare changed paths before starting a second thread. Groups 4, 5 and 6 run in series because wiring and markup ownership follow the source moved in earlier groups. Shared bookkeeping is the exception to source independence. Both workers keep their own ledger keys and refresh the generated view and ratchets in their own worktree. Only the integrator merges, regenerates the view from the combined ledger and reconciles baselines downward. Two workers never edit the same ledger key or the same application source file. Page wiring outside a worker's claim belongs to the integrator in a separate slice.

For test and fixture moves, the worker claims named files before editing. Broad suites and shared test utilities remain with the integrator until a single owner is assigned. Keep the checks runnable at the repository's normal entry points. Files and ledger entries outside every package are reconciled by the integrator at P3 exit, including tests, vendor assets, compatibility paths and retained tooling.

Report observed performance hotspots in the handoff, with file, line and the trigger you saw. Include full re-renders, broad style invalidation, eager loads, recurring timers and listeners that outlive their surface when relevant. The integrator records them in HANDOFF for the post-P5 performance work. P3 and P4 preserve behavior.

Before P5, an independent reviewer audits the whole codebase for remaining patches, workarounds, oversized files, docstrings and duplicates, with file and line for every finding. Only proven move-only cleanups go directly into isolated checked commits. Take any behaviour or visual proposal to the coordinator for owner approval.

## 1. Media, viewer and Files

**Base** · `f55c62551dcbfab45d7ad26d0644893ec18d0f52`. Launch in parallel with group 2.

**Files and ledger** · `js/media.js` (80 open items), `js/attach.js` (24), `js/viewer.js` (16), `js/files.js` (26), `js/skeleton.js` (23) and `css/media.css`. Own `modules/files/`, `modules/home/skeleton.js` and the new shared media and attachment code under `core/services/media/`. Own `tests/{attach,media,files,files-stop-look,files-tree-scroll-fold,viewer-busy,viewer-errors,viewer-head-focus,viewer-hooks}.test.mjs`. Read the parked `modular/files` and `xo/thread-7ea52a` branches for prior work. Keep the attachment tray and platform helpers distinct from conversation wiring.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, `shell/panel/`, `modules/changes/`, `modules/conversation/` and all other packages' files. The viewer's imports of the Changes renderer and image-change code need an integrator-owned wiring slice before the viewer moves across the module boundary. Preserve the first paint for `js/skeleton.js` through its legacy entry until the integrator verifies any index link change.

**Entry and exit** · Confirm mount, folder/file selection, viewer close and focus return, save on ⌘S, media, attachment tray and actual storage keys on the base. Exercise those surfaces after each slice. Keep the route contract in `modules/files/tests/` strict against the snapshot. Record imports and lifecycle coverage. Four to six slices. Parallel with group 2 when test claims are disjoint.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.

## 2. Panels and lists

**Base** · `f55c62551dcbfab45d7ad26d0644893ec18d0f52`. Launch in parallel with group 1.

**Files and ledger** · `js/runsview.js` (17), `js/intel.js` (20), `js/chats.js` (9), `js/shells/{dock,model,term}.js` (40 combined), `js/model.js` (4), `js/gestures.js` (9), `js/ghpage.js`, `js/sideorder.js` and `css/side.css`. Own `modules/{chats,runs,shells,github}/`, `shell/gestures.js`, `shell/sideorder.js` and `tests/{chats-list,ghpage,intel-chip-toggle,runs-page,runs-stop-receipt,shells,side-calm-order}.test.mjs`. Use the parked `modular/threads` branch to find reusable slices. The integrator extracts the shared `stepIcon` and its private helpers from `js/turnview.js` to a lower layer in a standalone prerequisite before Runs needs it. Intel can import `mainRuntime` from its existing home in `core/services/world/sessions.js`.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, Files and timeline sources, shell panel page transitions and kernel layer behaviour. Send common panel, rail or bootstrap wiring to the integrator, including the existing `wordsOf` dependency of the touch gestures.

**Entry and exit** · Characterize chat setup and ordering, Runs retrieval/stop/undo, Intel selection, terminal focus and gesture Back. Cover the optional GitHub routes' 404 behavior and keep the rest of the module route contract strict. Keep stop receipts and the active element through in-place redraw. Five to seven slices. Parallel with group 1 and then group 3 within the declared file claims.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.

## 3. Timeline and records

**Base** · The latest integration commit containing the verified group 1 gate and the shared step-icon prerequisite, or the verified group 2 gate if group 2 has finished. The existing compatibility surfaces must still match P2 at entry.

**Files and ledger** · `js/timeline.js` (60), `js/msgx.js` (42), `js/recordview.js` (11), the remaining `js/turnview.js` keys (20 before the shared step-icon prerequisite), `css/msgx.css` (4), `js/record.js`, `modules/since/` and `modules/artifacts/` for Made. Own the new timeline and record renderers under `modules/conversation/`, plus `tests/{record,turnview,since-card-gone}.test.mjs`. Read `modular/services-2` and `modular/map-home` for pending slices. The quiet Since line and live Made entry points run through the release behavior verified in P2.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, Files, Runs, composer and decision controllers. Keep the renderer public interfaces stable while those callers are still on legacy paths.

**Entry and exit** · Exercise ordering, redaction, text streaming, folded runs, focus during redraw, Made cards and Since through Home, panel or quick open as applicable. Check that conversation scroll remains owned by `follow.js`. Four to six slices. Parallel only with group 2 when the claimed paths are disjoint.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.

## 4. App wiring and styles

**Base** · Verified group 3 gate.

**Files and ledger** · Own remaining `js/app.js` keys (244 open before this group), `css/app.css` keys `hm-body`, `iq-pop` and `cs-pop`, `css/phone.css::ids::top`, `js/ui.js`, `js/accounts.js`, `js/flavours.js` and remaining shell and module boot wiring. Move CSS regions to their owning layer only after checking the winning declarations. Include unresolved `js/map.js` exports in the existing Map module if still open at entry. Hand off the exact remaining composer/conversation/decisions keys in `js/app.js` and `css/app.css`, including `composer` and `say`, to group 6.

**Keep outside the package** · `index.html` except any link-only changes assigned to the integrator, `js/decide.js`, `js/cardparts.js` and conversation/composer/decision internals. Leave the Escape, inert and Tab behavior moves and shim deletion to P4.

**Entry and exit** · Freeze carried-over groups' public interfaces and take a stylesheet order baseline before moves. Exercise normal boot, navigation, theming and Settings. Test stylesheet winners, including menu focus and inverse surfaces. Finish with boot and the explicit conversation holdback in `js/app.js`. Six or more slices. Run serially.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.

## 5. Index and mounted frame

**Base** · Verified group 4 gate.

**Files and ledger** · `index.html` and its open region and ID keys (79 open after P2). It keeps the visible frame. Move owning markup to the existing shell and module mount points, claiming each destination before editing. Record duplicate IDs, moved IDs and call-site imports in each slice.

**Keep outside the package** · `js/app.js` and `css/app.css` except integrator-owned wiring, layer behavior, tokens, and feature controllers. Conversation and composer logic remains group 6.

**Entry and exit** · Verify first stylesheet, import map and versioned asset paths, boot ordering, landmark and accessible labels, toolbar focus and one live node per moved region. Check that a module can access its markup by normal boot without extra global mounts. Four to six slices. Run serially.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.

## 6. Conversation, composer and decisions

**Base** · Verified group 5 gate.

**Files and ledger** · `js/decide.js` (9), `js/cardparts.js`, `modules/conversation/`, `modules/decisions/` and the exact conversation, composer and decision ledger keys for `js/app.js` and `css/app.css` handed over from group 4. Claim conversation tests and the parked attachment handoff pieces still needed after group 1. Keep panel Files or other feature implementations outside the package.

The shared-source ledger keys owned by group 6 are listed below. In each list, append the named final component to the indicated key prefix.

- `css/app.css::ids::` · `composer`, `say`.
- `js/app.js::functions::` · `convHost`, `messagesOf`, `proseHtml`, `threadCardHtml`, `queuedMeta`, `nameOf`, `moveBannerHtml`, `passedTo`, `startHtml`, `startDraft`, `msgItems`, `msgItemsOf`, `hostNeedHtml`, `checklistRender`, `createDock`, `dockSwap`, `fitDock`, `dockEdges`, `dockRender`, `openAsk`, `HER`, `heraldShow`, `heraldFor`, `heraldPut`, `heraldNext`, `heraldDrop`, `heraldRender`, `heraldRoom`, `heraldBack`, `chipRender`, `wireComposer`, `chipHtml`, `trayRender`, `addFiles`, `insertText`, `wireTray`, `growSay`, `running`, `sendRender`, `chatTargetRender`, `targetLineRender`, `updateComposer`, `syncPlaceholder`, `atClose`, `pickAt`, `saveDraft`, `loadDraft`, `sendNowRender`, `stopLive`, `stopsHerald`, `stopRun`, `interruptRun`, `lift`, `liveBlock`, `blockFor`, `refuse`, `connDest`, `composerDest`, `sendLive`, `deliverLive`, `postLive`, `postWithFiles`, `send`, `retry`, `putBack`, `editFailed`, `tpMount`, `tpShow`, `tpUnmount`, `tpHead`, `drawThreadPage`, `createConv`, `loadAhead`, `loadOlderNow`, `drawConv`, `readingPlace`, `holdPlace`, `stirred`, `foldsBefore`, `workMotion`, `saveScroll`, `liveReady`, `follow`, `loadChatHops`, `ensureRoot`, `decideKey`, `showMsg`, `fwdSource`, `reactionsHtml`, `reactorName`, `youText`, `askPlace`, `askAboutLines`, `composeAbout`, `askAboutFile`, `lrefRender`, `sendAbout`, `decideLimit`.
- `js/app.js::ids::` · `conv-title`, `tphead`, `tpthead`, `tscroller`, `tcolumn`, `tmsgs`, `ttyping`, `tpdock`, `tptdock`, `tpcomposer`, `tsay-label`, `tatt-tray`, `tsay`, `tattach`, `tatt-input`, `ttarget`, `tiq`, `tsend`, `tatt-note`.

**Keep outside the package** · `index.html`, tokens, Files, timeline renderer and shell layer behavior. Route new cross-module needs through existing contracts and propose any missing contract to the coordinator.

**Entry and exit** · Land characterization tests before the first move. Pin composer focus by desktop versus touch entry, drafts, attachment/send/stop/retry, decisions and Undo, and focus and scroll on in-place redraw. Exercise all through DOM or public API and show each new test failing on a deliberate break. Exit with boot and compatibility shims only at the legacy entry point, and zero unresolved `planned` code entries across P3. Six or more slices. Run serially and last.

#### Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

At exit, list every touched source file's line count and target. Check that the files are efficient, readable and cohesive, with clear boundaries, one-line comments and docstrings at most, and no dead code, duplicate helpers or layered workarounds. Give the integrator the local branch, its base, the move diff, clean-export checks and deliberate-break results.
