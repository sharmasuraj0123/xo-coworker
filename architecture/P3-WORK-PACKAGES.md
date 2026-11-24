# P3 work packages

Groups 1 and 2 share the verified release catch-up. Start after the coordinator confirms its short independent review. The integrator supplies the exact branch base with this package file and the review follow-ups. For later groups, the integrator records the exact commit from git after the listed dependencies pass their gates.

Run at most two Codex Sol threads at medium effort. The integrator assigns files before launch, reviews every change, merges group gates in order and applies one locally verified gate tag per group. Run one full check at a time on a clean `git archive` of the commit with `JOBS=1`, offline dev dependencies and a bounded process memory limit. Check each test file's exit code. Run `python3 tools/ledger/check_ledger.py --final` separately and record the lower count. Regenerate `architecture/modular/LEDGER.md` with `python3 tools/ledger/ledger_md.py .`. No browser run at these gates. Keep compatibility shims until P4, and keep all work local.

Hold `modular-full-check` for every full check. Confirm no browser run is active, read `free -m`, and wait if available memory is below about 1.5 GB. Use no helper sub-agents. Run at most one TypeScript checker or Node test process of your own at a time, and only stop processes you started.

A ledger claim on a source path covers its file record if open and its open `<path>::` item records. Keep resolved items intact except to correct a destination changed by your move. Group 4 owns the complement of group 6's named `js/app.js` and `css/app.css` keys. The integrator records any boundary adjustment before a group starts. Each slice targets about 400 changed lines. New source files have a 400-line ceiling, and existing files can only shrink. See the phase plan for rollback and deployment.

Groups 1 and 2 work in parallel on disjoint source, each owning its prerequisites. Group 3 starts after both land, since the timeline uses media and shares the turn step icon with Runs. Groups 4, 5 and 6 follow in order because their wiring and markup ownership depends on the earlier moves. Each worker keeps legacy entry paths stable, updates only its ledger keys and refreshes the generated view and ratchets locally. The integrator reviews each diff, merges in order, regenerates the ledger view and reconciles baselines downward. Work outside an assigned boundary goes to a worker in a separately claimed slice.

For test and fixture moves, the worker claims named files before editing. Broad suites and shared test utilities remain with the integrator until a single owner is assigned. Keep the checks runnable at the repository's normal entry points. Files and ledger entries outside every package are reconciled by the integrator at P3 exit, including tests, vendor assets, compatibility paths and retained tooling.

Report bugs, performance hotspots and accessibility findings in the handoff, with file, line and the evidence or trigger you saw. Include full re-renders, broad style invalidation, eager loads, recurring timers and listeners that outlive their surface when relevant. The integrator records them in HANDOFF for the post-P4 fix phase. P3 and P4 preserve behavior.

After the post-P4 fix phase and before P5, an independent reviewer audits the whole codebase for remaining patches, workarounds, oversized files, docstrings and duplicates, with file and line for every finding. Only proven behaviour-preserving cleanups go directly into isolated checked commits. Take any behaviour or visual proposal to the coordinator for owner approval.

## 1. Media, viewer and Files

**Branch** · `modular/p3-01-media-files`. Launch in parallel with group 2.

**Files and ledger** · `js/media.js` (80 open items), `js/attach.js` (24), `js/viewer.js` (16), `js/files.js` (26), `js/skeleton.js` (23) and `css/media.css`. Own `modules/files/`, `modules/home/skeleton.js` and the new shared media and attachment code under `core/services/media/`. Own `tests/{attach,media,files,files-stop-look,files-tree-scroll-fold,viewer-busy,viewer-errors,viewer-head-focus,viewer-hooks}.test.mjs`. Read the parked `modular/files` and `xo/thread-7ea52a` branches for prior work. Keep the attachment tray and platform helpers distinct from conversation wiring.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, `shell/panel/`, `modules/changes/`, `modules/conversation/` and all other packages' files. Keep the existing viewer entry as a compatibility adapter that supplies the relocated viewer with the existing Changes rendering functions. Preserve the first paint through the legacy `js/skeleton.js` entry.

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

**Branch** · `modular/p3-02-panels-lists`. Launch in parallel with group 1.

**Files and ledger** · `js/runsview.js` (17), `js/intel.js` (20), `js/chats.js` (9), `js/shells/{dock,model,term}.js` (40 combined), `js/model.js` (4), `js/gestures.js` (9), `js/ghpage.js`, `js/sideorder.js` and `css/side.css`. Own `modules/{chats,runs,shells,github}/`, `shell/gestures.js`, `shell/sideorder.js` and `tests/{chats-list,ghpage,intel-chip-toggle,runs-page,runs-stop-receipt,shells,side-calm-order}.test.mjs`. Use the parked `modular/threads` branch to find reusable slices. Own only the `stepIcon` and `cmdIcon` definitions and their private lookup helpers in `js/turnview.js`, plus `tests/pack-where-it-fits.test.mjs`. Move those definitions to a shared lower layer before the Runs slice, retaining the turnview exports. Leave all other turnview code and ledger entries for group 3. Intel can import `mainRuntime` from its existing home in `core/services/world/sessions.js`.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, Files and the rest of Timeline, shell panel transitions and the kernel layer stack. Keep the existing gesture entry as the compatibility adapter that supplies `wordsOf`. Leave the conversation implementation in place.

**Entry and exit** · Characterize chat setup and ordering, Runs retrieval/stop/undo, Intel selection, terminal focus and gesture Back. Cover the optional GitHub routes' 404 behavior and keep the rest of the module route contract strict. Keep stop receipts and the active element through in-place redraw. Five to seven slices. Parallel with group 1.

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

**Base** · Verified group 2 gate, after group 1 also passes. Confirm the existing compatibility surfaces still match P2 at entry.

**Files and ledger** · `js/timeline.js` (60), `js/msgx.js` (42), `js/recordview.js` (11), the remaining `js/turnview.js` keys (20 before the shared step-icon prerequisite), `css/msgx.css` (4), `js/record.js`, `modules/since/` and `modules/artifacts/` for Made. Own the new timeline and record renderers under `modules/conversation/`, plus `tests/{record,turnview,since-card-gone}.test.mjs`. Read `modular/services-2` and `modular/map-home` for pending slices. The quiet Since line and live Made entry points run through the release behavior verified in P2.

**Keep outside the package** · `js/app.js`, `css/app.css`, `index.html`, Files, Runs, composer and decision controllers. Keep the renderer public interfaces stable while those callers are still on legacy paths.

**Entry and exit** · Exercise ordering, redaction, text streaming, folded runs, focus during redraw, Made cards and Since through Home, panel or quick open as applicable. Check that conversation scroll remains owned by `follow.js`. Four to six slices. Run after group 2.

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

**Files and ledger** · Own remaining `js/app.js` keys (244 open before this group), `css/phone.css::ids::top`, `js/ui.js`, `js/accounts.js`, `js/flavours.js` and remaining shell and module boot wiring. Move CSS regions to their owning layer only after checking the winning declarations. Include unresolved `js/map.js` exports in the existing Map module if still open at entry. Hand off the exact remaining composer, conversation and decision keys in `js/app.js` and `css/app.css` to Group 6. Leave interleaved CSS in place, and include its ledger keys in the handoff.

**Keep outside the package** · `index.html`, `js/decide.js`, `js/cardparts.js` and conversation/composer/decision internals. Leave the Escape, inert and Tab behavior moves and shim deletion to P4.

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

**Keep outside the package** · `js/app.js`, `css/app.css`, layer behavior, tokens and feature controllers. Flag any required wiring for a separately assigned worker slice. Conversation and composer logic remains group 6.

**Entry and exit** · Verify first stylesheet, import map and versioned asset paths, boot ordering, landmark and accessible labels, toolbar focus and one live node per moved region. Check that a module can access its markup by normal boot without extra global mounts. Four to six slices. Run serially.

**Approved size exceptions** · At the Group 4 base, `shell/frame.js` is nine lines and `shell/overlays.js` is 120. They may grow only to mount the hidden regions from `index.html:70–71,121–135`. The existing mount files keep the regions together without adding eager startup requests. In review compare each moved markup block byte for byte and verify the same parents and sibling positions through normal boot. Both files must stay under 400 lines. Report the growth and its cause at handoff. The size rule still applies to every other existing file.

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

**Base** · The verified Group 5 merge at `modular-gate-P3-group-05`. Record the resolved hash in the launch message. Suggested branch `modular/p3-06-conversation-decisions`. No overlap with Groups 5 or P4.

**Files and ledger** · `js/decide.js` (9), `js/cardparts.js`, `modules/conversation/`, `modules/decisions/` and the exact conversation, composer and decision ledger keys for `js/app.js` and `css/app.css` handed over from group 4. Claim conversation tests and the parked attachment handoff pieces still needed after group 1. Keep panel Files or other feature implementations outside the package.

The shared-source ledger keys owned by group 6 are listed below. In each list, append the named final component to the indicated key prefix.

- `css/app.css::ids::` · `composer`, `say`, `hm-body`, `iq-pop`, `cs-pop`.
- `js/app.js::functions::` · `convHost`, `messagesOf`, `proseHtml`, `threadCardHtml`, `queuedMeta`, `nameOf`, `moveBannerHtml`, `passedTo`, `startHtml`, `startDraft`, `msgItems`, `msgItemsOf`, `hostNeedHtml`, `checklistRender`, `createDock`, `dockSwap`, `fitDock`, `dockEdges`, `dockRender`, `openAsk`, `HER`, `heraldShow`, `heraldFor`, `heraldPut`, `heraldNext`, `heraldDrop`, `heraldRender`, `heraldRoom`, `heraldBack`, `chipRender`, `wireComposer`, `chipHtml`, `trayRender`, `addFiles`, `insertText`, `wireTray`, `growSay`, `running`, `sendRender`, `chatTargetRender`, `targetLineRender`, `updateComposer`, `syncPlaceholder`, `atClose`, `pickAt`, `saveDraft`, `loadDraft`, `sendNowRender`, `stopLive`, `stopsHerald`, `stopRun`, `interruptRun`, `lift`, `liveBlock`, `blockFor`, `refuse`, `connDest`, `composerDest`, `sendLive`, `deliverLive`, `postLive`, `postWithFiles`, `send`, `retry`, `putBack`, `editFailed`, `tpMount`, `tpShow`, `tpUnmount`, `tpHead`, `drawThreadPage`, `createConv`, `loadAhead`, `loadOlderNow`, `drawConv`, `readingPlace`, `holdPlace`, `stirred`, `foldsBefore`, `workMotion`, `saveScroll`, `liveReady`, `follow`, `loadChatHops`, `ensureRoot`, `decideKey`, `showMsg`, `fwdSource`, `reactionsHtml`, `reactorName`, `youText`, `askPlace`, `askAboutLines`, `composeAbout`, `askAboutFile`, `lrefRender`, `sendAbout`, `decideLimit`.
- `js/app.js::ids::` · `conv-title`, `tphead`, `tpthead`, `tscroller`, `tcolumn`, `tmsgs`, `ttyping`, `tpdock`, `tptdock`, `tpcomposer`, `tsay-label`, `tatt-tray`, `tsay`, `tattach`, `tatt-input`, `ttarget`, `tiq`, `tsend`, `tatt-note`.

Group 6 also owns any other `css/app.css` rules interleaved with its conversation and composer regions. Group 4 leaves them in place and names the affected regions and ledger keys at handoff. This includes `#hm-body > div` and the shared mobile rule covering `#iq-pop` and `#cs-pop`. Move the interleaved rules with their respective regions, preserving exact source order and checking the cascade winners. Keep each shared rule intact.

The coordinator permits moving intact intervening shell and Settings regions into ordered imports in their owning folders. The source blocks must match byte for byte and their ledger ownership stays with the existing owners. Split the interleaved phone `@media` block only if the layer analyser's ordered declaration, conditional-rule and cross-layer contest digests match the pinned base. Expand imports at their slots and diff the payload line by line. For any split, rejoin only the identical adjacent media wrappers when reconstructing the source for that comparison. Report the stylesheet request counts before and after. The Group 5 HTML entry starts with 18 stylesheet links and 12 CSS imports, for 30 distinct static stylesheet URLs. Report any boot-added styles separately from that static graph.

Group 4 also hands off `js/app.js::functions::threadTargetHtml` to Group 6. Move it with `targetLineRender`, which uses it to render the composer's destination for a thread. Preserve all four `conv-title` call sites, including their normal header and panel render paths. Group 5 keeps the conversation and composer markup IDs intact and names any mount or unresolved ledger key it transfers. Check that handoff against the pinned ledger before the first move.

The Group 5 handoff at `91986c6c` closes all 79 open index keys and transfers no new ledger items. The main conversation, dock and composer stay in `index.html`. The decision panel markup now comes from `MAIN_LAYERS` in `shell/overlays.js` via the existing frame mount before app boot. Keep the current markup and mount contract. The decision-panel fallback focus finding stays in the post-P4 fix phase.

**Keep outside the package** · `index.html`, tokens, Files, timeline renderer and shell layer behavior. P4 owns the 18 keyboard and overlay keys listed in its brief, the compatibility entries, and direct-link cleanup that needs an index edit. Keep the current entry points working during each slice. Route cross-module dependencies through existing contracts and propose any missing contract to the coordinator. Keep existing attachment and Runs internals that are already in their destination modules. Update only their conversation call sites or bindings when moving a caller.

**Entry** · Record the Group 5 mount handoff, the open package ledger keys and baseline source order for the app stylesheet. Before moving an untested behavior, pin it through the DOM or public API and show the test failing under a deliberate break. Cover desktop versus touch entry, drafts, attachments, send, stop and retry, decisions and Undo, and focus and scroll on in-place redraw.

**Suggested slices** · Keep small commits within each slice. Start with conversation header and read-only markup, then separate the convo render and scroll wiring, decision card/checklist/dock rendering, composer markup and targeting, draft and attachment wiring, and send/stop/retry. Split large slices at existing contracts. Move CSS in separate commits with the owning region and preserve the expanded order, conditional rules and winners in both themes and phone layouts. Leave `follow.js` in charge of conversation scroll, and check that a held press survives redraw. Compare moved runtime bodies and styles with the pinned base.

**Exit** · Exercise main conversation, thread page and panel conversation through their existing entry points. Check draft keys and restoration, composer focus with touch behaviour pinned as the base, attachments and targets, send/stop/retry, decision and Undo focus, and active reading position. Module-local route contract tests use the pinned OpenAPI snapshot for moved callers and retain approved optional fallbacks. Run the full check and final ledger serially from a clean export under the lease. Close every Group 6 ledger item in its move commit. List and reconcile any remaining code, asset, tooling or test ledger entries against P4 or an explicit coordinator ruling. The legacy app entry carries boot wiring and the P4 holdbacks. Report file sizes, exact remaining keys and package findings for the post-P4 fix phase.

**Production review** · Review each moved module for a clear responsibility, readable domain names and real types. Check error and retry paths for swallowed failures, and trace timer, listener, observer and request ownership through open, close and remount. Identify work newly performed at boot and report stylesheet requests. Keep existing tokens and literals, one-line comments, and behavior tests proven by deliberate breaks. Flag inherited problems for the post-P4 phase.

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
