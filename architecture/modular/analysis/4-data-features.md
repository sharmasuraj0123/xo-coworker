# 4. Data layer and big features: analysis

Snapshot: /tmp/xo-6c73139 (release/2026-11-19 @ 6c73139). Scope: js/storm.js, js/sse.js, js/api.js, js/lpapi.js, js/world.js,
js/model.js, js/record.js, js/recordview.js, js/map.js, js/create.js, js/launchpad.js, js/paths.js, js/merge.js (6,458 lines).
Every file was read in full. Line numbers are the snapshot's. Section 3 is the full frontend-to-xo-space contract (every route
and every SSE event type, for the whole frontend, not just this scope).

Import graph inside the scope:
`world.js -> storm.js -> {api.js, sse.js, model.js, blocks.js, timeline.js, review.js, runtimes.js, paid.js, comms.js, hopstate.js}`;
`launchpad.js -> lpapi.js -> api.js`; `recordview.js -> record.js, api.js`; `map.js -> api.js, world.js (esc)`;
`create.js -> api.js, world.js (esc)`; `paths.js -> api.js (missingRoute)`; `merge.js` has no imports.
App wiring: app.js:71 `createWorld()`, :248 `createPaths`, :264 `createRecord`, :385 `createMap`, :395 `createLaunchpad({api: createLpApi()})`, :3973 `initCreate`.

---

## 1. Per-file analysis

### js/api.js (428 lines)
- **Purpose.** The thin HTTP client for XO Space: one `request()` with deadlines and normalised errors, the Coder-token plumbing, attachment, upload and terminal-socket helpers, and a flat `api` object with one method per backend route.
- **Exports.** `coderHeaders`, `ApiError`, `STORM_DOWN`, `WRITE_MS`, `READ_MS`, `request`, `missingRoute`, `attachmentUrl`, `terminalSocketUrl`, `attachmentText`, `uploadAttachment`, `clientId`, `NEWEST`, `api`.
  Importers (20): storm, lpapi, media, changes, imagechange, lightbox, quickopen (missingRoute), intel, map, paths (missingRoute), viewer, recordview, files, create, settings, decide (clientId), app (api, uploadAttachment), chats, shells/term (api, terminalSocketUrl), shells/dock.
- **Imports.** None.
- **Coupling beyond imports.**
  - *Side effects at module load (16-33):* reads `?coder_session_token` from `location.href`, strips it with `history.replaceState`, and keeps it in **sessionStorage `xo-coder-token`**. Header `Coder-Session-Token` goes on every request; the token rides in the query for `<img>`/`<iframe>` attachments (159) and for the terminal WebSocket (166-171).
  - *Base path:* `BASE = "api"` (9) is relative to the page, so the UI works under a hub prefix. lpapi.js re-spells `api/deploy/...` by hand (lpapi 204, 219, 220).
  - *Error contract (94-133, 141-150):* four error shapes are folded into `ApiError{status, code, message, ...extras}`. The extras whitelist is `feature, count, sentence, what, confirm, summary, current` (129). Synthetic client codes: `timeout` (status 0), `network` (0), `signed_out` (401, from an opaque redirect), `bad_answer` (upload).
  - *Deadlines:* GET 30 s, writes 20 s (52-53); `continueThread` 60 s (289); download 300 s (393).
- **State it owns.** The Coder token (module closure). Nothing else.
- **Responsibilities.**
  1. Coder token capture and headers (11-36) -> core/platform/http (auth adapter).
  2. ApiError, error normalisation and missingRoute (38-150) -> core/platform/http.
  3. request/exchange/deadline/blob (56-133, 220-237) -> core/platform/http.
  4. Attachment URL, text and upload (XHR with progress) (153-215) -> core/platform/http (attachments), used by the composer and viewer.
  5. terminalSocketUrl (166-171) -> modules/shells (it needs only the base URL and token from http).
  6. clientId and NEWEST (240-243) -> core/platform/http (idempotency utilities).
  7. The `api` route table (245-428). Split it per domain: chat/storm routes -> core/services/storm-client; xo-projects file routes -> modules/files (files-client); clone, create and GitHub routes -> modules/create-project; terminal routes -> modules/shells; router, runtimes, policy and rules -> modules/settings; shape -> core/services/shape.
- **Smells.**
  - One god object of about 85 routes, each a one-liner, imported by 20 modules. Any feature can call any route, so there is no ownership.
  - Dead routes, called from nowhere in js/ or tests/: `chat` (272), `memory` (291), `memoryFile` (297), `patchSession` (308), `active` (309), `schedules`/`schedule`/`scheduleRuns` (339-341), `addRule` (324).
  - Error parsing is written three times: `exchange` 121-131, `errorOf` 141-150, `blob` 226-228.
  - Query strings are hand-built in `projectImage`/`projectVersion`/`projectDownload` (384-393) rather than through `query`.
  - `projectVersion` targets a different prefix, `/coworker/xo-projects/...` (391).
- **Proposed home.** core/platform/http (`request`, ApiError, token, deadlines, upload, attachments) plus per-domain clients colocated with their module. Each module declares the routes it uses in its manifest (this enables a contract test against section 3).

### js/sse.js (190 lines)
- **Purpose.** A WHATWG-compatible incremental SSE parser (`createParser`, 10-49) and a resilient fetch-based stream (`SSEStream`, 67-190). It sends headers (the Coder token and `Last-Event-ID`), reconnects with backoff, runs a watchdog, and handles `reset` frames.
- **Exports.** `createParser`, `SSEStream`. Importers: storm.js only. (lpapi.js has its own parser; see the lpapi smells.)
- **Imports.** None. `fetchImpl` is injectable (75) for tests.
- **Coupling.**
  - Owns the transport-level frames: `reset` (140, never forwarded to onFrame) and `snapshot` (141: its `data.seq` becomes the resume point when no id has been seen yet).
  - HTTP 400 `bad_last_event_id` makes it drop lastId and retry from now (121). An opaque redirect gives `signed_out` (113).
  - Timers: WATCHDOG 45 s (the server's heartbeat comes after 15 s of silence), STALE 25 s, retry backoff 1 s to 15 s with jitter, `down` after 3 failures (51-54).
  - No global listeners. Callers drive `nudge()` (storm.js 910-916).
- **State.** `lastId`, `fails`, `gen` (superseded-attempt guard), `state` (`connecting|live|reconnecting|down|closed`).
- **Responsibilities.** Parser (pure). Connection lifecycle: connect, retry, nudge, close. Reset protocol: `retention|ahead` await `onReset` then resume at `from_seq`; `slow` just resumes (149-158).
- **Smells.** None significant. It is clean and testable.
- **Proposed home.** core/platform/sse (as is). Export the parser so lpapi reuses it.

### js/storm.js (1242 lines)
- **Purpose.** The data engine. It normalises storm (chats, threads, messages, sessions, turns, runs, hops, review items, pools, policies, paid usage) into the `world.state` that views render. It owns the boot/hold/apply protocol over the one global stream, and it is the only writer for thread and message actions.
- **Exports.** `WAITING_STATES` (only used internally) and `stormSource(state, emit, event)` -> `{act, stop}`. Importer: world.js only. `world.act` is the public surface (section 2).
- **Imports.** api.js (`api, clientId, NEWEST, coderHeaders, STORM_DOWN`; STORM_DOWN is imported but unused), sse.js, blocks.js (`createTurns`), model.js (`tasksOf`), timeline.js (19 helpers: `stopOf, uiMsg, mergeRows, addReaction, updateMessage, stormAsks, mapLimit, currentPools, threadState, askingState, mainRuntime, BUSY_STATES, heldOf, queuedButWorking, statusLater, readSub, sessionRead, sessionBusy, pageAfter, canPageOlder, framesShort`), review.js (`hostOf, askedBy`), runtimes.js (`isLimitItem, limitItem`), paid.js (`paidBody, paidItem, accountRows, heldModes`), comms.js (`commsLine, commsHeader, commsText`), hopstate.js (`hopRank, mergeHop`).
- **Coupling beyond imports.**
  - **Starts itself on construction** (`boot()` at 900): the stream, the GETs and the timers all begin inside `createWorld()`.
  - Global listeners (never removed): `visibilitychange` (910-915: nudge the stream, loadStatus, maybeChats) and `online` (916).
  - `setInterval` 60 s (901-909): prunes turns not watched and caps finished runs at RUNS_KEEP=300. It is never cleared, not even by `stop()`.
  - Timers: status every 30 s, or 8 s on error (23-24, 433); runtimes every 5 min (25, 447); recover 8 s (315); commit debounce 30 ms (`soon`, 279); emit debounce 40 ms (`emitSoon`, 280); hops re-read debounce 400 ms (934); boot wait for the first frame, at most 4 s (891); reload race 15 s (326).
  - Every /api route it calls and every SSE type it consumes is in section 3.
  - Its own discrete events through `event()`, consumed via `world.onEvent`:
    - `done|ask|state` (246), `spawn` (247), `resumed` (248), `message` (654);
    - `moved` (691), `file` (736), `shape` (790), `now_became_add` (727), `coord_failed` (755), `you` (923).
    - Consumers: app.js:81 (shape -> SHAPE.heard), app.js:239 (file -> viewer and PATHS.changed), app.js:485 (message, ask, resumed, moved, done, state -> herald and waitSince), chats.js:421 (now_became_add).
  - Reads `state.projects/threads/loaded` that world.js created. It writes most of `state` (41-68).
- **State it owns (on world.state).**
  - `status, statusError, statusCode, runtimes, router, pools, advisory, paidOk, paidPools, paid, policy, chatPolicy, controls, moves, conn, connInfo`;
  - `timeline, hist, found, threadMsgs, threadHist, sessions, awaiting, failed, routed, review(Map), runs(Map), hops(Map), liveRuns, turns, lastSeq`;
  - `projects, threads, hosts, error, errorCode, loaded`.
  - Private: `chatProject` (chat -> project), `rawThreads` (raw rows), `held` frames plus `holding`, `watched {projects, thread, side, session}`, `trimmed`, `framesBefore`, `fromIndex`, `heldMoves`, `sought`, `hopsRead`, `threadHops`, `wanted`, `refetchBusy`.
- **Responsibilities, region by region.**
  1. 23-38 constants (page sizes, caps, intervals; COORD roles) -> core/services/storm/config.
  2. 85-97 project/chat mapping, `coordinatorOf` (the newest non-retired coordinator session by seq) -> core/services/storm/sessions.
  3. 99-185 session truth: `sentAt`/`sessRead`/`sessionNow` order HTTP reads against stream frames by seq, plus `evidenceOf`/`onTurn`/`heldOfSession`/`agentPool`/`threadBusy` -> core/services/storm/sessions. This is subtle; see the risks.
  4. 150-166 moves (F4 continued threads), chatPolicyOf, limitsFor (F5) -> core/services/storm/threads.
  5. 186-232 `uiThread`: raw row -> UI thread (state, busy, held, asks, stop, moves, limits). The **thread view-model** -> core/services/storm/threads.
  6. 235-276 `commit()`: rebuilds `state.threads` (sorted by lastAt), emits change events, and builds `state.hosts` (the review items with no thread: usage, plain chats, workspace proposals). Hosts belong to modules/decisions (via a selector); thread rebuilding stays in services.
  7. 283-345 loading chats and threads, plus `scheduleRecover`/`recover` -> core/services/storm/load.
  8. 346-374 sessions paging and `noteSession` merge rules -> sessions.
  9. 375-387 review items paging -> modules/decisions data (core/services/review).
  10. 388-413 routed receipts (workspace -> project copies via `extra.forwarded_from`) -> core/services/storm/hops.
  11. 414-473 status, pools, runtimes, router, paid usage (advisory and intents), runtime policies -> core/services/account (pools/paid/policy) plus modules/settings (router, runtimes).
  12. 476-483 `loadAll` (boot fan-out with LOAD_CAP=6) -> load.
  13. 485-616 timelines and threads paged by seq: `loadTimeline`, `loadOlder`, `loadThread` (messages, turns and hops together), `loadOlderThread`, `loadOlderTurns`, `noteControl`, `loadTurns` (two `/chat/events` reads side by side) -> core/services/storm/history.
  14. 620-843 **the stream reducer** `onFrame`/`apply`: a 205-line switch over 29 frame types -> core/services/storm/reducer. Split it into a reducer registry keyed by frame type (messages, threads, sessions, runs, review, hops, chat/settings/pool, file).
  15. 845-858 `refetchThread`, `settleAwaiting` -> threads.
  16. 860-916 `reload` on reset, `startStream`, `boot`, prune interval, global listeners -> core/services/storm/lifecycle.
  17. 919-996 `post`, hops (`loadThreadHops`, `hopsSoon`, `holdMove`/`putHop`), `findRows`/`walkFound` (a batched backwards search for rows by id) -> history/hops.
  18. 998-1239 the `act` API (about 55 members): writes, watchers, selectors, run control, feature flags -> split into storm command and query facades per sub-service.
- **Smells (with lines).**
  - A god module. `apply()` is one 215-line function (629-843). `uiThread` mixes four concerns (188-232).
  - Hidden start: `boot()` at module construction (900), plus an interval and global listeners with no teardown. `stop()` (1240) does not clear the 60 s interval or the `soonT`/`emitT`/`hopsT`/`recoverT` timers and does not remove listeners.
  - `act` mixes commands (reply, ask, resolve, decideItem…), queries (replying, doing, sessionBusy…), watch registrations and raw pass-throughs (`run`, `transcript`, `stopRun`, `stopRuns`, `stop` 1178-1190). There is no separation.
  - `act.decide` (1072) is a stub that always rejects (one caller).
  - `chatPolicyOf` (164) duplicates `act.policyFor` (1102-1105).
  - `act.chatId`, `act.chatIdOf` and `act.projectOf` are duplicate aliases (1224-1238).
  - `STORM_DOWN`, `coderHeaders` and `WAITING_STATES` are used only as headers or internally. `STORM_DOWN` is imported and unused.
  - Mutation everywhere: `state.projects.push` (776), `p.pin =` (783), `h.loading =` (513). Views get the same mutable objects.
  - `setProjects` (283-292) and the `chat` frame (770-786) both build project rows: duplicated shape.
  - `uiThread` re-lists `state.review` for every thread (`openItemsFor`, 100-104; `limitsFor`, 166). That is O(threads × items) on each commit.
  - recordview.js reads `/chat/chats` again itself (recordview 82) to learn `seen`, because storm drops the `seen` field in `setProjects`.
- **Proposed home.** core/services/storm, split into `client` (routes), `stream` (boot/hold/apply/reset), `reducers/*` (per frame type), `selectors/*` (thread view-model, hosts, busy/held), and `commands` (writes). Hosts and review go to modules/decisions; paid and policy to core/services/account; router and runtimes to modules/settings.

### js/world.js (56 lines)
- **Purpose.** A façade: it creates the shared `state`, the subscriber set and the event bus, and hands them to `stormSource`.
- **Exports.**
  - `STATES` (no importer);
  - `WAITING` (kit, decide, app);
  - `createWorld` (app);
  - `ago` (no importer);
  - `esc` (rtsettings, turnview, paidview, settings, ui, decide, map, runsview, chats, create, intel, app).
- **Imports.** storm.js.
- **Coupling.** `state.activity` is a ring of the last 200 events (27-28). `subscribe` fires at once if loaded (36).
- **State.** `{projects, threads, activity, busy, loaded, error, now}`, extended by storm.
- **Responsibilities.**
  1. Store plus pub/sub -> core/platform/store (a generic store primitive).
  2. The event bus -> core/kernel/bus (typed `world:*` topics).
  3. Selectors `thread`/`project`/`waiting` -> core/services/world selectors.
  4. `esc`/`ago` -> core/platform/util (`esc` duplicates util.js:17's `esc`).
- **Smells.** It is a dumping ground for HTML escaping, which 12 modules import from the "world". The `busy` field is set and never used here. `STATES`/`ago` are dead.
- **Proposed home.** core/services/world (the store and selectors), with esc/ago moved to core/platform/util.

### js/model.js (34 lines)
- **Purpose.** Pure parser for a thread's `status_md` checklist (✱ ○ ◯ ✓ ✔).
- **Exports.** `parseChecklist`, `tasksOf`. Importer: storm.js (`tasksOf`, 205). The shells import their own `js/shells/model.js`, not this file.
- **Responsibilities and home.** One: the checklist parser -> core/services/storm/threads (a pure helper) or modules/threads/checklist. The name `model.js` is misleading next to shells/model.js; rename it to `checklist.js`.
- **Smells.** None.

### js/lpapi.js (239 lines)
- **Purpose.** The deploy API client and its view-model for Launchpad. It turns Space's `/deploy/*` check and preflight into one model per project, maps Space's 11 deploy steps onto four card rows, and follows the deploy SSE stream with resume.
- **Exports.**
  - `nextStep`, `formKey`, `appState`, `launchpadUrl`, `sizeWords`: imported by launchpad.js;
  - `model`, `rows`, `RETRY`: used by tests;
  - `createLpApi`: imported by app.js:395.
- **Imports.** api.js (`request, coderHeaders, ApiError`; ApiError is unused).
- **Coupling.**
  - Routes: section 3, deploy group. Two of them go through **raw `fetch`** (189) with a hand-built `api/deploy/...` path (204, 219, 220).
  - It consumes the deploy SSE event vocabulary (section 3.3).
  - Hard-coded `XO_ORIGIN = "https://dev.xo.builders"` (57) for "Open in Launchpad" links.
  - Resume: on a drop it waits 3 s, then `GET watch?run=&after=seq`, at most 5 times; a 204 means "ended" (178-208).
- **State.** A module-level `checks` Map (210), shared because `createLpApi()` returns the same singleton `real` (239). `RETRY` is a mutable export.
- **Responsibilities.**
  1. `NEXT`/`OUTSIDE`/`nextStep` (24-40): Space action -> button. Belongs to the modules/launchpad view-model.
  2. `formKey` (45-47) -> the launchpad view.
  3. `NODE`/`ROWS`/`appState`/`sizeWords`/`sizesOf` (49-78) -> the launchpad view-model.
  4. `model(check, pre)` (81-113) -> the launchpad view-model.
  5. `rows(on)` (117-154), the step-to-row reducer -> the launchpad view-model.
  6. `sse`/`stream` (157-208) -> core/platform/sse. Reuse `createParser`; this one splits only on `\n\n` and ignores `event:` lines.
  7. The `real` client (211-236) -> modules/launchpad/client.
- **Smells.**
  - A second SSE implementation.
  - A singleton cache behind a factory.
  - The origin is hard-coded per environment.
  - `hostOf` is duplicated: lpapi 60, recordview 456, launchpad `split` 45.
  - The GitHub device-flow client is duplicated with api.js `githubConnect`/`githubConnectPoll`, used by create.js. The two differ: lpapi adds `disconnect` and `cancel` and reads `expires_in`.
- **Proposed home.** modules/launchpad/{client.js, model.js}. Move the GitHub device flow into a shared `core/services/github` (or modules/connectors) used by both create-project and launchpad.

### js/launchpad.js (1166 lines)
- **Purpose.** The Launchpad panel section: deploy a project to the web. It covers the head summary, the setup form, the run, live, failed, needs and getting screens, the GitHub device flow, linking or unlinking an app, Stop with Undo, and Ask an agent. It also renders the header's Deploy button.
- **Exports.** `LP_ICON`, `createLaunchpad({api, projectOf, nameOf, findThread, go, announce, notify, notice, unnotice, onChange})`. The returned object is `{mount, paint, away, has, tone, inspect, lostFocus, ensure, button}`. Importer: app.js:395. stage.js calls `mount`, `paint`, `tone`, `has`; app.js calls `button`, `ensure`, `away`.
- **Imports.** ui.js (ICON), lpapi.js, util.js (`esc`, `copyText`, `COPY_REFUSED`), keynav.js (`pointerFollows`), redraw.js.
- **Coupling.**
  - **localStorage `xo-lp-state`** (36): project -> last check state only.
  - DOM outside its own markup:
    - `[data-fr-fold="launch"]` (924, 963), `.lp-hs`/`.lp-ha`/`.fr-b` inside the stage section (1071);
    - `[data-lp-open]` (header buttons, 926), `#scroller`, `#home` (928), `#stage [data-stg-close]` (930);
    - `body.stage-open` (769, 919, 924); `matchMedia("(max-width: 760px)")` (919).
  - A document `keydown` listener in the capture phase (1117), registered on every `mount()`. It must run before stage.js's Esc.
  - A window `resize` listener (1074).
  - `<xo-select>` (dropdown.js) and its `.dd-btn` internals (674, 1093).
  - Timers: 200 ms countdown intervals (741, 887), Stop window 3 s, Unlink window 3.2 s (38), Copied 1.6 s, GitHub poll 2.5 s, re-check after 5 min or 60 s on error (37).
  - Herald coupling through injected `notify`/`notice`/`unnotice` with message ids `lp-stop:<p>:<at>` and `lp-unlink:<p>`.
- **State.** `P` (Map project -> {check, form (including env secrets in memory), run, device, picking, needs, warn, asked, menu, seq/applied tickets…}). `S` holds the mount points, the last key/html, the focus `want`, and `lost` (a test hook).
- **Responsibilities, region by region.**
  1. 61-122: per-project store, ticketed `load()` (stale-answer guard) -> modules/launchpad/store.
  2. 124-153: `take()` applies stream rows to the run -> store.
  3. 155-231: `preflight()`, `watch()`, `event()` (a decision -> form; replaced, lost, ended, needs codes) -> store/controller.
  4. 233-274: the `screen()` state machine (12 screens) and `summary()` (head words and tone) -> view-model.
  5. 276-367: `system()`, the 4-node mini-flow and full cards -> view.
  6. 369-628: screen renderers (setup, machine rows, field, run, lost, live, failed, askState, needs, getting, device, pick, checking, bodyHtml) -> view.
  7. 630-708: `forget` (wipes secrets), `paint` (redraw with focus and caret preserved), `keyOf`, `syncPreview` -> view.
  8. 712-768: `validate`, `deploy` (a 3 s Undo), `begin` (builds the POST body, including `env` and `sensitive`) -> controller.
  9. 771-803: GitHub device flow with ownership guards -> shared github service plus controller.
  10. 805-824: pick and link -> controller.
  11. 826-933: Stop protocol (window, `stopNow`, `keep`, `startStop`, `stopped`) and `fromNotice` focus routing -> controller.
  12. 935-1057: menu, `copied`, `act()` (a 38-case action switch) -> controller.
  13. 1062-1134: `over`, `mount` (event delegation, the Esc capture) -> view.
  14. 1136-1165: the public API, including the header `button()` -> module entry.
- **Smells.**
  - `act()` is a 100-line switch.
  - Focus management (`land`/`want`/`lost`) is threaded through every action.
  - It mixes the deploy domain with DOM for screens, header and herald.
  - A document-level capture listener is added per mount, with no unmount.
  - It knows the shell's DOM: `#stage`, `#scroller`, `#home`, `body.stage-open`, `data-fr-fold`.
  - `onOpen`/`onHide` are module-level `let`s set by mount (1058).
- **Proposed home.** modules/launchpad, containing `client.js` + `model.js` (from lpapi), `store.js`, `controller.js`, `views/*.js` and `section.js`. It registers into `panel.section` (keyed "launch"), `header.action` (Deploy), and `herald` notices, through the kernel instead of the shell's DOM. Secrets handling must stay in-memory only.

### js/create.js (364 lines)
- **Purpose.** The "Create XO Project" dialog: an empty scaffold, or a Git clone run as a Space clone job with progress, Stop, and an in-place GitHub device-flow connect.
- **Exports.** `slugify`, `parseRepo` (pure; tests), `initCreate(ctx)` -> `{open, close, isOpen}`. Importer: app.js:3973.
- **Imports.** world.js (esc), ui.js (`ICON, $, RM`), api.js, attach.js (`fmtSize`), redraw.js, focusview.js (`usable`), util.js (`copyText, COPY_REFUSED`).
- **Coupling.**
  - Static markup in index.html: `#create-dlg, #create-form, #cp-name, #cp-desc, #cp-repo, #cp-submit, #cp-cancel, #dlg-ic, #cpm-empty, #cpm-clone, #cp-err, #cp-where, #cp-repo-ic, #cp-gh, #cp-mode, #cp-repo-f, #cp-prog, #cp-phase, #cp-stop, #cp-bar, #cp-facts, #cp-time, #cp-hint`.
  - **It writes into app state:** `ctx.S.desc[id]`, `ctx.S.local["p:"+id]`, `ctx.S.n++` (290-291). It reaches into app.js's private store to fake a first conversation line.
  - Through ctx it uses `ctx.world.act.refresh`, `ctx.go`, `ctx.heraldShow`, `ctx.announce`, `ctx.setDrawer`, `ctx.onPhoneClose`. It reads `ctx.world.state.projects` (312).
  - `RM` (the reduced-motion media query) controls the 160 ms close animation.
  - Timers: GitHub poll every 5 s (124, 127; it keeps polling with the dialog closed), clone status every 1 s (195), progress tick every 1 s (188).
- **State.** `root` (projects folder), `mode`, `nameTouched`, `busy` ({t0, label, host, cloneId, st, timer}), `gh` (device flow), `login` timer, `opener`, `rootP`, `checking`.
- **Responsibilities.**
  1. `slugify`/`parseRepo`, the GitHub URL grammar (17-40) -> modules/create-project/repo.js (pure).
  2. GitHub connect UI and device flow (63-128) -> shared github service plus a view.
  3. Mode/busy/progress rendering (130-189) -> view.
  4. The clone job follower and Stop (192-221) -> controller.
  5. The clone error vocabulary -> words (224-243) -> modules/create-project/errors.
  6. open/close/focus return (245-284) -> core/ui dialog plus the module.
  7. `done` (287-298), which seeds the project's first line and the herald, and `check`/submit (300-335).
- **Smells.**
  - It writes `ctx.S` (app.js internals): a hidden cross-module mutation.
  - The device-flow logic is duplicated with launchpad.
  - It depends on static markup in index.html, so it cannot be registered or unregistered as a module.
- **Proposed home.** modules/create-project. It registers a `dialog` plus `command` ("Create project") and `sidebar.action`/`home.action` entries. "First line in the new project" becomes an event (`project:created`) that modules/conversation handles.

### js/paths.js (83 lines)
- **Purpose.** Every file in a place (project root or worktree) as a flat list, for ⌘P and the tree's Find. It uses `GET /xo-projects/{p}/paths` (stamp-aware) when Space has it, otherwise a parallel walk of `/tree` (4 workers, at most 20,000 paths, skipping .git, node_modules and similar).
- **Exports.** `createPaths({api, onChange})` -> `{of, load, changed, drop, routeMissing}`. Importer: app.js:248, which feeds `QO` (quickopen) and FILES. app.js:239-245 calls `.changed()` from `file.version` events.
- **Imports.** api.js (`missingRoute`); `api` is injected.
- **State.** `P` (Map `"project|base"` -> {state, paths, truncated, stamp, via, gen}) and the `routeMissing` latch.
- **Responsibilities.** Path index plus incremental create/delete/rename -> core/services/files-index (shared by modules/files and search/quickopen).
- **Smells.** None serious. It uses `paths.includes` (O(n)) per change and re-sorts each time. That is fine at 20k.
- **Proposed home.** core/services/paths (or modules/files/services/paths, exported to quickopen).

### js/merge.js (101 lines)
- **Purpose.** Pure line-level three-way merge (Myers diff plus git-style conflict markers, keeping EOLs) for saving over an agent's edit (409 `file_changed`).
- **Exports.** `linesOf`, `changes`, `merge3`. Importer: docs.js:21.
- **Imports.** None. **State.** None.
- **Proposed home.** core/platform/util/diff (or modules/files/merge). Pure and portable as is.

### js/record.js (340 lines)
- **Purpose.** Pure logic for the project "record". It covers:
  - Made items: from threads' `outputs`, or from the server's `/made` rows;
  - kinds, filters and groups, plus the Artifacts virtualised gallery layout;
  - git state words;
  - "Since you left" catch-up groups and headline;
  - seen-time persistence.
- **Exports.**
  - `AWAY_MS`, `madeKind`, `KINDS`, `KIND_WORD`, `previewOf`, `madeKey`, `madeItems`, `madeFromServer`, `filterMade`, `madeGroups`, `artsView`;
  - `galleryLines`, `linesIn`, `mergeMadeRows`, `olderCursor`, `gitState`, `didLine`, `firstSentence`, `catchUp`, `headline`, `awayWord`, `sinceWord`, `createSeen`.
  - Importer: recordview.js (`import * as R`), plus tests (record.test, artifacts-preview).
- **Imports.** None.
- **Coupling.** `createSeen(store, key="xo-seen")` (330-340) persists **localStorage `xo-seen`** (the store is injected).
- **Responsibilities.**
  1. Made model (20-119, 184-202) -> modules/artifacts/model.
  2. Gallery virtualisation (145-176) -> core/ui/virtual-list (generic: lines with y and h, plus a binary search).
  3. `gitState` (212-232) -> core/services/git-words. Changes, threads and record all need it.
  4. Catch-up (234-327) -> modules/home/since (or modules/record).
  5. `createSeen` -> core/services/seen (merge with the backend's `/seen`).
- **Smells.** It combines three features in one file (Made/Artifacts, git words, Since you left). `didLine`/`firstSentence` are general text helpers.
- **Proposed home.** Split into modules/artifacts/model.js, modules/since/model.js, core/services/git-state.js and core/ui/virtual.js.

### js/recordview.js (855 lines)
- **Purpose.** The record on screen. It draws:
  - the "Since you left" card, line and Home lines;
  - the panel's Made tab and Home's "Recently made" strip;
  - the Artifacts page (virtualised, with a preview queue and Cache Storage);
  - ⌘K items for made files;
  - pins, and opening made files in the viewer.
- **Exports.** `madeNaming`, `createRecord({world, go, VW, PROJ, schedule, announce, mark})` -> `{placeOf, leave, projectSince, homeSinceHtml, sinceLine, homeSinceLines, homeMade, madeCount, jumpItems, latestOf, artifacts{render,count}, made{mount,show,count}, panel (setter), refresh, view (setter)}`. Importer: app.js:264.
- **Imports.** motion.js (`syncList, fadeImage, setHtml, setText`), redraw.js, keynav.js (`radioKeys, rovingTab`), record.js, api.js, util.js (esc), ui.js (`ICON, $, short`), timeline.js (`sharedFileRoute`), fileicons.js, media.js (`midName, midNameHtml`), skeleton.js (`skTile, bar, rememberedMade`).
- **Coupling.**
  - **Storage:** localStorage `xo-seen` (via R.createSeen, 61) and `xo-made-pins` (36). **Cache Storage `xo-previews-1`** (379), with synthetic keys `/__xo-preview/{pic|text}/…` (412).
  - **Network at construction:** `api.chats()` (82) for the per-chat `seen` marks. That duplicates storm's `/chat/chats` read.
  - Routes: `/chat/chats/{c}/seen` PUT (91), `/chat/worktrees` (127), `/chat/chats/{c}/made` (256, 291), `/made/{id}/pin` (587), `/xo-projects/{p}/file` (433), `/xo-projects/{p}/image` (450).
  - Global listeners (never removed):
    - `document` visibilitychange (113) and `pagehide` (118);
    - a **document-wide click delegate** (813-840) for `data-rec-got`, `data-rec-more`, `data-made-open`, `data-made-pin`, `data-made-file`, `data-made-go`.
  - It emits `data-go="t:…"`/`"p:…"` for app.js's global `data-go` handler.
  - DOM ids outside its markup: `#since` (151, 185), `#arts` (728), `#home`, `#scroller` (820). Its own: `#made-q, #made-f, #made-body, #made-h, #made-sub, #arts-q, #arts-pj (xo-select), #arts-f, #arts-body, #arts-sub`.
  - Observers: ResizeObserver and IntersectionObserver (715-725). `requestAnimationFrame` batching (`landed` 408-411, scroll 713). OffscreenCanvas downscales thumbnails to WebP (417-424).
  - `panel.open("made")`, `panel.isOpen` (236, 826); `VW.open(...)` (577); `world.thread/project/state`.
- **State.** `since`/`done`/`more` (per page), `trees` (worktrees cache, 60 s), `pins`, `remoteSeen`, `M` (Made tab), `served` (per-chat Made pages: {rows, more, end, pages, v, off}), `memo`/`allMemo`, `thumbs`/`texts`/`failed`/`nearY`, `PQ` (the preview queue, PREV_CAP 3), `A` (Artifacts virtual-list state), `currentView`.
- **Responsibilities, region by region.**
  1. 48-58 `madeNaming` -> modules/artifacts/view.
  2. 60-119 seen marks (local plus remote), `arrive`/`leave`, visibility -> modules/since (core/services/seen).
  3. 121-134 worktrees cache (`treesFor`) -> core/services/worktrees (also used by settings and dock).
  4. 136-231 Since-you-left renderers (card, line, Home lines, Home card) -> modules/since. These register in `conversation.header-line` (`#since`) and `home.section`.
  5. 233-331 served Made pages (newest, then older pages; 404 means fallback), memoised madeIn/madeOf -> modules/artifacts/store.
  6. 333-455 the preview pipeline (queue, Cache Storage, thumbnail downscale, text previews) -> modules/artifacts/previews. The cache is a candidate for core/services/blob-cache.
  7. 456-507 card HTML plus in-place card make/update -> modules/artifacts/view.
  8. 509-596 the Made tab (panel) plus openFile/togglePin -> modules/artifacts as `panel.page` "made".
  9. 598-631 Home's "Recently made" -> `home.section`.
  10. 633-802 the Artifacts page (virtualised, anchored scroll, focus preservation) -> `sidebar.place` "artifacts".
  11. 804-810 ⌘K items -> `search.provider`.
  12. 812-840 the global click delegate -> per-module delegated events through the kernel.
- **Smells.**
  - Four features in one closure: Since-you-left, Made tab, Home strip, Artifacts page.
  - Global listeners on document.
  - A duplicate `/chat/chats` fetch.
  - `prio()` (389) reads `A` before `A` is declared (643). It works only because it runs later, so it is TDZ-fragile.
  - Two setters (`panel`, `view`) are injected after construction: a two-phase init.
  - `hostOf` and `size` are duplicated (456-457; fileicons/attach have similar).
  - It reads `world.state.threads` directly in several places.
- **Proposed home.** modules/artifacts (Made tab, Artifacts page, Home strip, ⌘K provider, preview pipeline) and modules/since (Since-you-left: card, line, Home). Both depend on core/services/{seen, worktrees, made}.

### js/map.js (1360 lines)
- **Purpose.** The Map ("Live"): where agents are working, drawn as a folder diagram (tree layout) or a force-directed graph, with per-agent coloured cursors that glide between files.
  - It follows the current view (thread -> its worktree; project -> its folder plus all agents; Home -> projects).
  - It has pan, zoom and pinch, Fit, Follow, a Graph/Diagram toggle and small-target press rules.
  - It runs hosted in the right panel (stage.js) or standalone (#map, legacy).
- **Exports.**
  - `MAP_ICON`, `colorOf`, `folderOf`, `placeOf`, `pathsInCommand`, `activityOf`, `layoutOf`, `edgePath`, `createMap`.
  - Importers: app.js:385 (createMap), changes.js:16 (`folderOf, placeOf`), files.js:24 (`activityOf, folderOf`), and tests (map, map-follow, map-reach, map-focus-reveal, map-follow-cursor, agent-tag).
- **Imports.** world.js (esc), ui.js (`ICON, $, elapsed`), api.js, markdown.js (`renderInline`), util.js (`isImagePath`, imported but unused), comms.js, timeline.js (`heldWords`), fileicons.js, redraw.js.
- **Coupling.**
  - **localStorage `cv-map`** (standalone open, 28/227/1149) and **`cv-map-mode`** (graph|tree, 42/246/652).
  - DOM: `#map` (225), `document.body` classes `map-open`/`map-full` (1138, 1150-1151, 1270, 1289), `[data-map-toggle]` (1269, 1357).
  - **A document click listener for `[data-stage]`** (1237), registered inside `bind()`, so once per bound node. It runs twice once a host is mounted. `aria-controls="map"`.
  - Global listeners: `document.fonts` loadingdone (248); `afterPause` adds and removes capture listeners for keydown, pointerdown, wheel and touchstart on window (212-222); `matchMedia("(max-width:760px)")` (478); a ResizeObserver per bound node (1250-1263).
  - Keyboard on the drawing: `+ = - _ 0 F G Arrow*` (627-639); Esc closes standalone (1245-1248). ⌘\ is named in the header comment; the shortcut itself lives in app keys.
  - Data: `world.state.turns` (activity rows from blocks.js), `world.state.threads/projects`, `world.thread/project`, `world.act.coordinatorBusy`. The injected `isBusy(t)` comes from app.
  - Route: `GET /xo-projects/{p}/tree` (325).
  - Viewer coupling (standalone): `viewer.isOpen/hasFile/file/park/unpark/close/refresh/isParked` (1126-1163, 1237-1244).
- **State.** `M` (about 35 fields): open, view, full, hosted, dirs cache, opened, closed, more, shown, autoOpen, cams per scope|mode, refs, curs, layout, the graph's positions, alpha and raf, lead/anchor, waking/wakeGen. `el` and `saved`.
- **Responsibilities, region by region.**
  1. 48-197 pure geometry and parsing (`colorOf`, `folderOf`, `placeOf`, `norm`, `pathsInCommand`, `activityOf`, `layoutOf`, `edgePath`).
     - `folderOf` and `placeOf` go to core/services/places (also used by changes and files).
     - `activityOf` and `pathsInCommand` go to core/services/agent-activity (also used by files).
     - Layout goes to modules/map/layout.
  2. 207-222 `afterPause` -> core/platform/scheduling (a generic "after input pause"; see memory: the page is never idle).
  3. 255-314 scope, agents, coordinators, words (`doingLine`, `verbOf`) -> modules/map/agents. The agent words also appear in the panel's Agents frame (`agents()` 1330).
  4. 316-332 the folder loader (a per-level tree cache) -> shared with files.js's tree reader (core/services/tree).
  5. 335-425 box builders (`folderTree`, `projectsTree`, `boxHtml`) -> modules/map/view.
  6. 427-763 canvas, camera, fit, press-size rules, reveal, pan/zoom input, tools, frame/settle, keepInView, holdStill -> modules/map/camera plus input. A generic pan/zoom camera could become core/ui/canvas.
  7. 765-828 cursors -> modules/map/cursors.
  8. 830-967 the force graph (step, collide, draw, kick) -> modules/map/graph.
  9. 969-1114 `headHtml` plus `paint()`, the orchestrator (a 120-line function) -> modules/map/view.
  10. 1116-1167 `liveIn`, standalone tabs, setFull, setOpen -> standalone code. **Delete it in the rebuild:** the panel hosts the Map; keep only the hosted path.
  11. 1169-1273 bind/close/input routing.
  12. 1276-1359 the public API (hosted: mount/show/hide/unmount/live/agents/mode/setMode/liveIn; standalone: toggle/tabs/open/close/render/button).
- **Smells.**
  - Two hosting modes in one module. About 150 lines of standalone code are legacy ("until the panel lands"), which per memory are leftovers to strip.
  - The duplicate document listener per `bind()` (1237).
  - `paint()` is a 120-line god function.
  - `isImagePath` is imported and unused.
  - Pure helpers (`folderOf`/`placeOf`/`activityOf`) live in a view module, so changes.js and files.js depend on map.js.
  - It reaches `world.state.turns` internals (`turns.list`, `turns.blocksOf`).
- **Proposed home.** modules/map (registers into `panel.page` "live"/"map", `header.action` Map button and dot, `command` ⌘\). Pure helpers move to core/services/places and core/services/agent-activity.

---

## 2. Domain summary

### 2.1 Proposed module boundaries
| New home | Takes from | Notes |
|---|---|---|
| core/platform/http | api.js 1-243 (request, ApiError, token, deadlines, attachments, upload, clientId, NEWEST, missingRoute) | One error parser instead of three. Extras whitelist kept. |
| core/platform/sse | sse.js (whole); lpapi.js 157-208 rebuilt on `createParser` | Two consumers: the global stream and the per-deploy stream. |
| core/services/storm | storm.js split into client / stream (boot-hold-apply-reset) / reducers by frame type / selectors (uiThread, busy/held, coordinatorOf) / commands | Owns `world.state`. Its event bus goes through kernel/bus. |
| core/services/world | world.js store, subscribe and selectors; model.js -> threads/checklist.js | `esc`/`ago` go to core/platform/util. |
| core/services/account | storm.js 414-473 (status, pools, advisory, intents/paid, runtime policy) plus `setPaid`/`setPolicy`/`policyFor`/`agentHeld` | Read by the composer, settings and decisions. |
| core/services/review | storm.js 375-387, 822-839, 1079-1096 (`decideItem`) plus hosts from `commit()` 253-275 | modules/decisions renders it. |
| core/services/places + agent-activity | map.js `folderOf`, `placeOf`, `pathsInCommand`, `activityOf` | changes.js, files.js and map use them. This removes the changes/files -> map dependency. |
| core/services/paths | paths.js | Quickopen and files. |
| core/services/worktrees, seen, git-state | recordview `treesFor`, record `createSeen` plus remote seen, record `gitState` | Shared by Since, Artifacts, Changes and Settings. |
| core/services/github | lpapi `githubStart/Poll/Cancel` plus api `githubStatus/Connect/ConnectPoll` | One device-flow service with an "owner" token, so two UIs never fight over Space's single login slot. |
| core/platform/util/diff | merge.js | Pure. |
| modules/map | map.js minus pure helpers, minus standalone mode | |
| modules/launchpad | lpapi.js plus launchpad.js | client, model, store, controller, views. |
| modules/create-project | create.js | A dialog and a command. |
| modules/artifacts | recordview 233-810 (Made tab, Home strip, Artifacts page, ⌘K, previews) plus record.js Made/gallery | |
| modules/since | recordview 60-231 plus record.js catch-up | |

### 2.2 Places (slots) this domain needs
| Place | Kind | Scope | Registered by |
|---|---|---|---|
| `panel.page` | keyed (id -> {title, icon, mount, show, hide, live(v), count(v)}) | conversation (follows the view) | map ("live"), artifacts ("made"), launchpad ("launch" section, see next row) |
| `panel.section` | keyed, ordered (sticky top section, foldable head with tone light) | project | launchpad (head words and tone via `paint(v,open)`, `tone(v)`, `has(v)`) |
| `header.action` | list, priority-ordered | conversation (thread/project views) | map (Map toggle plus live dot), launchpad (Deploy button with tone) |
| `conversation.header-line` | single (the `#since` slot under the header) | project | since (`sinceLine`) |
| `home.section` | list, ordered | app | since (`homeSinceLines`), artifacts ("Recently made") |
| `sidebar.place` | keyed (a page with its own route and count) | app | artifacts ("artifacts": `render`, `count`) |
| `search.provider` | list | app | artifacts (`jumpItems`), paths (⌘P source) |
| `command` / `shortcut` | keyed | app | map (⌘\, G/F/0/± inside the canvas), create-project ("Create project") |
| `dialog` | keyed | app | create-project |
| `herald.notice` | service (`notify`/`notice(mid)`/`unnotice`) | app | launchpad (stop/unlink notices with Undo), create (ready/failed) |
| `thread.card.action` | list | conversation | artifacts (`latestOf(tid)`: the finished card's "open the newest file") |
| `world.reducer` | keyed by SSE frame type | app | storm sub-services. Later: any module wanting a frame (e.g. `file.version` -> files/viewer/paths) |
| `world.event` (bus topics) | pub/sub | app | storm emits `world:message`, `world:thread-state`, `world:moved`, `world:file`, `world:shape`, `world:now-became-add`, `world:coord-failed`, `world:you` |

### 2.3 Public API to other modules (proposed)
- **world (core/services/world).** `state` (read-only snapshot), `subscribe(fn)`, `on(topic, fn)`, `thread(id)`, `project(id)`, `waiting()`. Selectors:
  - `isBusy(sessionId)`, `heldFor(session|agent|project)`, `replying(project)`, `doing(project)`, `coordinatorOf(project)`;
  - `chatIdOf`, `projectOf`, `policyFor(project)`, `feature(session,key)`.
- **storm commands.** `reply`, `ask`, `resolve`, `editThread`, `deleteThread`, `restoreThread`, `decideItem`, `setPaid`, `setPolicy`, `stop(session)`, `stopRun`, `stopRuns`, `refresh`, `fetchThread`.
- **storm watches.** `watch(projects)`, `watchThread`, `watchSideThread`, `watchSession`, `loadOlder`, `loadOlderThread`, `loadTurns`, `loadHops`, `loadChatHops`, `findRows`, `takeTrimmed`, `noteSession`/`sentAt` (plain-chat reads in stream order). Keep these names. They are the 50 `world.act.*` members used today (counts in the act grep: projectOf 12, reply 7, findRows 6 …). `act.decide` (stub) and the alias duplicates can go.
- **places.** `folderOf(thread)`, `placeOf(root, target)`.
- **agent-activity.** `activityOf(turns, session, root)`, `pathsInCommand`.
- **paths.** `of(place)`, `changed(place, ev)`, `drop`.
- **artifacts.** `madeCount(pid)`, `latestOf(tid, pid)`, `jumpItems(q)`.
- **since.** `leave(from,to)`, `placeOf(v)`.
- **launchpad.** `has(v)`, `tone(v)`, `ensure(v)`, `button(v,open)`.
- **map.** `live(v)`, `agents(v)`.
- **create-project.** `open()`.

### 2.4 Risks in the move (subtle behaviour that is easy to lose)
1. **Boot hold/apply ordering** (storm.js 887-899, 620-628): open the stream first, wait for the snapshot (at most 4 s), GET everything, then apply held frames in order. `lastSeq` advances even while holding (624-625), so reads sent during the load are ordered correctly. Getting this wrong loses or reverts changes made during the load.
2. **Read-vs-frame ordering for sessions** (116-125, 359-374, 684, 1037, 1068): each HTTP read is stamped with the stream seq **when it was sent** (`sentAt`). A status frame newer than the read wins; a retirement is never undone by a read. Do not "simplify" to last-write-wins.
3. **queuedButWorking / held / busy** (131-144, 177-185, 194-196): Working means a running turn or sub-agents. "Queued" plus work seen after it means working. Held (pool closed or paid) shows "Waiting" with what it waits for. Waiting on you is never Working. Several views (map, launchpad askState, composer) depend on these exact words.
4. **`coordinatorOf` selects the newest non-retired coordinator by seq** (89-97) *before* checking busy. An old session's "queued" must not make a chat busy or become Stop's target.
5. **Awaiting/failed for "is replying"** (649-655, 743-758, 852-858, 1136-1144): a failed turn for our wake clears awaiting unless the wake was requeued (`wakes_requeued`, an interrupted restart). There is a 1.5 s grace in settleAwaiting and a 10 min cap.
6. **Reset protocol** (sse.js 149-158; storm 860-872): `retention|ahead` reloads in place (no false "new thread" events, because `state.loaded` and `holding` gate events, 245) and resumes from `from_seq`. `slow` reconnects only. `bad_last_event_id` restarts from now.
7. **Paging rules:** each older page is fetched exactly once. A thread's first page waits for its turns *and* hops so rows don't slot in later (546-550; "438 px at 4×"). Older thread pages bring their turn frames with them (568-572). OLDER_PAGE=30 for frame-time reasons (QA #10).
8. **`findRows`** (948-996): one batched backwards walk per project, at most 6 pages of 50. Results go to `state.found`, never the visible timeline (a regression once grew a conversation from 45 to 402 rows).
9. **Hop state is monotonic** (935-947): receipts that arrive before the hop are held, so a cold load never shows a wait that already ended.
10. **Turn pruning** (901-909, 533-538): turns of unwatched sessions are pruned every 60 s and re-read when shown (`trimmed`). Plain chats register through `watchSession`.
11. **Optimistic writes with rollback:** resolve (1028-1045), delete/restore (1048-1061), Made pin (recordview 582-588), Unlink with a real 3.2 s Undo (launchpad 1010-1030), deploy with a 3 s Undo (741-747), and Stop with a window plus a receipt-only "stopped" (826-908).
12. **decideItem refusal semantics** (1079-1096): a refusal is never reported as made. The item is re-read and the caller gets `err.gone`/`err.item`. Idempotency keys come from `clientId`.
13. **Launchpad secrets:** env values live only in `P[p].form.env`. They are written to inputs as properties, never as attributes (672). They are wiped on `forget`, when the stream starts (212), or when sent with the section hidden (765). Never move them into a store that persists or logs.
14. **Launchpad stale-answer tickets** (90-93, 101-117, 163-176): an older check, preflight or refusal never overwrites a newer answer. The preflight-after-check rule (107) stops guesses from overwriting GitHub's answer.
15. **Focus contracts:** launchpad's `land()`/`lost` (65-72, 678-687; tests fail on any lost focus); map `focusNode`/`reveal`/press-size rules (443-449, 467-492, 556-572); recordview's Artifacts focus-follows-moved-card (666-708); create's opener return and aria-disabled-not-disabled (147-150, 245-284). Each one is backed by a grader finding cited inline.
16. **In-place redraw** (`redraw.js`) everywhere (map 857, 1089; launchpad 669; recordview 175): "a press still clicks while live data redraws" (HEAD f7498dc). New module renderers must keep node identity.
17. **The Map's lazy wake** (`afterPause`, 1301-1322): the redraw is deferred until input pauses, because the owner flagged click lag. The graph pauses when hidden (1324).
18. **Global listeners with no teardown** (storm 910/916, recordview 113/118/813, map 1237/248, launchpad 1074/1117): the kernel's register-then-undo lifecycle must own them, or hot-unregistering a module leaks handlers.
19. **create.js writes app.js's `S`** (290-291) to seed the new project's first line. If the migration drops it silently, the "created" line disappears.
20. **Backend-optional fallbacks:** the code treats each of these as optional and falls back when a 404 or 405 comes back, so they must be kept:
    - `/made` (recordview 257, 264), `/paths` (paths 37-38), `seen` on chats (84), the `git` and `summary` fields, `can_delete`, `continued_in`/`continued_from`;
    - runtime-policy (468), intents and advisory (457-460), Launchpad's `has()` on a 404 (1145).

---

## 3. Frontend <-> xo-space contract (whole frontend)

All paths below are under `/api` (the page-relative `api/` base, proxied by serve.py). "def" is the line in js/api.js where the route is defined; "callers" are every call site found by grep across js/ (vendor excluded). Routes marked **W** need the UI writer key, which serve.py adds itself (serve.py WRITER_ROUTES 106-114). Every request carries `Coder-Session-Token` when the app runs inside Coder.

### 3.1 HTTP routes
| # | Method | Path | def | Callers (file:line) | Query / body; notes |
|---|---|---|---|---|---|
| **Engine, runtimes, router, policy, paid** ||||||
| 1 | GET | /chat/status | 247 | storm.js:418 | Pools, review counts. Polled every 30 s (8 s on error). |
| 2 | GET | /chat/runtimes | 248 | storm.js:444 | Polled every 5 min, and on a new or held pool. |
| 3 | GET | /chat/runtimes/{runtime}/models | 249 | chats.js:236, intel.js:79 | |
| 4 | GET | /chat/runtime-policy | 251 | storm.js:468 | Optional (a failure means no policy). |
| 5 | PUT | /chat/runtime-policy | 253 | storm.js:1118 | {allowed, default, preferences, fallback} |
| 6 | GET | /chat/chats/{chat}/runtime-policy | 255 | storm.js:470, 1118 | 404 no_such_chat |
| 7 | PUT | /chat/chats/{chat}/runtime-policy | 257 | storm.js:1119 | Null fields follow the Space. |
| 8 | GET | /advisory | 259 | storm.js:457 | Plans, usage windows, paid facts. |
| 9 | GET | /chat/intent | 261 | storm.js:458 | {intents, pools} |
| 10 | POST | /chat/intent/paid | 263 | storm.js:1110 | {scope: space\|pool, scope_id, value\|null} (paid.js paidBody) |
| 11 | GET | /chat/router | 264 | storm.js:445; settings.js:74, 192 | |
| 12 | PUT | /chat/router | 265 | settings.js:151 | |
| 13 | GET | /chat/router/models | 266 | settings.js:74; intel.js:473 | |
| 14 | POST | /chat/router/models | 267 | settings.js:164 | |
| 15 | DELETE | /chat/router/models/{provider} | 268 | settings.js:182 | |
| **Chats, messages, threads, hops** ||||||
| 16 | GET | /chat/chats | 271 | storm.js:297; recordview.js:82 | Each row: kind, project, project_pid, routing, pin, retired_at, seen (newer backend) |
| 17 | GET | /chat/chats/{id} | 272 | *(none)* | Dead route |
| 18 | PATCH | /chat/chats/{id} | 273 | intel.js:538, 602, 611; settings.js:189, 206 | routing, agent, model, effort |
| 19 | GET | /chat/chats/{chat}/messages | 275 | storm.js:500, 516, 547, 569, 987 | {thread?, before_seq (NEWEST = 2^53-1), after_seq?, limit 40/30/50} -> {messages, next_before_seq, next_after_seq} |
| 20 | POST | /chat/chats/{chat}/messages | 277 | storm.js:922 (reply/ask) | {text, client_id, thread_ts?, attachments?} |
| 21 | GET | /chat/chats/{chat}/threads | 279 | storm.js:339 | |
| 22 | GET | /chat/chats/{chat}/threads/{ts} | 280 | storm.js:849 | |
| 23 | PATCH | /chat/chats/{chat}/threads/{ts} | 282 | storm.js:1036, 1067; intel.js:536 | {resolved?, paused?, title?, label?, intelligence?} |
| 24 | DELETE | /chat/chats/{chat}/threads/{ts} **W** | 286 | storm.js:1051 | Body {keep_branch, confirm?}. 409 would_lose_work {what, confirm} -> {deleted, undo_until} |
| 25 | POST | /chat/chats/{chat}/threads/{ts}/restore **W** | 287 | storm.js:1057 | {} |
| 26 | POST | /chat/chats/{chat}/threads/{ts}/continue | 289 | intel.js:627 | {agent, model, effort}; 60 s timeout |
| 27 | GET | /chat/chats/{chat}/hops | 290 | storm.js:399, 930, 1221 | {thread?, before_seq, limit 200/500} |
| 28 | GET | /chat/chats/{chat}/memory | 291 | *(none)* | Dead route |
| 29 | GET | /chat/chats/{chat}/memory/{path} | 297 | *(none)* | Dead route |
| 30 | GET | /chat/chats/{chat}/made | 293 | recordview.js:256, 291 | {limit 200/500, before (ISO)} -> {made, next_before}. 404/405 means fall back to thread outputs. |
| 31 | PUT / DELETE | /chat/chats/{chat}/made/{id}/pin | 294 | recordview.js:587 | |
| 32 | PUT | /chat/chats/{chat}/seen | 296 | recordview.js:91 | {} -> {seen:{seen_at, seen_seq}} |
| 33 | GET | /chat/chats/{chat}/attachments/{id} | 153-191 | attachmentText (viewer.js:727); `attachmentUrl` as an img/iframe src (media.js:256, lightbox.js:296, viewer.js:145, 726) | Token in the query for src= loads |
| 34 | POST | /chat/chats/{chat}/attachments?name= | 198-215 | uploadAttachment via app.js:2102 (attach.js tray) | Raw bytes, XHR with progress; serve.py MAX_UPLOAD |
| **Shape (per-person UI layer)** ||||||
| 35 | GET | /chat/shape | 301 | app.js:78 | {shape, version, updated_at}; 404 on an older backend |
| 36 | PUT | /chat/shape | 303 | app.js:78 | {shape, if_version}; 409 shape_changed {current} |
| **Sessions, turns, history, plain chat** ||||||
| 37 | GET | /chat/sessions | 306 | storm.js:352; chats.js:53 | {after_seq, limit 500} -> {sessions, next_after_seq} |
| 38 | GET | /chat/sessions/{id} | 307 | chats.js:117 | |
| 39 | PATCH | /chat/sessions/{id} | 308 | *(none)* | Dead route |
| 40 | GET | /chat/active | 309 | *(none)* | Dead route |
| 41 | GET | /chat/events | 311 | storm.js:582, 604, 605 | {session, before_seq, limit 500, kinds?="thread.control,thread.continued"} -> {events, next_before_seq} |
| 42 | GET | /messages/{nativeId} | 315 | chats.js:68, 125 | Plain-chat CLI transcript (observation) |
| 43 | POST | /chat/prompt | 316 | chats.js:368 | Plain chat send |
| 44 | POST | /chat/abort | 317 | storm.js:1190 (act.stop) | {session_id} |
| **Review and rules** ||||||
| 45 | GET | /chat/review | 320 | storm.js:380 | {state: open, limit 500, after_seq} |
| 46 | GET | /chat/review/{id} | 321 | storm.js:1087 | Re-read after a refused decision |
| 47 | POST | /chat/review/{id}/decision | 322 | storm.js:1081 | {…, idempotency_key}. Refusal codes: already_decided, withdrawn, expired, review_not_found |
| 48 | GET | /chat/rules | 323 | settings.js:222 | |
| 49 | POST | /chat/rules | 324 | *(none)* | Dead route |
| 50 | DELETE | /chat/rules/{id} | 325 | settings.js:258 | |
| **Sub-agent runs** ||||||
| 51 | GET | /chat/sessions/{session}/runs | 328 | storm.js:1172 | {tree: true, depth: 3, limit: 200} |
| 52 | GET | /chat/runs/{id} | 329 | storm.js:1178 | |
| 53 | GET | /chat/runs/{id}/transcript | 330 | storm.js:1179 | {after?, limit 200} |
| 54 | POST | /chat/runs/{id}/stop | 331 | storm.js:1180 | |
| 55 | POST | /chat/sessions/{session}/runs/stop | 332 | storm.js:1181 | |
| **Worktrees** ||||||
| 56 | GET | /chat/worktrees | 335 | recordview.js:127; settings.js:272; shells/dock.js:235 | {chat?} -> {worktrees, removed?} (would_lose, git) |
| 57 | DELETE | /chat/worktrees/{chat}/{ts} | 336 | settings.js:333 | ?confirm |
| **Jobs** ||||||
| 58 | GET | /schedules, /schedules/{id}, /schedules/{id}/runs | 339-341 | *(none)* | Dead routes |
| **Project files (xo-projects)** ||||||
| 59 | GET | /xo-projects/{p}/file | 346 | viewer.js:421, 422, 602, 732, 735; docs.js:342; recordview.js:433 | {relative_path, commit?, commit_path?, purpose?, version?} |
| 60 | PUT | /xo-projects/{p}/file **W** | 353 | docs.js:227; files.js:651 | {relative_path, content, base_version, confirm?}; header X-XO-Restore-Of. 409 file_changed {current}, 428 confirm_required, 403 read_only_place\|ui_only\|outside_project |
| 61 | GET | /xo-projects/{p}/versions | 359 | viewer.js:776 | {relative_path, limit 50, before?} |
| 62 | GET | /xo-projects/{p}/paths | 361 | paths.js:30 | {worktree?, stamp?} -> {paths, truncated, stamp} or {unchanged}. A bare 404 means fall back to the /tree walk. |
| 63 | GET | /xo-projects/{p}/search | 363 | quickopen.js:106 | {q, worktree?, regex, case, word, glob?, limit 500} |
| 64 | POST | /xo-projects/{p}/files/rename **W** | 366 | files.js:685, 707 | {relative_path, new_relative_path, confirm?} |
| 65 | POST | /xo-projects/{p}/files/delete **W** | 368 | files.js:723 | {relative_path, base_version?, confirm?} |
| 66 | POST | /xo-projects/{p}/files/mkdir **W** | 370 | files.js:684 | {relative_path} |
| 67 | POST | /xo-projects/{p}/edits/{editId}/undo **W** | 372 | files.js:739 | {} |
| 68 | GET | /xo-projects/{p}/changes | 379 | changes.js:104, 130 | {worktree?, path?} |
| 69 | GET | /xo-projects/{p}/tree | 382 | files.js:118; map.js:325; paths.js:50 | {relative_path?, hidden: true} -> {dirs, files} |
| 70 | GET | /xo-projects/{p}/image | 384 | media.js:384; imagechange.js:110; recordview.js:450; viewer.js:752 | ?relative_path (as a Blob) |
| 71 | GET | **/coworker**/xo-projects/{p}/version | 391 | imagechange.js:111 | ?relative_path&commit&commit_path?&hidden=true (as a Blob). Note the different prefix. |
| 72 | GET | /xo-projects/{p}/download | 393 | viewer.js:127; lightbox.js:297 | ?relative_path&hidden=true; 300 s |
| **Projects: create, clone, GitHub** ||||||
| 73 | GET | /config/workspace | 395 | create.js:265 | {roots, default} |
| 74 | POST | /files/mkdir | 397 | create.js:322 | {path, scaffold: true, display_name, description?}; 409 if it exists. (serve.py blocks the other /files/* routes.) |
| 75 | POST | /xo-projects | 402 | create.js:318 | {project_id, repository_url, display_name, description?, wait: false} -> 202 {clone_id} |
| 76 | GET | /xo-projects/clones/{id} | 404 | create.js:197 | Polled every 1 s: {state, phase, percent, received_bytes, idle_seconds, error, warning} |
| 77 | DELETE | /xo-projects/clones/{id} | 406 | create.js:213 | clone_finished/404 means it is already over |
| 78 | GET | /connectors/github/status | 408 | create.js:85 | {status, username?} |
| 79 | POST | /connectors/github/cli/start | 410; lpapi 230 | create.js:113; launchpad.js:782 (lpapi.githubStart) | -> {status: connected, imported?, username?} or {session_id, user_code, verification_uri, expires_in} |
| 80 | POST | /connectors/github/cli/poll | 411; lpapi 234 | create.js:122 (every 5 s); launchpad.js:790 (every 2.5 s) | {session_id} -> {status: pending\|connected\|failed, error?} |
| 81 | POST | /connectors/github/cli/cancel | lpapi 235 | launchpad.js:1036 | {session_id} |
| 82 | POST | /connectors/github/disconnect | lpapi 229 | launchpad.js:782 (githubStart(saved)) | {} |
| **Deploy (Launchpad), via lpapi.js** ||||||
| 83 | GET | /deploy/{p}/check | lpapi 212 | launchpad.js:106 | -> state, fields, config, git, prerequisites, reasons, blockers, warnings, running, summary |
| 84 | GET | /deploy/{p}/preflight | lpapi 215 | launchpad.js:107, 165 | ?name -> repo, github, launchpad{app, env_set, sizes, name_free, same_name} |
| 85 | POST | /deploy/{p} (SSE response) | lpapi 219 (raw fetch) | launchpad.js:764 | {name, port, size?, storage_path?, storage_size?, use_repo?, allow_apps?, create_repo?, repo_name?, rebuild?, recreate?, env, sensitive[]} |
| 86 | GET | /deploy/{p}/watch (SSE) | lpapi 220, 204 | launchpad.js:184; auto-resume | ?run&after=seq; 204 means ended for this viewer |
| 87 | DELETE | /deploy/{p} | lpapi 221 | launchpad.js:855 | -> {stopped: true\|false} |
| 88 | GET | /deploy/{p}/apps | lpapi 222 | launchpad.js:810 | -> {apps: [{id, name, status, url, linkable}]} |
| 89 | POST | /deploy/{p}/link | lpapi 223 | launchpad.js:820, 998 | {app} -> {config, app} |
| 90 | DELETE | /deploy/{p}/link | lpapi 224 | launchpad.js:1021 | Sent after the 3.2 s Undo |
| 91 | POST | /deploy/{p}/agent | lpapi 225 | launchpad.js:1042 | {note?} -> {thread_ts, title} |
| — | GET | /deploy/flow | — | *(none; named in the lpapi.js header only)* | Not called |
| **Shells (terminal)** ||||||
| 92 | GET | /terminal/status | 414 | shells/dock.js:96 | |
| 93 | GET | /terminal/sessions | 416 | shells/dock.js:103 | {project?, path?, workspace?} |
| 94 | GET | /terminal/sessions/{id} | 417 | shells/dock.js:265 | |
| 95 | POST | /terminal/sessions | 419 | shells/dock.js:204 | {project?, path?, name?, rows?, cols?} -> {terminal, ticket, ticket_expires_in} |
| 96 | POST | /terminal/sessions/{id}/attach | 421 | shells/term.js:106 | -> {ticket, …} |
| 97 | PATCH | /terminal/sessions/{id} | 422 | shells/dock.js:363 | {name} |
| 98 | DELETE | /terminal/sessions/{id} | 424 | shells/dock.js:286, 331 | |
| 99 | WS | /terminal/sessions/{id}/ws | 166-171 | shells/term.js:117 | The token rides in the query; the ticket is the first message (serve.py WS_PATH 269) |
| **The global stream** ||||||
| 100 | GET | /chat/stream (SSE) | 427 | storm.js:875 via sse.js:107 | Headers: Accept text/event-stream, Last-Event-ID ("N" or "N:k"). 400 bad_last_event_id |

Not under /api:
- `GET presets/{id}.json` (static, shape.js:352).
- msgx.js:276 only *proposes* `PUT /api/chat/chats/{chat}/messages/{key}/rating` (BACKEND TODO). It is not called yet.

Error codes the frontend acts on:
- Client-side codes from ApiError: timeout, network, signed_out, bad_answer.
- STORM_DOWN (api.js 48): engine_not_running, engine_elsewhere, engine_failed, store_refused, store_failed, stream_not_running.
- would_lose_work, shape_changed, file_changed, confirm_required, read_only_place, ui_only, outside_project, version_not_found, not_found.
- Clone codes (create.js 227-241): project_exists, invalid_repository_url, repo_not_found_or_private, auth_failed, host_unreachable, timed_out, clone_in_progress, too_many_clones, clone_not_found, invalid_project_details, clone_failed, clone_finished.
- `missingRoute` = 405, or a bare 404 with no code (or http_404).

### 3.2 Global stream (`/api/chat/stream`) frame types consumed
Envelope fields: `{type, id, seq, ts, chat_id, thread_ts, session_id, turn_id, data}`. A stored frame has an SSE `id:`; live-only frames (deltas, heartbeats, snapshot) carry none.

| Frame type | Consumed at | What it does |
|---|---|---|
| `snapshot` | sse.js:141 (resume point); storm.js:624 (lastSeq); blocks.js:172 | data.seq; data.turns[] {turn_id, session_id, chat_id, thread_ts, seq, held, blocks} replace open blocks |
| `reset` | sse.js:140, 149-158 -> storm.js:883 reload | data {reason: retention\|ahead (reload) \| slow, from_seq} |
| `message` | storm.js:637 | Row into the thread or project timeline; clears awaiting/failed; emits `message` |
| `reaction` | storm.js:658 | timeline.addReaction |
| `message.updated` | storm.js:668 | Attachments added after a turn (timeline.updateMessage) |
| `thread` | storm.js:679 | Merges the raw thread row (if no chat_id and unknown, refetch) |
| `thread.continued` | storm.js:688; also read via /chat/events kinds (614) | moves[from] = {to, agent, by…}; emits `moved`; refetches both |
| `thread.control` | storm.js:697; /chat/events (613) | controls[ts] (steer/interrupt/stop by a coordinator, F6) |
| `card` | storm.js:702 | The thread's card |
| `session` | storm.js:707; blocks.js:107 | Status, waiting; reasons created/paused/resumed/updated/attached/retired/now_became_add; ended statuses end running turns |
| `turn.started` | blocks.js:70; storm.js:738 | A new turn and its wakes; ends older running turns; queued -> working evidence |
| `turn.finished` | blocks.js:83; storm.js:743 | Status, wakes, wakes_requeued, error; drives `coord_failed` |
| `turn.stopped` | blocks.js:93 | by: turn_ended means self-ended (not shown as stopped) |
| `block.started` / `block.updated` / `block.finished` | blocks.js:118/135/159 (storm default branch -> emitSoon) | Turn blocks: text append, header, steps, items, rows by call_id |
| `hop` | storm.js:760 | Creation or state move; monotonic; re-read the thread's hops after 400 ms |
| `chat` | storm.js:770 | Creation (kind) adds a project; retired_at re-lists; routing/agent/model/effort updates |
| `settings` | storm.js:787 | key `router` -> state.router; key `ui.shape` -> emits `shape` |
| `pool` | storm.js:792 | Pool state; a new pool refreshes runtimes |
| `run.started` / `run.state` / `run.finished` | storm.js:801/807/812 | Sub-agent runs (stop_requested_at, summary, tokens…) |
| `runs` | storm.js:818 | Live counts per session {running, waiting, tokens} |
| `review.opened` | storm.js:822 | Opens an item |
| `review.decided` / `review.withdrawn` / `review.expired` | storm.js:826 | Removes it |
| `review.parked` / `review.annotated` | storm.js:830/835 | Parked + expires_at; annotations |
| `file.version` / `file.version.attributed` / `file.rescan` | storm.js:735 -> event `file` -> app.js:239 | viewer.fileChanged; paths.changed for create/delete/rename (data: project_id, path, old_path, kind) |
| *(any frame with an unknown chat_id)* | storm.js:635 | Re-lists chats (at most every 30 s) |

Heartbeats are ignored; the 45 s watchdog relies on them. Stored frames come back through `GET /chat/events`; storm.js:583 and 608 apply every type except thread.control and thread.continued through the turn store.

### 3.3 Deploy stream (`POST /api/deploy/{p}`, `GET …/watch`) event types consumed (lpapi.js rows 117-154, stream 178-208)
| Event `type` | Fields read | Effect |
|---|---|---|
| `run` | started_at, run_id | The run clock |
| `step` | step (check, credentials, repo, app, prepare, push, create, env -> repo row; build; release; url -> live), status running\|waiting\|done\|skipped, message, title | Row doing/done |
| `progress` | step, message, data{app_id (create), run_url (build), ready, desired, release} | Build link, release n of m, the new app's id |
| `done` | url, release, commit, app{id, name, slug} | Live |
| `error` | step, code, action, message, fix, data{source, app, failed_step, log_tail, run_url, port, exposed_ports, kind, release, diagnosis} | Failed row plus the fix |
| `needs` | code (name_taken, port_missing, repo_name_taken, create_repo, confirm_repo, other_apps, link_existing, app_missing), action, message, fix, options, data{suggestion, reason, repo, origin, branch, apps[], app} | A decision back to the form |
| `replaced` | by | Follow the new run |
| `ended` | run_id (and HTTP 204) | Re-check the project |
| `warning` | message | A note |
| `lost` | *(made by the client after 5 failed resumes)* | "Lost touch" |
Every event carries `seq` and `run_id` (dedupe on resume). Action vocabulary is in lpapi.js NEXT/OUTSIDE (24-34). Error codes with their own words are in launchpad.js:274 and 33.

### 3.4 Client-side storage this scope owns (for the ledger)
- sessionStorage: `xo-coder-token` (api.js).
- localStorage: `xo-seen` (record/recordview), `xo-made-pins` (recordview), `xo-lp-state` (launchpad), `cv-map`, `cv-map-mode` (map).
- Cache Storage: `xo-previews-1` (recordview).
