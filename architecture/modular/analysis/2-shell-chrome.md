# 2 · Shell chrome, platform primitives, UI kit, settings and shape

Snapshot: /tmp/xo-6c73139 (release/2026-11-19 @ 6c73139). Read only. Line numbers are the snapshot's own.
Importers were found by grepping `from "./<file>.js"` / `../<file>.js` over js/, tests/ and index.html.
Note on the brief: `js/shells/dock.js` exports **`createShells`**, not `createDock`. `createDock` is a different thing in
`js/app.js:1718` (the decision-card dock of a conversation, used for the main chat at :1872 and the panel's thread page at
:2727); it is out of this file's scope but is named below where it touches gestures.js.

---

## 1. Per file

### js/stage.js (867 lines)

- **Purpose.** The right-hand panel ("stage"): a 40 px title bar, a stack of foldable/resizable *frames* (Launchpad on top
  when open, then Threads [id `agents`], Changes, Map) and, in place of the frames, one *page* at a time (Shell, Files,
  Thread) with tabs. Owns its width, open/full/over state, focus/inert covering on phones, and Esc.
- **Exports.** `createStage(deps)` only. Imported by `js/app.js:40` (one instance, `STAGE`, app.js:404). 11 test files read
  its source text with regexes (moving code breaks them; see Risks).
- **Imports.** `ui.js` (`ICON`, `$`), `util.js` (`esc`), `redraw.js` (`redraw`), `focusview.js` (`usable`),
  `fileicons.js` (`fileIcon`), `changesframe.js` (`createChangesFrame`, `countsHtml`), `diffview.js` (`setTheme`).
- **Dependencies injected (createStage args, l.61).** `map` (mount/show/hide/agents/mode/setMode), `files` (`changes(v)`),
  `changes` (Space /changes client for changesframe), `openFiles()` (Files page), `viewer` (file viewer `open()`),
  `view()`, `go(view, event)`, `announce`, `onChange` (app re-render), `frames()` (shape-driven list of frame ids:
  app.js passes `SHAPE.list("panel")` minus the `xo:panel/` prefix), `launch` (Launchpad: mount/has/paint/away),
  `threads(v)` (grouped thread rows, app.js `panelThreads`), `shell(on, host)` (app.js `panelShell`). Plus a setter
  `names = fn` (place name for the title bar).
- **Coupling beyond imports.**
  - DOM it creates: `<aside id="stage" class="stage">` appended to **`#main`** (l.89). Ids it mints: `fr-title-*`,
    `fr-body-*`, `stage-map-tree`, `stage-map-graph`.
  - DOM outside itself: `document.body` classes `stage-open`, `stage-full`, `stage-over`, `stage-covers`,
    `stage-sizing`, `stage-vsizing` (l.377, 434, 768, 366, 790, 716); `document.documentElement` style `--sw` (l.767,
    774); reads `.side` width via getComputedStyle + ResizeObserver (l.746-751); `#herald` and `.toast-wrap` kept out
    of the inert cover (l.346, 354); every sibling under `#main`'s parent marked `inert` + `data-stage-inert`
    (l.351-365); `[data-stage-toggle]` buttons anywhere (focus return, l.403-407; the button HTML itself l.863);
    `[data-lp-open]` buttons anywhere get `is-on`/`aria-pressed` (l.427-430, the header's Deploy).
  - Data attributes it reads on its own markup (its event contract): `data-stg-close|full|shell|sections|act|tab|key`,
    `data-fr-fold`, `data-ghost`, `data-map-mode`, `data-open-files`, `data-follow`, `data-change`,
    `data-change-project`, `data-tg-fold|more|find|clear|q`, `data-go`, `data-gut`, `data-lp-tab`, `el.dataset.page`.
  - localStorage: `xo-stage` ({open}), `xo-stage-frames-3` (frame folds/heights/thread groups; migrates an old `h`
    to `rows`, l.68), `xo-stage-w` (sections width), `xo-stage-w:<pageName>` (per page kind width).
  - Window listeners: two `resize` (l.750, 783), ResizeObservers on `.stg-frames` (l.92) and `.side` (l.751).
  - Keys: capture-phase keydown on the panel (l.637-654): ← → Home End on map tabs; `/` focuses the Threads filter
    (bypasses keys.js; hard-coded); Esc chain. Gutters ↑↓, grip ←→, double-click resets.
  - Timers: rAF only (open entrance, focus restore double-rAF l.407, openLaunch).
  - Shadow DOM: knows the diff's controls live in a shadow root it can't untab (l.618-620).
- **State it owns.** `fr` (frames: folded, map h, agents rows, thread groups), `S` (lp, lpOpened, open, full, fullOf,
  returnTo, wide, stackH, agRows, agCap, chEmpty, tq, tqOpen, tgMore, page, tabs, single, dragW, h{} paint caches),
  `PAGES` (Map name → spec), `BOXES` (Map `name\0key` → host div), width vars `wSaved`, `wMine`, `sideWv`, `nameOf`.
- **Responsibilities inside, by region.**
  1. l.1-60 header, constants (frame order, Threads row maths `AG_ROWS`, `ROW`, `CH_MIN`, `HEAD`), local `ago()` → *shell/panel*.
  2. l.61-116 build the panel DOM, Threads filter field, mount Map into its frame, mount Launchpad, create the Changes
     frame (changesframe) and wire `openFile` to the viewer → *shell/panel host* builds the frame; the **frame contents**
     belong to modules: Threads → `modules/threads`, Changes → `modules/changes`, Map → `modules/map`, Launchpad →
     `modules/launchpad`.
  3. l.119-187 `layout()` / `capAgents()`: which frames show (shape), which grows, fold classes, Launchpad covering,
     Threads height in whole rows → *shell/panel (frame stack layout engine)*; the Threads-specific row cap should become
     a frame-provided `minHeight/rowSize` hint.
  4. l.189-207 `ghosts()`: Launchpad's foot shows copies of covered frames' heads (HTML rewritten by regex, l.200-201) →
     *shell/panel* (generic "covering frame" behaviour).
  5. l.209-260 Threads frame HTML (`threadsHtml`, filter `matchesQ`, `findThreads`, legacy `agentsHtml`) and legacy
     Changes list (`changesHtml`) → `modules/threads` and `modules/changes` (legacy list → `modules/files` fallback).
  6. l.261-281 `titleHtml()`: place name, ‹ Sections back button with "needs you" dot, page lead control, page tabs →
     *shell/panel title bar*.
  7. l.283-337 `paint()`: per-frame repaint with `redraw` and an elapsed-clock-insensitive cache, counts in heads,
     Changes empty→Threads gets room, auto-unfold Changes when files arrive (l.308-311), Follow button, wide mode for
     diffs, map tab state, full-size button → split: generic part to *shell/panel*, frame parts to their modules.
  8. l.339-368 `coverSync()`: inert everything except the panel/herald/toast when full or ≤760 px → *shell/panel* (a
     shared `core/ui` "modal cover" helper; the toast/herald exemption must become a registry of "always reachable" layers).
  9. l.370-439 `open/close/openLaunch/pressDeploy/setFull/toggle` → *shell/panel*; Launchpad toggling → `modules/launchpad`
     via a panel API (`stage.cover(frameId)`).
  10. **l.440-558 the Page API** (documented exactly below) → *shell/panel* + **core/kernel place `panel.page`**.
  11. l.560-568 `sync()` per app render → *shell/panel*.
  12. l.570-654 input: one delegated click router; focus guard under Launchpad (`focusAfter`, `untab`); keydown (map tabs,
      `/`, Esc chain) → *shell/panel*; map-tab and `/`-filter bits → their modules.
  13. l.656-733 frame gutters: drag/keys/double-click resize with Threads row snapping and map spill-over → *shell/panel*.
  14. l.735-805 width: default 360, 320-720, `WIDE` 560 for diffs, `READ` 560 min conversation, float over
      (`stage-over`), per-page widths, grip → *shell/panel*.
  15. l.807-866 public API object → *shell/panel* public API.
- **The page API (added 19 Nov; seed of the registry). Exact contract as implemented.**
  - Register: `stage.page(name, spec)` (l.458) — `PAGES.set(name, spec)`; re-registering replaces silently; no undo.
  - `spec` keys actually read by stage.js (the header comment l.441-452 lists only some; `lead`, `act` are undocumented there):
    | key | type | when called | notes |
    |---|---|---|---|
    | `title(key)` | → string | title bar (l.267), tab labels, `pages()` (l.829) | optional; falls back to `name` |
    | `icon(key)` | → html | tab strip (l.277) | optional |
    | `width` | number or `({room}) → number` | `pageSpecW()` l.760; `room = innerWidth − sidebar − 560` | 0/absent → page uses the sections' width |
    | `single` | bool | `tabOf()` l.457 | one tab per kind; its tab key is the **name**, the shown key lives in `S.single[name]` |
    | `lead(key)` | → html | title bar after ‹ (l.272) | Files' tree toggle |
    | `act(name, el)` | fn | click on any `[data-stg-act]` in the panel while this page shows (l.577-578) | page-owned head buttons |
    | `mount(host, key)` | fn | once, on first show of that tab (l.485) | `host` = `div.stg-pg[data-pg=name]` inside `.stg-page`, kept until the tab closes |
    | `onShow(key, {focus})` | fn | **every** `show()`, even when already showing (l.487) | receives the *shown* key |
    | `onHide(key)` | fn | switching away (l.476), `sections()` (l.508), `drop()` of the showing tab (l.532) | |
    | `unmount(key)` | fn | the tab is dropped (closeTab, eviction) (l.533); box removed after | |
    | `canClose(key)` | → bool \| Promise<bool> | before closeTab, panel × / Esc close (`requestClose`), eviction (l.466) | `false` refuses; **a throw counts as refusal**; absent = allowed |
    | `escape(key)` | → bool | Esc in the panel before anything else (l.652) | `true` = the page consumed Esc |
  - Key semantics trap: for `single` pages the tab key is the page *name*, so `mount`, `onHide`, `unmount`, `canClose`,
    `escape`, `lead`, `title` (in `pages()` l.829) receive `"files"`/`"thread"`, while `onShow` and the title bar
    (`titleOf`, l.267) receive the real key. Consequence: `stage.pages()` returns title `"Thread"` for the thread page
    (app.js:2765 `title: (key) => world.thread(key)?.title`) — a latent bug. The registry must pass one key consistently.
  - Operations: `show(name, key=name, {focus=false})` → false if unregistered; adds a tab (and starts async
    `evict`, not awaited), opens the panel if closed (no focus), hides the previous page (`onHide`), sets
    `el.dataset.page`, class `is-shell` for "shell", restores per-page full-size (`S.fullOf[name]`), applies width, mounts
    once, then `onShow`. `sections({paint})` → back to frames, tabs kept, remembers full-size per page, focus to the
    page's tab. `closeTab(name, key)` → asks `canClose`, drops it, shows the last remaining tab or returns to sections;
    resolves bool. `requestClose()` → asks every tab in order; the first refusal is brought forward with focus and the
    panel stays; otherwise `close()` (**tabs survive a panel close**: pages stay mounted, hidden).
    `pages()` → `[{name,key,title,on}]`; `pageShown` → `{name,key}|null`; `refit()` → re-apply width (Files calls it on
    tree fold / file open).
  - Limits: `TAB_MAX = 5`; over it, the oldest tab that is neither showing nor the new one is asked and dropped; refusals
    are skipped.
  - Esc chain (l.648-653): a non-empty `input` (not `.lp-in`) keeps Esc → page `escape()` → leave full size → back to
    sections (any page but shell) → `requestClose()`.
  - Width: a page with `width` gets `max(480, min(innerWidth−560, w))`, or the full window ≤760 px; dragged width saved
    per page name.
  - Registered pages today: **shell** (stage.js:554, only if `shell` dep given: `mount/unmount` no-ops, `onShow` →
    `shell(true, boxFor(S.page))`, `onHide` → `shell(false)`; app.js:3877 `panelShell` *moves* the `#shd` dock element into
    the box and back to its home under the page; a MutationObserver at app.js:3892 leaves shell mode when `#shd` hides);
    **files** (js/filespage.js:81: single, width fn, title, lead, act "tree", icon, mount, onShow, onHide, unmount,
    `canClose: viewer.confirmClose()`, `escape: viewer.escape()`); **thread** (js/app.js:2761: single, width
    560-720, title, icon, mount/onShow/unmount → tpMount/tpShow/tpUnmount, `canClose: () => true`, escape handles its menu
    and composer).
  - Head chrome tied to pages: Shell toggle button `[data-stg-shell]` only for "shell" (l.80, 546-547); ‹ Sections
    shown for every page but shell (l.270); a "needs you" dot from `threads()` (l.544).
- **Smells.**
  - God factory: one 800-line closure mixing frame layout, three frames' content, page host, width, focus cover (whole file).
  - Frame contents are hard-coded (`ORDER`, l.53; frame HTML l.83-87); Threads' filter, Changes' Follow, Map's tabs live
    in the host. A new frame = editing stage.js.
  - Duplicates: `ago()` l.44 ≡ `ui.elapsed()` (ui.js:251); `sget/sset` duplicated in dock.js:27-28 and elsewhere;
    `usable` from focusview vs keynav's different `usable` (see keynav).
  - Ghost heads built by regex-rewriting innerHTML (l.200-201): brittle against any markup change.
  - Hidden globals: `document.body` classes and `--sw` are a de facto layout API read by CSS everywhere.
  - Esc in Shell mode: the capture-phase keydown (l.637) only spares `input` targets; xterm's input is a `textarea`, so
    Esc typed in a terminal hosted in the panel is swallowed and closes the panel (shell has no `escape`, `requestClose`
    runs). keys.js says "a shell keeps Esc" and dock.js guards with `owns(e)` only in its own bubble listener. Likely bug —
    verify before porting, and give the shell page an `escape()` that returns true when focus is in `.xterm`.
  - `evict()` is async and unawaited inside `show()`; a refused eviction leaves >5 tabs silently.
  - `/` is hard-wired, not in keys.js's ACTIONS (unlike every other shortcut).
- **Proposed homes.** `shell/panel` (host, frames stack, title bar, tabs, width, cover, Esc, page host); the page registry
  itself in `core/kernel` as place **`panel.page`** (keyed by name) and frames as **`panel.frame`** (ordered list);
  Threads frame → `modules/threads`; Changes frame (+ legacy list) → `modules/changes`; Map frame wiring → `modules/map`;
  Launchpad covering → `modules/launchpad` using a generic `panel.cover(frame)` capability; `ago` → `core/platform/time`.

### js/shells/dock.js (704 lines)

- **Purpose.** The Shells dock under the main column (tabs of attached terminals plus a "Shells" list tab), the list of
  every shell from the backend, its sidebar toggle `#nv-shells`, rename/close/close-detached flows, phone sheet gestures,
  reattach on reload.
- **Exports.** `createShells({PROJ, notify, onChange, announce, wanted})` (l.36). Imported by `js/app.js:55` (`SH`,
  app.js:261, `wanted: () => SHAPE.on("xo:dock/shells")`). tests/panel-shell.test.mjs reads its source.
- **Imports.** `api.js` (`api.terminalStatus`, `terminals`, `openTerminal`, `terminal`, `closeTerminal`,
  `renameTerminal`, `worktrees`), `util.js` (`esc`, `COPY_REFUSED`), `redraw.js`, `ui.js` (`ICON`), `keys.js` (`is`,
  `label` for action `shells`), `./term.js` (`mountShell`), `gestures.js` (`drag`, `follow`, `glide`, `unstyle`, `tick`,
  `FLICK`), `./model.js` (row/state helpers).
- **Coupling beyond imports.**
  - DOM it does not create but requires: `#shd` (root, from index.html) and `#nv-shells` (sidebar button, needs a
    `.sh-n` child) (l.37-38); `#app` gets class `has-shd` (l.402); focus fallbacks by id `scroller`, `home`, `nv-shells`,
    `pb-menu`, `top-menu` (l.73). app.js *moves* `#shd` into the panel (app.js:3877-3889) and adds `.in-panel`.
  - sessionStorage `xo-shells` ({tabs, active, open, filter}: reattach on reload); localStorage `xo-shells-dock` ({h, min}).
  - /api routes (via api.js): GET terminal status, GET sessions list, POST open, GET one, DELETE close, PATCH rename,
    GET `/api/chat/worktrees` (thread worktree path), and per-tab attach ticket + WebSocket (term.js).
  - Timers: list poll 15 s while the list shows, 60 s otherwise (l.23-24, 114); `refreshSoon` 600 ms; countdown 250 ms
    interval while a tab is retrying (l.185).
  - Window/document: `visibilitychange` (refresh), `beforeunload` (asks if a live shell is attached, l.656),
    `matchMedia("(max-width: 760px)")` change.
  - Keys: `K.is(e,"shells")` passed to xterm to keep the toggle key from the shell (l.142); Esc minimises (l.576);
    ← → Home End on tabs; Enter/Esc in rename field. `owns(e)` = target inside `#shd .xterm` (l.661-664) so app shortcuts
    skip the terminal.
- **State it owns.** `R` (enabled/reason/statusAt, list/loaded/err, `tabs` Map id→{handle,pane,state,detail,title,exit,
  name,until}, order, active, filter, open, min, h, half, edit, confirm, busy Set, opening).
- **Responsibilities.**
  1. l.67-88 helpers, `away()` focus fallback, persistence → `modules/shells`.
  2. l.90-123 status + list polling, shells-off teardown → `modules/shells` (service part: `core/services/terminals`
     could own the list; the poll belongs to the module).
  3. l.125-197 tabs: attach (mount xterm), activate, detach, reconnect countdown → `modules/shells`.
  4. l.199-259 app-facing openers: `openProject`, `openWorkspace`, `openThread` (asks worktrees), `showList`, `toggle` →
     `modules/shells` public API; these are the "Open a shell here" actions that thread/project modules call.
  5. l.261-341 closing with confirm (foreground program check), close-all-detached → `modules/shells`.
  6. l.343-382 rename in tab or row → `modules/shells`.
  7. l.384-532 render: sidebar toggle, tabs, acts, confirm, notes, list rows → `modules/shells` (the sidebar toggle is a
     `sidebar.entry` contribution, not dock markup).
  8. l.534-622 events and the height grip → `modules/shells`.
  9. l.624-653 phone sheet drag (full/half/away) → `modules/shells` using `core/platform/gestures`.
  10. l.655-677 beforeunload guard, `owns`, boot reattach → `modules/shells`.
  11. l.679-703 API: `enabled`, `available`, `redraw`, `countFor(p)`, openers, `toggle`, `owns`, `shown`, `hide`,
      `raised`, `lower()` (phone Back) → `modules/shells` public API.
- **Smells.** Reaches into sidebar DOM `#nv-shells` directly (l.38, 386-398) — the sidebar should render an entry with a
  count the module provides. Focus fallback ids hard-code other features' DOM (l.73). Being moved between parents by
  app.js (panel Shell mode) is invisible to this module (it doesn't know it's in the panel; `away()` may focus things
  behind a covering panel). `sget/sset` duplicated (stage.js). Its own `render()` is called on every change (fine) but
  `changed()` also triggers an app-wide re-render via `onChange`.
- **Proposed home.** `modules/shells` (dock UI + list + openers) registering into `dock.bottom` (single), `panel.page`
  ("shell", replacing the stage's built-in), `sidebar.entry` (Shells toggle with count), `thread.menu`/`project.action`
  ("Open a shell"), `shortcut` (`shells`). Shape surface `xo:dock/shells` with capability `terminal`.

### js/shells/term.js (205 lines)

- **Purpose.** One terminal: xterm.js + FitAddon in a host, attaching over a WebSocket with a one-time ticket,
  flow-controlled output, reconnect with backoff, theme from CSS tokens.
- **Exports.** `themeFromCss(el)`, `mountShell(host, {id, ticket, on, keys})` → `{id, state, term, focus, refit,
  reconnect, dispose}`. Imported by `js/shells/dock.js:16` only.
- **Imports.** `../vendor/xterm/xterm.mjs` (`Terminal`), `../vendor/xterm/addon-fit.mjs` (`FitAddon`), `api.js`
  (`api.attachTerminal`, `terminalSocketUrl`), `util.js` (`copyText`), `./model.js` (`createFlow`, `backoff`,
  `closeMeaning`).
- **Coupling.** WebSocket to `terminalSocketUrl(id)`; first message `{type:"auth", ticket, rows, cols}`; control
  messages `resize`, `pause`/`resume`; server messages `ready`, `resync`, `exit`, `error`; close codes interpreted by
  model.js. CSS tokens `--mono`, `--canvas`, `--ink`, `--accent-fill`; `<html data-theme>` MutationObserver (l.182);
  window `online`; ResizeObserver on host (120 ms debounce). Ctrl+Shift+C/V handled (l.70-75). Hard-coded ANSI palettes
  per theme (l.29-35) — colours outside tokens.css.
- **State.** term, flow, ws, state, tries, timer, gone, fresh ticket, lastSize, gen.
- **Responsibilities.** l.17-37 theme mapping → `modules/shells` (or `core/ui/tokens` terminal palette); l.48-205 the
  terminal session → `modules/shells/term`.
- **Smells.** ANSI colours not tokens (system-wide-consistency rule). Otherwise clean, well-bounded, engine-swappable.
- **Proposed home.** `modules/shells/term.js`; xterm stays in `vendor/`.

### js/shells/model.js (128 lines)

- **Purpose.** Pure shell logic: busy/running/detached, state line words, list filtering/order, name cleaning, flow
  watermarks (`HIGH` 100 KB / `LOW` 10 KB), backoff, WebSocket close-code meaning (4404/1000 ended, 4403 off, 4429 full,
  1008/1009 refused).
- **Exports.** `busyWith`, `isRunning`, `isDetached`, `span`, `whereOf`, `stateLine`, `dotOf`, `runningOf`, `listRows`,
  `cleanName`, `nameFor`, `HIGH`, `LOW`, `createFlow`, `backoff`, `closeMeaning`. Imported by `shells/dock.js:18`,
  `shells/term.js:12`, `tests/shells.test.mjs`. (Do not confuse with `js/model.js`, imported by storm.js.)
- **Imports.** `util.js` (`toMs`).
- **Coupling.** None (no DOM, no network). Encodes the backend's T shape (`/api/terminal/sessions` fields).
- **Proposed home.** `modules/shells/model.js` (pure; tests move with it). `span()` overlaps time-words helpers elsewhere
  (ui.waited/short, util.relTime): candidate for `core/platform/time`.

### js/ui.js (397 lines)

- **Purpose.** Grab-bag of shared front-end helpers: the app's named icon map `ICON` (≈95 names over the xo pack),
  `NEXT_GLYPH`, `XO` mark, `dial(effort)`, height animations `morph`/`expand`, time words, `$`/`$$`, reduced motion
  (`RM`, `wait`, `hold`), keyed list reconciler `reconcile`, optional sounds, and `keepTurning` (sync spinners).
- **Exports.** `xi` (re-export of icon.js), `ICON`, `NEXT_GLYPH`, `dial`, `XO`, `morph`, `EASE`, `EXPAND_MS`, `expand`,
  `mmss`, `waited`, `$`, `$$`, `RM`, `wait`, `hold`, `clock`, `dayOf`, `short`, `elapsed`, `plain`, `reconcile`, `sound`,
  `esc` (re-export of **world.js**'s `esc`), `keepTurning`.
  Importers (22 modules): app.js (`keepTurning, ICON, xi, XO, NEXT_GLYPH, $, $$, RM, clock, dayOf, short, elapsed,
  reconcile, sound, wait, hold, dial, morph, expand`), decide.js (`ICON, $, RM, clock, sound, dial, wait, morph,
  expand`), msgx.js (`elapsed, ICON, xi`), turnview.js, map.js (`ICON, $, elapsed`), recordview.js (`ICON, $, short`),
  lightbox.js (`ICON, clock`), create.js (`ICON, $, RM`), intel.js (`ICON, RM, xi`), viewer.js (`ICON, $, xi`), stage.js
  (`ICON, $`), and `ICON` only: dropdown, filespage, media, chats, shapeview, files, paidview, runsview, settings,
  launchpad, shells/dock. tests/press-keeps-node.test.mjs + 9 source-reading tests.
  Apparently unused outside ui.js (grep): `mmss`, `waited`, `plain`, `EXPAND_MS` (internal), `esc` re-export.
- **Imports.** `world.js` (`esc` — a domain module, for a string helper), `redraw.js` (`redraw`, `pressedNode`),
  `focusview.js` (`usable`), `icon.js` (`xi`).
- **Coupling.** localStorage `cv-sound` (l.337-338); AudioContext; `matchMedia(prefers-reduced-motion)`; a body-wide
  MutationObserver (`keepTurning`, l.393) that resets CSS animations named `spin`, `arc-turn`, `shimmer` on `.arc,
  .spin, .shimmer, .tb-live`; `reconcile` dispatches bubbling `redrawn` CustomEvent (l.325, heard by msgx.js:599) and
  reads/writes `el._h`, `dataset.k`, adds class `is-new`. CSS classes it injects into icons: `tk` (check), `sk` (stamps).
- **State.** `actx`, `chosen` (sound); module-level `Intl` formatters.
- **Responsibilities.** l.7-124 icon names → `core/ui/icons` (`ICON` = the app's semantic icon aliases); l.126-208
  `morph/expand/expandFrame` → `core/ui/motion` (merge with motion.js); l.210-257 time words and `plain` →
  `core/platform/time` / `core/platform/words`; l.220-227 `$`, `$$`, `RM`, `wait`, `hold` → `core/platform/dom` and
  `core/platform/motion`; l.259-327 `reconcile` → `core/ui/reconcile` (sibling of redraw.js); l.329-372 `sound` →
  `core/services/sound` (or `modules/decisions` since only decide/app play it) with Settings section; l.376-397
  `keepTurning` → `core/ui/motion`.
- **Smells.** Mixed bag that half the app imports for `ICON`. Three easing constants (`EASE` here l.145, motion.js:13,
  gestures.js:17) and three reduced-motion queries (`RM` here, motion.js:15, gestures.js:19). Time-word duplicates:
  `elapsed` ≡ stage.js `ago`; `dayOf` ≈ util `dayLabel`; `short` ≈ util `relTime`. `esc` imported from world.js while
  util.js has the same function (world.js:54 has its own copy). `reconcile` and `redraw` are two reconcilers with
  overlapping rules (pressed node, focus) — keep both but co-locate.
- **Proposed home.** Split: `core/ui/icons.js` (ICON, XO, NEXT_GLYPH, dial), `core/ui/motion.js` (morph, expand, EASE,
  keepTurning, with motion.js), `core/ui/reconcile.js`, `core/platform/time.js`, `core/platform/dom.js`, sound to
  `core/services/sound.js`.

### js/kit.js (270 lines)

- **Purpose.** "The Decision Kit": ask risk/grouping rules, the one place a decision becomes a world call (`answer`),
  the 3 s commit queue with Undo, press-and-hold for destructive actions (`holdToConfirm`, `holdButton`), a deferred
  live-region announcer, Teach sentence, tab title.
- **Exports.** `COMMIT_MS`, `HOLD_MS`, `READ_MS`, `GROUPS`, `riskOf`, `isBinary`, `askKey`, `groupOf`, `asksOf`,
  `commandOf`, `prefixOf`, `teachSentence`, `answer`, `createCommitQueue`, `holdButton`, `holdToConfirm`,
  `createAnnouncer`, `titleFor`. Importers: app.js, content.js, decide.js, settings.js (`holdButton` for Worktrees),
  tests/runtimes.test.mjs, tests/stopped-on-purpose.test.mjs. `createAnnouncer` and `holdToConfirm` have no importer
  outside kit.js (grep); `titleFor` used by app.js/chats.js.
- **Imports.** `world.js` (`WAITING`), `review.js` (`itemBody`), `keys.js` (`typing`).
- **Coupling.** `world.act.decideItem/reply/decide` (the only decision → API path); `navigator.vibrate`; window `blur`,
  `visibilitychange` during a hold; classes `is-holding`, `tense`, `is-releasing`, `by-pointer`, `--p`; markup contract
  `.hold-txt`, `.ht-a`, `.ht-b`. `createAnnouncer` adds a permanent capture keydown listener and a 400 ms interval.
- **State.** Commit queue arrays; hold timers per button.
- **Responsibilities.** l.23-100 ask model + `answer` → `modules/decisions` (domain, not UI kit). l.102-145 commit queue →
  `modules/decisions` (or `core/services/undo` if other modules adopt the 3 s window). l.147-242 hold button →
  `core/ui/components/hold-button` (used by Settings › Worktrees too). l.244-266 announcer → `core/platform/announce`
  (or delete: unused). l.268-270 `titleFor` → `shell` (document title) or `modules/decisions`.
- **Smells.** Name says "kit" but it is decision domain logic tied to world.js and review.js; the reusable hold button is
  trapped inside it, so Settings imports decision code to get a button. Dead `createAnnouncer`.
- **Proposed home.** `modules/decisions/kit.js` (ask rules, answer, commit queue) + `core/ui/hold.js` (holdToConfirm,
  holdButton).

### js/dropdown.js (321 lines)

- **Purpose.** `<xo-select>` custom element replacing native `<select>`: WAI-ARIA select-only combobox, fixed-position
  listbox, type-ahead, PageUp/Down, held state (`aria-busy`/`aria-disabled`), options as its own `<option>` children
  observed by MutationObserver.
- **Exports.** None; side-effect `customElements.define("xo-select")` (l.321). Imported for effect by `js/app.js:14`.
  Used as markup by settings.js:112, chats.js:298, recordview.js:733, launchpad.js:467; redraw.js treats custom elements
  as owning their insides (redraw.js:128). 4 tests read its source.
- **Imports.** `ui.js` (`ICON.chevron`) — pulls the whole ui.js graph (world.js, redraw, focusview) into a component.
- **Coupling.** Module-level `openOne` (only one open list app-wide), `seq` ids `dd<n>`; document capture `pointerdown`,
  window `scroll` (capture) / `resize` while open; CSS classes `dd-btn`, `dd-menu`, `dd-row`, `is-cur`, `is-open`,
  `is-in/out/up`; `data-desc` on options. Events: bubbling `input` + `change`.
- **Responsibilities.** All one component → `core/ui/components/select`.
- **Smells.** Depends on ui.js just for one icon (use icon.js `xi("chevron-down")`). Side-effect registration means load
  order matters (must be defined before any module renders `<xo-select>` that needs `.value`).
- **Proposed home.** `core/ui/components/xo-select.js`, registered by the kernel's UI bootstrap.

### js/gestures.js (451 lines)

- **Purpose.** Touch gesture primitive `drag(el, o)` (axis lock, velocity, one claimed touch) plus `glide/follow/unstyle`,
  and every app gesture: swipe back / open drawer, close drawer, swipe-close Settings and viewer, drag-down sheets,
  Needs-you card swipe, All-threads swipe-to-resolve, runs sheet back, keyboard-lower drag, docked decision card fold
  (`dockGestures`), and a long-press message menu (Copy / Select text).
- **Exports.** `FLICK`, `edgeIsSafari`, `tick`, `scrollsX`, `scrolledY`, `drag`, `glide`, `follow`, `unstyle`,
  `dockGestures(tdock)`, `wireGestures(A)`, re-export `copyText`. Importers: app.js:59 (`wireGestures`, `dockGestures`),
  shells/dock.js (`drag, follow, glide, unstyle, tick, FLICK`).
- **Imports.** `util.js` (`copyText`, `COPY_REFUSED`), `keynav.js` (`menuKeys`), `words.js` (`wordsOf`).
- **Coupling.** `wireGestures` hard-codes ids `#main`, `#side`, `#side-scrim`, `#conv`, `#dock`, `#settings`, `#viewer`,
  `#pn-stage`, `#pn-foot` (`[data-nav]`), `#all-list` (`.ar[data-go^='t:']`), `#runs-card`, `#scroller`, `#msgs`, and
  the guard selector `#dock, #panel, #viewer, #settings, .iq-pop` (l.168). Message selectors for long-press (l.379:
  `.m-you .bubble`, `.m-them … .prose`, `.m-turn .tb-answer`). Dispatches `document` CustomEvent `xo:gesture` after each
  settled drag (l.95; app.js:4671 `armBack`). `OWN` selector list (l.120) of elements that keep their touches. Document
  capture `touchstart` (module load), `selectionchange`, `navigator.vibrate`. The `A` adapter (l.122-127): `phone,
  overlay, view, back, drawer, isDrawer, closeSettings, settingsOpen, viewerOpen, closeViewer, sheets[], panelOpen,
  runsDeep, runsBack, say, canResolve, resolve, threadOf, toast`.
- **State.** `claimed` (module global: the one touch a gesture owns); long-press `timer/menu/from`.
- **Responsibilities.** l.1-117 primitive + helpers → `core/platform/gestures`. l.119-154 `OWN`, `committed`, `band`,
  `dockGestures` → primitive helpers to core; `dockGestures` → `modules/decisions` (dock card). l.156-369
  `wireGestures`: back/drawer swipe → `shell` (navigation + sidebar); settings/viewer swipe-close → `modules/settings`,
  `modules/files` (viewer); sheets put-away → `core/ui/sheet`; Needs-you swipe → `modules/decisions`; swipe-to-resolve
  → `modules/threads`; runs sheet → `modules/conversation` (runs); keyboard lower → `modules/composer`. l.371-449
  long-press menu → `modules/conversation`.
- **Smells.** One function wires gestures for 8 features by global ids — the opposite of a registry; each feature should
  call `drag()` on its own element. Re-export of `copyText` kept "for whoever imports it" (none does; l.450-451).
  Duplicate `EASE`, `RM`.
- **Proposed home.** `core/platform/gestures.js` (drag, glide, follow, unstyle, tick, FLICK, scrollsX, scrolledY,
  edgeIsSafari, committed, OWN); each gesture moves into its owning module; a `gesture.surface` place is not needed.

### js/keys.js (176 lines)

- **Purpose.** The single registry of keyboard shortcuts (`ACTIONS` with scope global/decision/intel/picture/diff),
  per-browser overrides (localStorage `cv-keys`), parsing/matching (`is`, `globalFor`, `fromEvent`), display (`label`,
  `hint`, `show`), and conflict-checked rebinding (`set`) for Settings › Keyboard.
- **Exports.** `GROUPS`, `ACTIONS`, `fromEvent`, `binding`, `changed`, `typing`, `is`, `hasMod`, `globalFor`, `show`,
  `label`, `hint`, `set`, `reset`, `resetAll`, `anyChanged`, `onChange`. Importers: app.js (global dispatcher
  app.js:4580/4605, keys sheet, Settings › Keyboard), changesframe.js, decide.js, intel.js, kit.js (`typing`),
  shells/dock.js, viewer.js; tests keys.test.mjs, keys-dispatch.test.mjs.
- **Imports.** None.
- **Coupling.** localStorage `cv-keys`; `navigator.userAgentData/platform`. `RESERVED_MOD` and the scope rules encode the
  owner's shortcut policy. Some keys are hard-wired elsewhere and only *listed* here (`fixed`: Esc, lightbox keys,
  ⌘S, ⌘L, ⌃G); `/` in the stage's Threads filter is hard-wired and not listed at all (stage.js:645).
- **State.** `custom` overrides, `subs`.
- **Responsibilities.** Registry + matcher + persistence + validation → `core/platform/keys`. The ACTIONS table itself
  should become contributions: each module registers its actions (`shortcut` place, keyed by id, with scope); the
  conflict check (`set`, l.154-172) and `globalFor` (l.126) then run over the registry.
- **Smells.** Central static table means every module edit touches keys.js; IDs are global strings (`map`, `treeFold`)
  with no namespace (apps will need `<app>:<action>`).
- **Proposed home.** `core/platform/keys.js` (engine) + `shortcut` place in the kernel; Settings › Keyboard page →
  `modules/settings`.

### js/keynav.js (109 lines)

- **Purpose.** Keyboard behaviour for button-drawn radio groups and menus (WAI-ARIA APG): `radioKeys`, `rovingTab`,
  `menuKeys`, `pointerFollows`, with `step` and `usable`.
- **Exports.** `usable`, `step`, `rovingTab`, `radioKeys`, `pointerFollows`, `menuKeys`. Importers: app, chats, decide,
  files, gestures, launchpad, recordview, rtsettings, settings, shapeview, viewer; tests/keynav.test.mjs.
- **Imports.** None.
- **Coupling.** Delegated keydown/pointermove listeners on a caller's root; roles `radiogroup`, `radio`, `menu`,
  `menuitem*`; reads `aria-checked`, `aria-haspopup`, `aria-expanded`.
- **Smells.** `usable` here (l.26: not disabled/aria-disabled, has client rects) differs from focusview.js's `usable`
  (l.18: not body, connected, not inside `[inert],[hidden]`, has rects). Same name, different meaning, both exported.
- **Proposed home.** `core/ui/a11y/keynav.js`; rename one of the two `usable`s (e.g. `choosable` here).

### js/quickopen.js (179 lines)

- **Purpose.** ⌘P "Go to a file" (fuzzy over the place's paths, open files first, `:120` line suffix) and ⌘⇧F "Find in
  files" (Space `GET /search`, grouped by file, case/word/regex toggles) in one sheet.
- **Exports.** `createQuickOpen({paths, api, place, openFile, openFiles, announce, layer})` → `{open(mode), close,
  isOpen, el, refresh}`. Importer: app.js:251 (`QO`). tests/quickopen.test.mjs.
- **Imports.** `util.js` (`esc`), `icon.js` (`xi`), `fileicons.js` (`fileIcon`), `fuzzy.js` (`rank`, `marked`,
  `lineOf`), `api.js` (`missingRoute`) — and the injected `api.projectSearch`.
- **Coupling.** Creates `#qo` (`.sheet`, `.jump-card`, `.jump-list`: reuses the ⌘K jump sheet's classes) appended to
  `body`; ids `qo-q`, `qo-list`, `qo-<i>`. `layer.shown/hidden` → app's `syncInert` (page behind inert). /api project
  search route; "no /search" fallback text. 220 ms debounce timer. Shortcuts themselves are dispatched by app.js
  (`quickOpen`, `findInFiles` actions in keys.js).
- **State.** `S` (mode, place, items, sel, back, gen, debounce, opts, noSearch, pendingEnter).
- **Responsibilities.** Files mode → `modules/search` (quick-open provider "files"); text mode → `modules/search`
  (provider "text"); sheet chrome → `core/ui/sheet` (shared with ⌘K jump).
- **Smells.** Two sheets (⌘K in app.js and this) share CSS but not code. Otherwise well-injected.
- **Proposed home.** `modules/search/quickopen.js`; register as `command.palette.provider` entries (files, text) so ⌘K,
  ⌘P and ⌘⇧F become one palette with providers.

### js/fuzzy.js (118 lines)

- **Purpose.** Pure fuzzy path scorer (DP, separators, camelCase, name-first), `rank`, `marked` (highlight), `lineOf`
  (`file:120:4`).
- **Exports.** `score`, `rank`, `marked`, `lineOf`. Importers: quickopen.js, files.js (tree Find), tests/quickopen.test.mjs.
- **Imports / coupling.** None. Pure.
- **Proposed home.** `core/platform/fuzzy.js`.

### js/motion.js (82 lines)

- **Purpose.** The motion system: `EASE`, durations `IN 280 / MOVE 320 / OUT 160`, `still()`, `arrive(el)`,
  `fadeImage(img)`, FLIP list sync `syncList(box, items, {make, update})`, `setHtml`, `setText`.
- **Exports.** as listed. Importers: app.js, lightbox.js, media.js, recordview.js.
- **Imports.** None.
- **Coupling.** Values mirror CSS tokens (`--ease`, `--d-in`, `--d-move`, `--d-out` in css/tokens.css; comment says
  css/foundation.css too) — two sources of truth "change them together" (l.12). Uses `el._h`, `box._seeded`,
  `dataset.k`.
- **Smells.** Third keyed-list reconciler (with ui.reconcile and redraw) and second `setHtml` pattern (`_h` caches are
  everywhere). EASE/RM duplicated with ui.js and gestures.js.
- **Proposed home.** `core/ui/motion.js` (merge with ui.js's morph/expand/keepTurning and read durations from tokens).

### js/ring.js (65 lines)

- **Purpose.** Draws a keyboard focus ring as an overlay sibling over scrollable regions whose own outline is hidden by
  their content (`.vw-body` file viewer, `.cx-pd` diff); `ringBox` geometry is pure.
- **Exports.** `REGIONS`, `ringBox`, `regionRings(doc, win)`. Importers: app.js:1965 (called once), tests/ring.test.mjs.
- **Coupling.** Global `focusin`/`focusout`/capture `keydown` on document, window `resize`; class `has-ring`,
  `.region-ring` element; exclusion `.vw-doc` (l.50 of file). Knows two feature selectors (`.vw-body`, `.cx-pd`).
- **Proposed home.** `core/ui/a11y/ring.js`; the selector list should be a registration (`focus.region` contributions
  from `modules/files` and `modules/changes`) or a generic attribute (`data-ring-region`).

### js/skeleton.js (105 lines)

- **Purpose.** First-paint Home shell: greeting/date drawn immediately and placeholders sized from the last visit;
  remembers Home's block layout on `pagehide`/hidden. Deliberately import-free (loads before app.js).
- **Exports.** `greeting`, `today`, `bar`, `skTile`, `rememberedMade`, `rememberHome`, `homeShell`. Importers:
  index.html (`<script type=module>`), app.js, recordview.js (`skTile`, `rememberedMade`), tests/record.test.mjs.
- **Coupling.** Runs `homeShell()` at import (l.101-105). DOM ids `#home`, `#hm-body`, `#hm-head`, `#hm-next`,
  `#hm-then`, `#hm-end`, `#hm-made`, `#home-h`; classes `.hm-sk`, `.sk`, `.md-it`, `.md-recent`; sets `el._sk`,
  `box._built`. localStorage `xo-home-shape`. Order of Home parts later fixed by shapeview.js `homeOrder`.
- **Responsibilities.** Generic `bar()` → `core/ui/skeleton`; Home shell/remember → `modules/home`; `skTile` →
  `modules/artifacts`.
- **Smells.** Hard-codes Home's block ids that `modules/home` and shapeview.js also hard-code (three places agree on
  `hm-next/hm-then/hm-end/hm-made`).
- **Proposed home.** `modules/home/skeleton.js` (kept import-free, loaded early by the shell's boot), `core/ui/skeleton.js`
  for `bar`.

### js/herald.js (92 lines)

- **Purpose.** The herald (the one-line notice in the dock line): queue rules — an Undo is never pushed out, forced
  lines (a message that didn't go) queue in order, passing lines yield; per-message notices replaced in place
  (`forMsg`), dropped (`drop`); notice factories.
- **Exports.** `OWN` (kinds that hold their line), `createHerald({state, schedule, now, setTimer, clearTimer})` →
  `{show, forMsg, drop, put, next, HQ}`, `noticeFor(m, phase)`, `refusedNotice(block, kept)`. Importers: app.js (lazily
  `HER()` app.js:1964, state object = app's `S`), tests herald, conv-herald-resolve, lp-stop-notice, refused.
- **Imports.** None. Pure (time and timers injected).
- **Coupling.** Writes `state.herald` on the app's global state object; rendering is app.js's. stage.js keeps
  `#herald` reachable over its inert cover.
- **Proposed home.** `core/services/notices.js` (queue) with a `shell` renderer in the dock line; `noticeFor` →
  `modules/composer` (send notices); `refusedNotice` → `modules/composer`.

### js/icon.js (24 lines)

- **Purpose.** `xi(name, cls, size)` → inline SVG string from the pack; throws on unknown names/sizes; `hasIcon`.
- **Exports.** `xi`, `hasIcon`. Importers: ui.js (re-exports `xi`), changesframe.js, fileicons.js, markdown.js,
  projicons.js, quickopen.js; tests project-icons, xoicons.
- **Imports.** `xoicons.js` (`XI`).
- **Coupling.** CSS size classes `ic-xs|sm|lg` (css/base.css), class `xi`, `data-xi`.
- **Proposed home.** `core/ui/icons/icon.js`. For apps: a public `icon(name)` that never throws (fallback glyph), since a
  third-party typo must not crash a render.

### js/xoicons.js (390 lines)

- **Purpose.** Generated data: the owner's icon pack (≈384 icons, `[viewBox, inner markup]`, currentColor ink, shared
  stroke attrs `P`). "Generated by tools/xoicons/build.mjs: don't edit".
- **Exports.** `XI`. Importers: icon.js, fileicons.js (reads `XI[...]` directly for file kinds), tests/xoicons.test.mjs.
- **Coupling.** Source of truth is `assets/icons/xo` + `tools/xoicons/build.mjs`; the build must move with it.
- **Proposed home.** `core/ui/icons/xoicons.js` (generated artifact) + the build tool under `tools/`. Many icons
  (`state-*`, `key-*`, `favicon*`, `project-*`, `file-*`) belong semantically to features but must stay in one pack.

### js/projicons.js (83 lines)

- **Purpose.** Pure keyword classifier choosing a project's topic icon from its name (weighted ×4) and thread titles;
  `TOPICS` list for the picker; `glyph(topic)`.
- **Exports.** `TOPICS`, `classify`, `glyph`. Importers: app.js (sidebar/project icons, picker), tests project-icons,
  xoicons. (A user's choice is stored in the shape: `layout.icons`, shape.js l.144.)
- **Imports.** `icon.js`.
- **Proposed home.** `modules/projects/projicons.js`.

### js/fileicons.js (83 lines)

- **Purpose.** One resolver for file icons everywhere: Pierre's filename/extension rules and colours, the owner's plain
  kinds, folder glyphs; `fileColor` per theme.
- **Exports.** `iconKey`, `fileIcon`, `FOLDER_ICON`, `FOLDER_OPEN_ICON`, `folderIcon`, `fileColor`. Importers: app.js,
  changesframe.js, files.js, filespage.js, map.js, markdown.js, media.js, quickopen.js, recordview.js, stage.js,
  turnview.js, viewer.js; tests/xoicons.test.mjs.
- **Imports.** `vendor/pierre/icons.js` (`PIERRE`), `icon.js`, `xoicons.js`.
- **Coupling.** Reads `<html data-theme>` in `fileColor`; CSS vars `--fi-l`/`--fi-d`, class `fi`, `data-fi`
  (css/panel.css). Cache per token.
- **Proposed home.** `core/ui/icons/fileicons.js` (used by ≥10 modules; it is design-system, not the Files feature).

### js/settings.js (407 lines)

- **Purpose.** Three Settings pages: **Routing** (who routes a new message: coordinator / decision model / off;
  confidence; decision-model connect/disconnect with API key; per-chat overrides), **Rules** (standing rules: list, revoke
  with confirm), **Worktrees** (list by project, remove with confirm or press-and-hold when work would be lost).
- **Exports.** `createSettings({world, announce, PROJ, onChange})` → `{open(id)}`. Importer: app.js:4195 (`SETS`).
  2 tests read its source.
- **Imports.** `api.js`, `world.js` (`esc`), `ui.js` (`ICON`), `markdown.js` (`renderInline`, rule sentences), `kit.js`
  (`holdButton`), `pending.js` (`once`, `isPending`, `busyAttrs`), `redraw.js`, `keynav.js` (`radioKeys`, `rovingTab`).
- **Coupling.**
  - DOM: `#settings` root (from index.html/app.js), `[data-page="routing|rules|worktrees"] .set-live` boxes, rail buttons
    `#settings [data-set="<id>"]` (focus fallback, l.39). `radioKeys(#settings, {follow:false})` (l.360) is installed
    here **for every radio group in Settings**, including Shape's and Runtimes' (comment l.358-359) — a cross-page side effect.
  - /api: `GET/PUT /chat/router`, `GET/POST /chat/router/models`, `DELETE /chat/router/models/:provider`,
    `PATCH /chat/chats/:id` ({routing:null}), `GET /chat/rules` (paged by `after_seq`, ≤10 pages × 500),
    `DELETE /chat/rules/:id`, `GET /chat/worktrees`, `DELETE /chat/worktrees/:chat/:ts` (+confirm token; errors
    `would_lose_work`, `session_busy`, `invalid_key`).
  - World: reads `world.state.router|projects`, `world.thread()`, `world.project()`, `world.act.projectOf`; **writes**
    `world.state.router` and `p.routing` directly (l.152, 189, 208) — mutating the store outside its actions.
    `world.subscribe` re-renders Routing on stream changes when not mid-form (l.349-354).
- **State.** `R` (router, models, rules, defaults, trees, reported, err{}, form, confirm), `routeSig`.
- **Responsibilities.** l.20-70 shared page helpers (`pend`, `land`, `neighbour`, focus contracts) → `modules/settings`
  kit (shared by all settings sections); l.72-215 Routing → `modules/routing` (settings section); l.217-268 Rules →
  `modules/rules` (or `modules/decisions`, since rules come from "Make it a rule"); l.270-346 Worktrees →
  `modules/worktrees` (or `modules/threads`); l.356-397 one delegated click/change/submit router for all three →
  split per section.
- **Smells.** Three unrelated features in one factory and one click router; direct store mutation; global radioKeys
  install for other modules' pages.
- **Proposed home.** `modules/settings` (host + shared `pend/land` helpers) with sections contributed by
  `modules/routing`, `modules/rules`, `modules/worktrees` into place `settings.section`.

### js/rtsettings.js (296 lines)

- **Purpose.** Settings › Runtimes: live runtime cards (health, version, account, usage windows), paid-usage modes per
  Space and per account, and Space policy defaults (usual runtime, allowed runtimes, fallback switch, free-text
  preferences); each change saves at once, one policy save at a time, honest "Saving…/Saved" receipts.
- **Exports.** `usualOf(policy, rts)`, `sameValue`, `receipts(ms, onClear)`, `createRuntimeSettings({world, announce,
  PROJ})` → `{open()}`. Importers: app.js:4196 (`RTSET`), tests rtsettings, saved-truth.
- **Imports.** `world.js` (`esc`), `runtimes.js` (health/window helpers), `pending.js`, `redraw.js`, `keynav.js`
  (`rovingTab`), `paid.js` (modes, account rows).
- **Coupling.** DOM `[data-page="runtimes"] .set-live`, `#settings`; attributes `data-rtd-*`, `data-paid-*`. World:
  `state.runtimes|policy|paid|paidOk|paidPools|advisory|pools`, `act.loadRuntimes|setPolicy|setPaid|loadPolicies|
  loadPaid` (storm.js:442-481). 30 s refresh timer while on screen (each read probes CLIs). `focusout` on the textarea
  saves. `world.subscribe` redraws on another tab's save unless typing.
- **State.** `R` (timer, err, saved receipts, saving, pref draft, next), `P` (paid err/saving/saved).
- **Responsibilities.** l.27-63 pure `usualOf` (mirrors xo-space `runtime_policy.choose`) and `receipts` →
  `core/services/runtimes` (usualOf) and `core/ui/receipts` (Saved/Saving pattern reusable by every settings section);
  l.80-110 runtime cards → `modules/runtimes`; l.112-168, 238-272 defaults → `modules/runtimes`; l.170-219 paid usage →
  `modules/paid` (or `modules/runtimes`).
- **Smells.** `receipts` is a generic UI pattern buried here; its own `listHtml` re-reads world each draw (fine).
- **Proposed home.** `modules/runtimes` contributing `settings.section` "runtimes" (paid usage as a sub-section or its
  own `modules/paid`).

### js/shape.js (731 lines)

- **Purpose.** The per-person UI "shape": a registry of surfaces that can come and go (`SURFACES`: id, slot, order, on,
  keep, needs, opts), layered documents merged with RFC 7396 (built-in < preset file < mine (Storm `/chat/shape`,
  cached) < this device), validation with plain-language problems, wording overrides (`WORDS.thread`), presets,
  diff-to-sentences, and a sync engine with optimistic `if_version`, 409 conflict rebase of one-key changes, held
  changes surviving reloads, retry backoff, stream echoes.
- **Exports.** `SHAPE_VERSION`, `PRESET_VERSION`, `MIGRATIONS`, `SURFACES`, `WORDS`, `PRESETS`, `PRESET_ID`, `DENSITY`,
  `andList`, `merge`, `migrate`, `cleanLayer`, `createShape(layers, caps)`, `describeShape(a,b)`,
  `everythingLayer(id)`, `migrateDevice(storage)`, `sameDoc`, `changesOf`, `applyChanges`, `oneKey`, `KEYS`,
  `createShapeStore({storage, load, caps, remote, notice, retryMs})`. Importers: app.js:62 (`SHAPE`, app.js:76:
  `caps.has` from app's `CAP`, `remote` = `api.shape()`/`api.putShape()`, `notice` → herald; stream
  `world.onEvent(kind "shape")` → `SHAPE.heard`), shapeview.js, tests/shape.test.mjs (runs in node).
- **Imports.** None (no DOM; `fetch` of `../presets/<id>.json` via `import.meta.url`).
- **Coupling.** localStorage `cv-shape-mine`, `cv-shape-device`, `cv-shape-preset`, `cv-shape-unsynced`; reads legacy
  `cv-hops` once (`migrateDevice`). /api `GET/PUT /chat/shape` (409 `shape_changed` with `current`, 413 size limit 64 KB,
  404/405 = no route → local only). SSE `settings` event key `ui.shape` (handled in app.js). Static files
  `presets/*.json`. Timers: retry 30 s → 5 min (`unref`).
- **Consumers of shape ids (who reads what).** `xo:home/*` → shapeview `homeOrder` + skeleton; `xo:thread/*` → app.js
  (branch chips, runtime, subagents, work mode, hops); `xo:conversation/webpics` → app.js:84; `xo:dock/shells` → dock
  `wanted`; `xo:panel/agents|map|changes` → stage `frames()` (note `agents` id kept for the Threads frame);
  `xo:composer/intel` → composer/intel; `xo:settings/*` advanced flag → shapeview rail; `layout.side` and
  `layout.icons` → app.js (sidebar order, project icons) via `patchMine`; `density` → `<html data-density>`.
  `layout.panel|dock|artifacts|canvas|commands|open`, `apps`, `defaults.*` are **validated but read by nothing** — they
  are the declared seed of the app/registry model (presets already reference `space.xo.diff:changes`,
  `xo:needs-you`, `xo:files`).
- **State.** `mine`, `device`, preset `files`/`loadErr`, `subs`, `shape` (built), `R` (sync machine: mode reading/on/off/
  unknown, version, synced, knows, known, pend, busy, heard, retried, held, why, text, kept, tries, timer, localOk),
  `heldSubs`.
- **Responsibilities.** l.23-100 schema + merge + migrate → `core/services/shape/schema`; l.101-182 validation →
  same; l.184-238 `createShape` (on/list/opts/word) → `core/services/shape`; l.240-292 describe/everything/migrateDevice →
  `core/services/shape` (describe → `modules/settings` shape page could own the sentences); l.294-341 doc diff/patch →
  `core/platform/jsondiff`; l.343-731 store + Storm sync → `core/services/shape/store`.
- **Smells.** `SURFACES` is a central static list: every module that wants to be hideable edits shape.js. It must become
  contributions (`shape.surface` place) — the shape is already designed as "registry + layers"; the registry part is
  the only centralised bit. `xo:panel/agents` naming drift (frame is "Threads"). `WORDS` rename only applies where
  callers remember to call `word()`.
- **Proposed home.** `core/services/shape` (pure engine + store, node-testable), with `SURFACES` replaced by kernel
  registrations; `PRESETS` list → presets folder index (or `core/services/shape/presets.js`).

### js/shapeview.js (314 lines)

- **Purpose.** Settings › Shape page (preset cards with confirm, "What it changes" sentences, Reset to preset, Show
  everything, Compact switch, Edit as JSON with live problems), plus the page-wide effects: `<html data-density>`,
  moving "advanced" settings rail items under an Advanced heading, and Home's block order/visibility.
- **Exports.** `SHAPE_IC`, `UNKEPT`, `createShapeView({shape, announce, notice})` → `{apply, open, render, homeOrder}`.
  Importer: app.js:4198 (`SV`; `SV.homeOrder($("#hm-body"))` app.js:799). 4 tests read its source.
- **Imports.** `util.js`, `ui.js` (`ICON`), `shape.js` (`PRESETS`, `createShape`, `describeShape`), `pending.js`,
  `redraw.js`, `focusview.js` (`bringWhole`), `keynav.js` (`rovingTab`).
- **Coupling.** DOM `[data-page="shape"] .shp`, `#settings .set-nav [data-set]` (rail, reordered in place, l.62-89),
  `#settings` hidden check, Home ids `hm-next`, `hm-then`, `hm-end`, `hm-made` (l.23), `document.documentElement.dataset.
  density`. `document.execCommand("insertText")` for Tab in JSON. `shape.onHeld` subscription.
- **State.** `V` (confirm, err, pickErr, draft, saveErr, unkept, sharedAt, built).
- **Responsibilities.** l.55-60 density apply → `shell` (or `core/ui/theme`); l.61-89 Settings rail Advanced grouping →
  `modules/settings` (rail ordering from `settings.section` contributions with an `advanced` flag from shape); l.90-102
  `homeOrder` → `modules/home`; l.104-311 Shape page → `modules/settings` section "shape" (or `modules/shape`).
- **Smells.** One view reaching into Home's DOM and the Settings rail; Home order logic lives in Settings code.
- **Proposed home.** `modules/settings/shape-page.js` (section), `modules/home` takes `homeOrder`, the rail grouping
  goes to the settings host, density to the shell's theme applier.

### js/words.js (48 lines)

- **Purpose.** `wordsOf(root)`: a message's text as it reads (block breaks, pre-wrap kept, TeX as `$…$`, charts as their
  label), skipping what the app adds (`.mx-name, .mx-acts, .mx-swipe, .mx-qc, .md-code-head, button, svg,
  [aria-hidden='true'], .sr-only`).
- **Exports.** `wordsOf`. Importers: gestures.js (long-press Copy), msgx.js (desktop Copy), tests/words.test.mjs.
- **Coupling.** getComputedStyle `white-space`; knows conversation/markdown class names.
- **Proposed home.** `modules/conversation/words.js` (it encodes message markup). Not the brief's "words (copy)" —
  there is no central UI-copy module; copy strings are inline everywhere.

### js/util.js (112 lines)

- **Purpose.** Small shared helpers: `space(token)` (px of a spacing token), `esc`, `WORKSPACE`, `WORKSPACE_ID`,
  `chatLabel`, `toMs`, `relTime`, `clockTime`, `fullTime`, `dayLabel`, `plural`, `isImagePath`, `copyText`,
  `COPY_REFUSED`.
- **Importers.** 25 modules (app, changesframe, chart, chats, create, files, gestures, highlight, imagechange, intel,
  launchpad, lightbox, map, markdown, media, msgx, quickopen, recordview, runtimes, shapeview, shells/dock,
  shells/model, shells/term, stage, viewer).
- **Imports.** None. Header says "No DOM access here", but `space()` reads `getComputedStyle` and `copyText`'s fallback
  creates a textarea and uses `execCommand("copy")` (l.92-112 of the file) — guarded for node only in `space`.
- **Smells.** Misplaced JSDoc ("Escape text…" sits above `space`, l.6-12). `chatLabel`, `relTime`, `clockTime`,
  `fullTime`, `dayLabel`, `WORKSPACE_ID` have no importer outside util.js (grep over js/; possibly dead). `esc`
  duplicated in world.js:54 (ui.js and settings.js import world's).
- **Proposed home.** `core/platform/util.js` (esc, toMs, plural), `core/platform/time.js` (time words, merged with ui.js),
  `core/platform/clipboard.js` (copyText, COPY_REFUSED), `core/ui/tokens.js` (`space`), `core/services/world` constants
  (`WORKSPACE`). Delete dead ones after a test pass.

### js/redraw.js (130 lines)

- **Purpose.** In-place DOM morph: `redraw(el, html)` brings a region to new HTML keeping the focused node and the
  pressed node (pointerdown→click) and field drafts; nodes keyed by id / `data-key` / data-hooks; `data-own` nodes
  (decorator additions) untouched; custom elements own their insides; keeps a focused control in sight.
  `redrawNode(node, html)`, `pressedNode()`.
- **Exports.** `redraw`, `pressedNode`, `redrawNode`. Importers: 17 modules (app, changesframe, chats, create, decide,
  files, intel, launchpad, map, recordview, rtsettings, settings, shapeview, shells/dock, stage, ui, viewer); tests
  press-keeps-node + 7 source-reading tests.
- **Imports.** `focusview.js` (`inSight`, `bringWhole`).
- **Coupling.** Module-load document capture listeners `pointerdown`/`pointerup`/`pointercancel`/`click` (l.41-47 of the
  file) tracking the pressed node (600 ms grace after pointerup). Ignores attributes `data-inv`, `data-inv-now`.
  Convention: callers cache last HTML on `el._h` to skip identical redraws (seen in stage, dock, settings…).
- **Smells.** Keying by "all data- attributes" means a data attribute whose value changes (a count) makes a node "new"
  unless listed in `VOLATILE`; focusview's `hookOf` has a different volatile list (`data-n` too). Keep them as one list.
- **Proposed home.** `core/ui/redraw.js` (the rendering primitive every module relies on; part of the module SDK).

### js/pending.js (22 lines)

- **Purpose.** `once(key, work)` dedupes in-flight requests by key; `isPending`, `busyAttrs` (aria-busy + aria-disabled
  while pending).
- **Exports.** `isPending`, `busyAttrs`, `once`. Importers: app, chats, intel, rtsettings, settings, shapeview;
  tests/pending.test.mjs.
- **Coupling.** One module-global `inflight` Map: keys are global strings (`router`, `shape`, `runtime-policy`,
  `dm-on:<id>`…) — collisions possible across modules/apps.
- **Proposed home.** `core/platform/pending.js`; namespace keys per module (`ctx.pending.once(key)` from the kernel).

### js/hopstate.js (13 lines)

- **Purpose.** Monotonic hop state (`sent` < `delivered` < `answered`): `hopRank`, `furtherState`, `mergeHop`.
- **Exports.** as listed. Importers: storm.js, tests/storm.test.mjs.
- **Proposed home.** `core/services/world` (storm normalisation) — or `modules/conversation` hops; it is data, not UI.
  (Out of place in a "shell chrome" scope.)

### js/focusview.js (138 lines)

- **Purpose.** Focus visibility rules: `usable(el)` (the one "can focus land here" test), `hookOf(el)` (a control's
  selector identity for re-finding after redraw), geometry (`scrollerOf`, `seen`, `room`, `ringsOf`, `decoration`,
  `bring`, `lost`, `inSight`, `bringWhole`), and `keepFocusInView()` installing a global focusin check that scrolls only
  the nearest scroller the least distance (skips `[data-own-scroll]`, skips pointer-initiated focus).
- **Exports.** `usable`, `hookOf`, `outside`, `scrollerOf`, `seen`, `room`, `ringsOf`, `decoration`, `bring`, `lost`,
  `inSight`, `bringWhole`, `keepFocusInView`. Importers: app.js (`keepFocusInView, usable, hookOf`, installed at
  app.js:1966), create, decide, redraw, shapeview, stage, ui, viewer; tests/focusview.test.mjs.
- **Coupling.** Global `pointerdown` (capture) and `focusin` listeners; dispatches bubbling `focusbrought` CustomEvent;
  honours `data-own-scroll` (the conversation; follow.js owns its scroll) and CSS `scroll-margin` (`--ring-room`).
- **Proposed home.** `core/ui/a11y/focus.js`.

### presets/engineering.json (40 lines), presets/marketing.json (43 lines)

- **Purpose.** Shape preset files (`"preset": 1`), fetched by shape.js `fetchPreset` relative to `js/` (`../presets/`).
  Each sets `density`, `words.thread` ("thread" / "task"), `surfaces` on/off/options (marketing hides branch, runtime,
  sub-agents, hops, shells, map, changes, moves routing/rules/worktrees under Advanced, words mode, simple model
  picker, Recently made order 15), and **future-registry data nothing reads yet**: `apps` (`space.xo.diff`,
  `space.xo.design`, `space.xo.docs` with semver and enable policy), `layout.panel` (tab groups such as
  `["space.xo.diff:changes", "xo:files"]`, `size: "tall"`), `layout.dock` (`["xo:shells"]`), `layout.artifacts`,
  `layout.canvas` (`xo:conversation`), `layout.open` (artifact kind → app editor), `layout.commands`, `defaults.model|
  effort|newProject.folders|skills|home.finds`.
- **Importers.** shape.js only (by fetch); `PRESETS` in shape.js lists them plus the built-in "everything".
- **Proposed home.** `presets/` stays a static folder served beside the app (or `core/services/shape/presets/`). Their
  `layout.*` and `apps` keys are the closest thing to a written registry spec in the codebase: the kernel's place ids
  should be chosen to match them (`xo:files`, `xo:shells`, `xo:needs-you`, `<app>:<surface>`), or the presets
  migrated with a `MIGRATIONS.preset[1]` step.

---

## 2. Domain summary

### 2.1 Proposed module boundaries

| New home | Takes from (this scope) |
|---|---|
| `core/kernel` | the page registry semantics of stage.js l.440-558 (generalised as places `panel.page`, `panel.frame`); shape's `SURFACES` registration (as `shape.surface`); keys.js `ACTIONS` registration (as `shortcut`) |
| `core/platform/keys.js` | keys.js engine (parse, is, globalFor, label, set/validate, persistence `cv-keys`) |
| `core/platform/gestures.js` | gestures.js l.1-117 + `committed`, `band`, `OWN` |
| `core/platform/time.js` | ui.js `clock, dayOf, short, elapsed, mmss, waited`; util.js `toMs, relTime, clockTime, fullTime, dayLabel`; stage.js `ago`; shells/model `span` |
| `core/platform/util.js`, `clipboard.js`, `pending.js`, `fuzzy.js`, `dom.js` | util.js `esc, plural, isImagePath`; `copyText, COPY_REFUSED`; pending.js; fuzzy.js; ui.js `$, $$` |
| `core/ui/redraw.js`, `reconcile.js` | redraw.js; ui.js `reconcile` |
| `core/ui/motion.js` | motion.js + ui.js `EASE, morph, expand, keepTurning, RM, wait, hold` (one EASE, one RM) |
| `core/ui/icons/` | icon.js, xoicons.js (+ tools/xoicons build), fileicons.js, ui.js `ICON, XO, NEXT_GLYPH, dial` |
| `core/ui/components/` | dropdown.js (`xo-select`), kit.js hold button, sheet chrome shared by ⌘K/⌘P, skeleton `bar`, rtsettings `receipts` |
| `core/ui/a11y/` | keynav.js, focusview.js, ring.js |
| `core/services/shape/` | shape.js (engine, store, sync), presets/ |
| `core/services/notices.js` | herald.js queue |
| `core/services/sound.js` | ui.js `sound` |
| `shell/panel` | stage.js frame stack, title bar, tabs, page host, width, cover, Esc |
| `shell` (frame) | density apply (shapeview l.56-57), document title (`kit.titleFor`), herald renderer, back/drawer swipe |
| `modules/shells` | shells/dock.js, term.js, model.js; the stage's built-in "shell" page; app.js `panelShell`/`openShell` |
| `modules/threads` | stage.js Threads frame (l.95-105, 209-247, filter, groups); gestures swipe-to-resolve |
| `modules/changes` | stage.js Changes frame wiring (l.110-115, 254-260, 301-325) |
| `modules/map` | stage.js Map frame wiring + map tabs |
| `modules/launchpad` | stage.js Launchpad cover (`openLaunch`, `pressDeploy`, ghosts usage) |
| `modules/files` | filespage.js page (already a page client), ring region `.vw-body`, viewer swipe |
| `modules/search` | quickopen.js (providers "files", "text"), fuzzy use |
| `modules/decisions` | kit.js ask rules/answer/commit queue, `dockGestures`, Needs-you swipe |
| `modules/conversation` | words.js, long-press menu, hopstate.js (or core/services/world) |
| `modules/home` | skeleton.js Home shell, shapeview `homeOrder` |
| `modules/projects` | projicons.js |
| `modules/settings` | settings host, shared `pend/land/neighbour` helpers, Shape page (shapeview), Keyboard page |
| `modules/routing`, `modules/rules`, `modules/worktrees` | the three sections of settings.js |
| `modules/runtimes` (+ `modules/paid`) | rtsettings.js |

### 2.2 Places (slots) this domain needs

| Place | Kind | Scope | Contributors today | Contract notes |
|---|---|---|---|---|
| `panel.page` | keyed (by page name), each instance tabbed (single or per key) | app (panel is app-wide; key carries the place/thread) | shell (modules/shells), files (filespage.js), thread (app.js:2761) | spec = `{title(key), icon(key), width: n \| ({room})=>n, single, lead(key), act(name, el), mount(host,key), onShow(key,{focus}), onHide(key), unmount(key), canClose(key)→bool\|Promise, escape(key)→bool}`; fix key semantics (always the real key); `register` must return an undo that `closeTab`s and unregisters |
| `panel.frame` | ordered list (priority = order), filtered by shape `xo:panel/<id>` | app, re-rendered per view | threads (`agents`), changes, map; launchpad as a *covering* frame | needs: `head(view)` (title, count, actions), `body(host)`, `paint(view)`, `show/hide`, sizing hints (`grow` preference, row size/min rows like Threads, `minHeight` like Changes' 212), `cover: true` for Launchpad, `empty(view)` (Changes empty gives Threads the room) |
| `panel.titleAction` | list | app | Shell toggle (`[data-stg-shell]`), Full, Close | today hard-coded |
| `dock.bottom` | single (one dock host) or keyed | app | modules/shells | the dock element must be movable into `panel.page` (Shell mode) — define as a component that can be re-hosted |
| `sidebar.entry` | ordered list (shape `layout.side` order) | app | Shells toggle with running count (dock.js writes `#nv-shells` directly today) | entry gives `{label, icon, count(), pressed(), onClick}` |
| `header.action` | ordered list | view (project/thread/ws) | stage `button()`, Launchpad Deploy (`[data-lp-open]` pressed state set by stage) | pressed state should be pulled from the contributor, not pushed by stage.js:427 |
| `settings.section` | ordered list, shape `xo:settings/<id>` with `advanced` flag | app | routing, rules, worktrees (settings.js), runtimes (rtsettings.js), shape (shapeview.js), keyboard (app.js) | `{id, label, icon, open(), render(host)}`; the host groups advanced ones (shapeview l.61-89) and installs radioKeys once |
| `shortcut` | keyed by action id, scoped (global/decision/intel/picture/diff + new `panel`) | app (scope decides where it fires) | keys.js ACTIONS; plus hard-wired `/` (stage) | ids namespaced `<module>:<id>` for apps |
| `shape.surface` | keyed | app | shape.js SURFACES (17 entries, 7 slots) | `{id, slot, order, on, keep, needs, opts, label, noun}`; `needs` resolved against backend capabilities |
| `command.palette.provider` | list | view/place | quickopen files + text; ⌘K jump (app.js) | `{mode, placeholder, items(query), pick(item)}` |
| `focus.region` | list of selectors | app | ring.js `.vw-body`, `.cx-pd` | or replace with a data attribute |
| `thread.menu` / `project.action` | list | thread / project | "Open a shell in its worktree" (app.js:2789 via `SH.enabled`), project Shell button | shells contributes |
| `notice` (service, not a place) | — | app | herald; dock.js `notify`, shape store `notice` | one notices service API |

### 2.3 Public APIs other modules should see

- **shell/panel**: `open({focus}), close({restore, quiet}), toggle(), isOpen, threads()` (open on Threads), `cover(frameId)`
  (today `launch()`/`launchOpen`), `sections()`, `show(page, key, {focus})`, `closeTab(page, key)`, `requestClose()`,
  `pages()`, `pageShown`, `refit()`, `owns(node)`, `reshape()`; frame-specific calls (`showChange`, `resumeFollow`,
  `chosen`, `theme`) move to `modules/changes`' own API.
- **modules/shells**: `enabled`, `available`, `countFor(project|"workspace"|null)`, `openProject(pid,{fresh})`,
  `openWorkspace({fresh})`, `openThread({project, chatId, ts, title})`, `showList(filter)`, `toggle()`, `hide()`,
  `shown`, `raised`, `lower()`, `owns(event)`.
- **core/platform/keys**: `register(action)`, `is(e,id)`, `globalFor(e)`, `label(id)`, `hint(id)`, `set/reset`, `onChange`.
- **core/services/shape**: `on(id)`, `list(slot)`, `opts(id)`, `word(w)`, `get(key)`, `onChange`, `patchMine`,
  `setDevice`, `choose`, `resetToPreset`, `showEverything`, `held/onHeld`, `heard(streamValue)`, `registerSurface()`.
- **core/ui**: `redraw`, `redrawNode`, `pressedNode`, `reconcile`, `xi/ICON/fileIcon`, `<xo-select>`, `holdButton`,
  `receipts`, `once/isPending/busyAttrs`, `usable/hookOf/bringWhole`, `drag/glide/follow`.

### 2.4 Risks in moving (subtle behaviour, easy to lose)

1. **Page key semantics** (stage.js l.457, 467-488, 829): single pages use the name as tab key; `onShow` alone gets the
   real key. Thread page `title(key)` therefore gets "thread" in `pages()`. A registry that "fixes" this changes what
   Files' and Thread's hooks receive — audit filespage.js:81-104 and app.js:2761-2775.
2. **Tabs survive closing the panel** (`close()` → `sections()`, l.389): Files keeps its editor, undo and caret; Thread
   keeps its draft. Don't unmount on close.
3. **`canClose` throws = refuse** (l.466) and `requestClose` brings the refusing tab forward with focus (l.539). Unsaved
   files depend on this (viewer.confirmClose).
4. **Esc order** (l.648-653) and the input exemption; the probable Shell-mode bug (Esc in a panel terminal closes the
   panel) — decide deliberately, don't port silently.
5. **Inert cover** (l.342-368): computed whole each time, releases only what it marked (`data-stage-inert`), keeps the
   herald/toast reachable, moves focus into the panel when what had it is covered. Grader findings C023, C029 are
   encoded here.
6. **Focus return on close** (l.403-407): to the opener, else the redrawn `[data-stage-toggle]`, then again after two
   rAFs once the header redraws.
7. **Launchpad cover without `inert`** (l.146-149, 618-628): `aria-hidden` + `untab()` + focus guard, chosen because
   `inert` restyled 7,400 diff nodes; `content-visibility` keeps covered frames laid out (perf numbers in comments).
8. **Layout reads avoided on purpose**: `S.stackH` from ResizeObserver (l.92), sidebar width cached (l.743-751); naive
   re-implementation re-introduces 17-88 ms forced layouts.
9. **Width rules**: 360 default, 320-720, `innerWidth-480` cap, WIDE 560 for diffs unless you dragged, READ 560 for the
   conversation, `stage-over` float, per-page widths and per-page full size (`S.fullOf`).
10. **Threads frame sizing in whole rows**, Map spill-over drag, and Changes auto-unfold when files first arrive
    (l.308-311) plus "an empty Changes gives Threads the room" (l.156).
11. **Dock re-hosting**: app.js moves `#shd` into a page box and back to its remembered parent/next sibling
    (app.js:3874-3890); a MutationObserver exits Shell mode when `#shd` hides (app.js:3892). Terminals must not be
    disposed by the move (xterm keeps its DOM).
12. **Shell reattach**: sessionStorage `xo-shells` per browser tab; boot reads it *before* the first render overwrites
    it (dock.js:40); `beforeunload` guard for live shells.
13. **Pressed-node preservation** (redraw.js l.40-49 / ui.reconcile l.280-296): live redraws must keep the node under a
    pointer press or clicks are dropped (owner's 19 Nov bug). Every module renderer must go through redraw/reconcile.
14. **`_h` HTML caches** everywhere (stage `S.h`, `g._h`, `fw._h`, dock `tabsEl._h`…) and the elapsed-clock normaliser in
    stage paint (l.290): the ticker updates `.elapsed` text without a redraw — keep that contract in the SDK.
15. **Shape sync machine** (shape.js l.422-626): held changes across reloads, 409 rebase of one-key changes only, echo
    suppression, never writing on load, never writing a document from a newer version. Tests run it in node; keep it DOM-free.
16. **Shape ids are persisted user data** (`xo:panel/agents`, `xo:dock/shells`, …) in Storm and localStorage: renaming a
    place id needs a `MIGRATIONS.shape` step, not a rename.
17. **Global listeners installed at import** (gestures `touchstart` claim reset, redraw pressed tracking, skeleton
    `homeShell()`, dropdown `customElements.define`, keys `cv-keys` load): module load order is behaviour. The kernel's
    loader must import these early and exactly once.
18. **Source-reading tests**: 11 tests regex stage.js's source, 10 ui.js, 8 redraw.js, 4 dropdown.js, 4 shapeview.js,
    4 focusview.js; they will fail on any move and must be rewritten as behaviour tests or re-pointed.
19. **`/` and other hard-wired keys** outside keys.js (stage.js:645; lightbox, ⌘S/⌘L/⌃G listed as `fixed`): a keys
    registry must account for them or the keys sheet lies.
20. **Settings' `radioKeys(#settings)`** is installed by settings.js for every section (settings.js:360); splitting
    sections without moving it to the host silently drops arrow-key behaviour from Shape and Runtimes.
