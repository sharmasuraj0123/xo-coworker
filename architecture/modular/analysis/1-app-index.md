# 1 · app.js and index.html (snapshot /tmp/xo-6c73139 @ 6c73139)

Scope: `index.html` (293 lines) and `js/app.js` (4,819 lines). Every line range of app.js is mapped in §2.6 (1–4819, no gaps).
Names used for homes follow BRIEF.md (core/kernel, core/platform, core/ui, core/services, shell, modules/<name>, apps-host, vendor).

---

### index.html (293 lines)

- **Purpose:** the one page. It holds the static skeleton of every surface: sidebar, main area (Home, Artifacts, conversation, dock and composer, decisions panel, map, viewer, toast, Settings), the shells dock, and the modal layers (Create dialog, All threads, Runs, chat setup, intelligence popover, Jump, Keys, live region). It also runs two inline pre-paint scripts and loads 17 stylesheets and 3 module scripts.
- **Exports / importers:** none (HTML). It is the parent of `js/skeleton.js`, `js/app.js` and `js/msgx.js`.
- **Coupling beyond imports:**
  - Inline script l.8 reads `localStorage["cv-theme"]` and sets `html[data-theme]`. app.js l.115 `THEME.get` and l.4345 write the same key, so the logic is duplicated.
  - Inline script l.11 reads `localStorage["cv-bubbles"]` and sets `html[data-msgx="bubbles"]` and `data-msgx-tails`. app.js l.4166–4179 writes the same key.
  - `meta[name=color-scheme]` and `meta[name=theme-color]` (l.6–7) are rewritten by app.js `applyTheme` (l.119–122).
  - `link[rel=icon]` (l.13) is rewritten by app.js `faviconRender` (l.2906–2923).
  - The Geist font preload (l.15) is used by `css/base.css` and `tokens.css`.
  - Static text in the page duplicates copy that lives in JS. Examples: the attach note at l.146 is repeated at app.js l.2718; the attach accept list at l.140 is cloned at app.js l.2716 (`$("#att-input").accept`); the placeholders "Message" and "Reply to the agent…" are also set by `syncPlaceholder`.
  - Settings pages: General's three switches (l.185–187) and Sounds (l.196) are wired in app.js. Routing, Runtimes, Rules and Worktrees are empty `.set-live` boxes that settings.js and rtsettings.js fill. Shape `.shp` is filled by shapeview.js. Keyboard `#set-keys-list` is filled by app.js.
- **State it owns:** none at runtime. It fixes the *order of the CSS cascade*, which carries meaning: foundation.css, panel.css and phone.css must load late (see the comments at l.20, 41).
- **Smells for modularity:**
  - Every feature's markup sits in one file, so a module can't own its DOM.
  - The Settings tab list is hard-coded (l.174–183); app.js SIDE.PLACES (l.4381) repeats the page ids, and app.js l.4797 repeats the icons.
  - Copy is duplicated between HTML and JS (attach note, accept list).
  - Three module scripts are entry points. `msgx.js` is both a `<script type=module>` (l.291) **and** imported by app.js (l.37). That works only because ES modules are singletons; it also self-decorates the main chat at import (msgx.js l.906).
  - Pre-paint theme and bubbles logic is inlined and duplicated.

#### index.html element inventory → owner

| Line(s) | Element / id | What it is | Proposed owner |
|---|---|---|---|
| 1–7 | doctype, `<html lang>`, meta charset/viewport/color-scheme/theme-color | page head | shell (index template); `theme-color`/`color-scheme` written by core/ui theme service |
| 8 | inline script: `cv-theme` → `data-theme` | pre-paint theme | core/ui (theme) — emit from one boot snippet shared with the theme service |
| 9–11 | inline script: `cv-bubbles` → `data-msgx`, `data-msgx-tails` | pre-paint conversation look | modules/conversation (look setting), via a kernel "pre-paint flags" hook |
| 12 | `<title>XO Space` | rewritten by app.js `Kit.titleFor` (l.2889) | shell (title service fed by decisions count) |
| 13 | `link[rel=icon]` favicon.svg | rewritten by favicon progress | shell (favicon service) |
| 15 | font preload Geist | — | core/ui |
| 16 | css/base.css (imports tokens.css) | reset + tokens | core/ui |
| 17 | js/vendor/xterm/xterm.css | terminal | vendor (loaded by modules/shells) |
| 18 | css/app.css (3,149 lines) | everything else, the legacy sheet | to split per module (see the CSS analysis file); for now core/ui + shell |
| 19 | css/light.css | light-theme differences | core/ui |
| 21 | css/foundation.css | structure rules, loaded last | core/ui |
| 22 | css/panel.css | right-panel grid | shell (panel host) + modules using the grid |
| 24 | css/diffs.css | Pierre diffs look | modules/changes (+ files) |
| 25 | css/launchpad.css | Launchpad section | modules/launchpad |
| 26 | css/links.css | link shapes in messages | modules/conversation (markdown) |
| 27 | css/artifacts.css | Artifacts place | modules/artifacts |
| 28 | css/dropdown.css | `<xo-select>` | core/ui |
| 30 | css/media.css | pictures/files in messages, lightbox | modules/conversation (media) |
| 32 | css/shape.css | Shape settings, density | core/services shape + modules/settings |
| 34 | css/side.css | sidebar palette, frozen | shell (sidebar) |
| 36 | css/msgx.css | bubbles look, back-to-latest | modules/conversation |
| 38 | css/rich.css | document look, math/charts/diagrams | modules/conversation |
| 40 | css/docs.css | editor, md page, tabs, versions | modules/files |
| 42 | css/phone.css | phone bars, must load last | shell (phone layout) |
| 45 | `#app.app` | root; carries `data-view`, `data-conv`, `data-gone`, classes `drawer` and `side-folded`, CSS vars `--dock-h` and `--herald-room` | shell |
| 48 | `aside#side.side` | sidebar | shell (sidebar) |
| 50–55 | `.side-top`: `#side-fold`, `.brand` with `#brand-mark`, `#side-jump`, `#side-x` | fold, brand, ⌘K opener, phone close | shell (sidebar); `#side-jump` opens modules/search (jump) |
| 56–65 | `nav.nav`: `#nv-home` (`#ic-home`, `#home-n`), `#nv-ws` (`#ic-ws`, `#ws-n`), `#nv-chats` (`#ic-chats`), `#nv-arts` (`#ic-arts`, `#arts-n`), `#nv-more` (`#ic-more`) | places | shell renders from a `sidebar.entry` place; each entry registered by modules/home, modules/conversation(ws), modules/chats, modules/artifacts |
| 66 | `#side-more.side-pop` | More menu / sidebar editor | shell (sidebar) |
| 69 | `.side-label`: `#projects-label`, `#side-add` (`#sc-ic`) | Projects heading, + New | modules/projects (label); `#side-add` is a `sidebar.action` from modules/create-project |
| 71 | `#side-find`: `#sf-ic`, `#pf-in`, `#pf-n` | project filter | modules/projects |
| 72 | `nav#projects` | project rows | modules/projects (`sidebar.section`) |
| 73–80 | `.side-foot`: `#nv-shells` (`#ic-shells`, `.sh-n`), `#theme`, `#set-side` (`#set-side-ic`) | shells toggle, theme, settings | `#nv-shells` → modules/shells; `#theme` → core/ui theme via `sidebar.foot` place; `#set-side` → modules/settings |
| 82 | `#side-scrim` | phone drawer scrim | shell (phone layout) |
| 84 | `main#main` | main area | shell (page host) |
| 85–89 | `header#phonebar`: `#pb-menu`, `#pb-t`, `#set-phone` | phone top bar | shell (phone layout) |
| 92 | `section#home` | Home | modules/home (page) — also drawn by js/skeleton.js before app.js |
| 95 | `section#arts` | Artifacts | modules/artifacts (page) |
| 98 | `section#conv` | conversation page | modules/conversation (page host for ws/p:/t:/c:) |
| 99–105 | `header#top`: `#top-menu`, `#top-back`, `#top-who`, `#top-end` | conversation header | shell (page header host) with `header.title`/`header.action` places; contents from modules/threads, projects, chats, launchpad, stage |
| 106 | `#thead` | checklist + runs strip | modules/threads (thread head) |
| 108 | `#tdel` | delete-thread confirm | modules/threads |
| 110 | `#since` | since-you-were-away line | modules/artifacts (recordview `sinceLine`) |
| 111–117 | `#scroller` (data-own-scroll) > `#column` > `#ws-head`, `#msgs` (role=log), `#typing` | conversation body | modules/conversation; `#ws-head` → modules/conversation (workspace) |
| 119 | `#drop-veil` (`#drop-ic`) | drag-and-drop veil | modules/composer (attachments) |
| 122 | `#dock` | dock stack | shell (dock host) |
| 125 | `#herald` (aria-live) | notices line | core/platform (notices service), rendered by shell |
| 126 | `#tdock` | docked decision | modules/decisions (`dock.card` place) |
| 127–148 | `.cbar` > `form#composer`: `#say-label`, `#att-tray`, `#cref`, `#say`, `#at-list`, `#attach`, `#att-input`, `#target`, `#send-now`, `#iq`, `#send`, `#att-note` | composer | modules/composer; `#iq` → modules/intel as `composer.tool`; `#send-now`/`#target` chat branch → modules/chats as `composer.target` provider; `#cref` → modules/files (line ref) as `composer.attachment` |
| 152–160 | `section#panel`: `#pn-h`, `#pn-count`, `#pn-x`, `#pn-rail`, `#pn-stage`, `#pn-foot` | the "Needs you" decisions panel | modules/decisions (decide.js owns its contents) |
| 163 | `aside#map` | Map | modules/map |
| 166 | `section#viewer` | file viewer | modules/files |
| 168 | `.toast-wrap > #toast` | toast (decide.js l.997) | core/ui (toast) |
| 171–200 | `section#settings`: `#set-x`, `.set-nav` tabs `#set-t-{general,shape,routing,runtimes,rules,worktrees,sounds,keys}`, pages `#set-p-*` | Settings | modules/settings host with a `settings.section` place; General switches `#bubbles-tog`, `#hops-tog`, `#webpics-tog` → conversation/threads; `.shp` → core/services shape view; routing, rules, worktrees `.set-live` → settings.js; runtimes → rtsettings.js; `#sound-tog` → core/ui sound; `#set-keys-list` → core/platform keys |
| 203 | `section#shd` | shells dock (outside views) | modules/shells; moved into the panel by app.js `panelShell` |
| 207–246 | `dialog#create-dlg` (`#create-form`, `#dlg-ic`, `#cp-mode`, `#cpm-empty`, `#cpm-clone`, `#cp-repo-f`, `#cp-repo-ic`, `#cp-repo`, `#cp-gh`, `#cp-name`, `#cp-where`, `#cp-desc`, `#cp-prog`, `#cp-bar`, `#cp-phase`, `#cp-facts`, `#cp-time`, `#cp-stop`, `#cp-hint`, `#cp-err`, `#cp-cancel`, `#cp-submit`) | Create XO Project | modules/create-project (create.js owns it) |
| 249–258 | `#all.sheet`: `#all-h`, `#all-ic`, `#all-q`, `#all-f`, `#all-list` | All threads sheet | modules/threads |
| 261–263 | `#runs.sheet > #runs-card` | sub-agents sheet | modules/threads (runs) — or modules/runs |
| 266 | `#cs-pop` | new-chat setup popover | modules/chats |
| 269 | `#iq-pop` | intelligence popover | modules/intel |
| 272–277 | `#jump.sheet`: `#jump-ic`, `#jump-q`, `#jump-list` | ⌘K Jump | modules/search (quickopen family) |
| 280–285 | `#keys.sheet`: `#keys-h`, `#keys-cols` | shortcuts sheet | core/platform keys (sheet UI in core/ui) |
| 287 | `#live.sr-only` (aria-live) | screen-reader announcements | core/platform (announce) |
| 289 | `<script type=module src=js/skeleton.js>` | Home shell before the graph loads | modules/home (pre-boot); boot order must keep it first |
| 290 | `<script type=module src=js/app.js>` | the hub | becomes core/kernel boot + shell |
| 291 | `<script type=module src=js/msgx.js>` | conversation decoration (also imported by app.js) | modules/conversation; must stop being a separate entry |

---

### js/app.js (4,819 lines)

#### 2.1 Purpose
The hub and composition root. It builds every feature object (decisions, pacing, intel, chats, changes, viewer, paths, quick-open, lightbox, shells, record, map, files, launchpad, stage, files-page, settings, runtime settings, shape view, create). It owns the single app state `S` and the single `render()` loop.

Beyond wiring, about 70% of the file is feature code that lives nowhere else:
- sidebar, Home, the conversation's message model and markup
- conversation headers, the checklist bar, the sub-agents sheet, the docked decision
- typing line, herald, composer, attachments, send/stop/interrupt
- the thread page in the panel, navigation and history
- All threads, the thread menu and delete, Jump, the layer and inert manager
- Settings General, Keyboard settings, theme, the sidebar bar editor
- global keys, phone back, gestures wiring, favicon, boot

#### 2.2 Exports and importers
- **Exports: none.** No file imports app.js; the only reference is index.html l.290. Other files mention "app.js" only in comments (changes.js, msgx.js, lightbox.js, shapeview.js, changesframe.js, turnview.js, diffview.js, gestures.js, stage.js, launchpad.js).
- Everything app.js offers to other modules is passed in as **callbacks at construction**: `go`, `schedule`, `heraldShow`, `announce`, `PROJ`, `isBusy` and so on. This is the de-facto public API the new kernel must provide (§3.3).

#### 2.3 Imports (l.11–69)
- **Platform:**
  - world.js `createWorld, esc, WAITING`
  - util.js `copyText, COPY_REFUSED, space`
  - redraw.js `redraw`
  - api.js `api, uploadAttachment`
  - keys.js `*` as K
  - keynav.js `radioKeys, menuKeys`
  - pending.js `once, isPending, busyAttrs`
  - motion.js `arrive, still, EASE, MOVE`
  - gestures.js `wireGestures, dockGestures`
  - focusview.js `keepFocusInView, usable, hookOf` (`hookOf` is unused)
  - ring.js `regionRings`
  - ui.js `keepTurning, ICON, xi, XO, NEXT_GLYPH, $, $$, RM, clock, dayOf, short, elapsed, reconcile, sound, wait, hold, dial, morph, expand`
  - follow.js `initFollow, toLatest, unpin, isPinned, fromTop, toRow, fromLatest, createFollow`
- **UI kit:**
  - dropdown.js (side-effect: `<xo-select>`)
  - kit.js `*` as Kit
  - xoicons via ui.js
  - fileicons.js `fileIcon`
  - projicons.js `classify, glyph, TOPICS`
- **Services:**
  - shape.js `createShapeStore`
  - shapeview.js `createShapeView, SHAPE_IC, UNKEPT`
  - herald.js `createHerald, noticeFor, refusedNotice`
  - timeline.js: 26 helpers, including `stopWords, uiMsg, forwardOrigin, echoes, threadAnchors, parseTarget, stripTarget, sendErrorTitle, connLine, sendBlock, plainText, hopLine, sharedFileRoute, relayedInto, waitsForTurn, hopNotes, reactionGroups, pageFloor, inPage, canPageOlder, held*, soonestHeld`
  - comms.js `nameWith`
  - runtimes.js `rtName, rtMark, manyRuntimes, findRt, healthOf, canMove, untilWords`
  - content.js `EFFORT, estLine, evidenceFor`
  - review.js `itemParts`
  - paidview.js `paidHtml`
- **Features:**
  - decide.js `createDecisions`
  - pacing.js `createPacing`
  - intel.js `createIntel`
  - chats.js `createChats`
  - changes.js `createChanges, lineRef, fileRef`
  - changesframe.js `countsHtml` (**unused**)
  - diffview.js `setTheme`
  - viewer.js `createViewer`
  - map.js `createMap`
  - stage.js `createStage`
  - launchpad.js `createLaunchpad`
  - lpapi.js `createLpApi`
  - files.js `createFiles, fileScope, localIn, scopeOf`
  - paths.js `createPaths`
  - quickopen.js `createQuickOpen`
  - filespage.js `createFilesPage`
  - attach.js `createTray, fmtSize, kindOf, isLargePaste, pasteLabel, uploadErrorText, FINAL, MAX_FILES`
  - create.js `initCreate`
  - shells/dock.js `createShells`
  - recordview.js `createRecord`
  - skeleton.js `greeting, today`
  - settings.js `createSettings`
  - rtsettings.js `createRuntimeSettings`
- **Conversation rendering:**
  - markdown.js `renderMarkdown, renderInline, setThreadInfo, setWebImages`
  - turnview.js `turnHtml, turnAv, turnSegments, segmentTurn, setWorkMode`; turnview.js is imported twice (l.25 and l.64)
  - media.js `mediaHtml, fromAttachment, fromSharedFile, hydrateMedia, mediaItemOf, viewerFile, retryMedia, wireDragOut, webImagesHtml`
  - rich.js `startRich`
  - lightbox.js `createLightbox`
  - runsview.js `runsStripHtml, runsListHtml, runViewHtml`
  - msgx.js `decorateConversation`

#### 2.4 Coupling beyond imports (concrete)
- **localStorage:**
  - `cv-theme` (l.115, 4345)
  - `cv-bubbles` (l.4171)
  - `cv-drafts:live` (`DRAFTS`, l.110, 146, 2365): drafts per view
  - `xo-side-folded` (l.4355–4358)
  - `xo-side-bar` and `xo-side-pins`: legacy, read then migrated into the shape (l.4395–4412)
  - Keys, sound and shape keep their own keys inside keys.js, ui.js and shape.js.
- **Remote state (`/api/chat/shape`):** `api.shape()` GET and `api.putShape()` PUT `/api/chat/shape` (l.78). Shape keys read here:
  - `xo:conversation/webpics`, `xo:thread/hops`, `xo:thread/runtime`, `xo:thread/branch`, `xo:thread/subagents`, `xo:thread/work`, `xo:composer/intel`, `xo:dock/shells`
  - `panel` list (`xo:panel/*`), `xo:home/*` (via SV.homeOrder)
  - `layout.icons[pid]` (l.276, 330), `layout.side` (l.4394–4406)
- **/api routes reached through `world.act.*`** (57 calls, routes from api.js):
  - **Messages:** `ask` (POST project chat message), `reply` (thread reply), `stop` (POST `/chat/abort`)
  - **Threads:**
    - `resolve`, `editThread` (PATCH `/chat/chats/:chat/threads/:ts`, for title, label and `paused:false`)
    - `deleteThread` (DELETE same) and `restoreThread` (POST `…/restore`)
  - **Runs:**
    - `listRuns` (GET `/chat/sessions/:s/runs`), `run` (GET `/chat/runs/:id`), `transcript` (GET `/chat/runs/:id/transcript`)
    - `stopRun` (POST `/chat/runs/:id/stop`), `stopRuns` (POST `/chat/sessions/:s/runs/stop`)
  - **Items:** `decideItem` (limit item decision)
  - **History and hops:** `loadOlder`, `loadOlderThread`, `findRows`, `loadHops`, `loadChatHops`
  - **Watching:** `watch`, `watchThread`, `watchSession`, `watchSideThread` (SSE scopes and polling)
  - **Lookups:**
    - `chatId`, `projectOf`, `coordinatorBusy`, `coordinatorHeld`, `sessionHeld`, `sessionState`
    - `turnOf`, `replying`, `doing`, `feature`, `policyFor`, `storm`
  - **Uploads:** `uploadAttachment` (XHR upload to the chat's attachments route) through `createTray`.
- **SSE / world events:** handled in `world.onEvent`:
  - `shape` (l.81)
  - `file` with `kind` create/delete/rename (l.239–246)
  - `message` with `answered` (l.486)
  - `ask`, `resumed`, `moved`, `done`, `state` (l.494–502)
  - `world.subscribe(schedule)` (l.4815); `whenWorld` (l.4701)
- **window and document listeners:**
  - **click (capture or bubble):** at least 10 document click listeners (l.336, 2410, 2806, 3537, 4274, 4558, 4668 capture; plus one in SIDE)
  - **pointerdown:** l.337, 2402, 4307, 4550, 4787
  - **keydown on window:** l.4096 (Tab trap), l.4311 (key recording, capture), l.4570 (global keys); keyup l.4669
  - **drag and drop:** dragenter, dragover, dragleave, drop, dragend (l.2224–2228)
  - **popstate** (l.4661), **touchend** (l.4670), custom event **`xo:gesture`** (l.4671)
  - **`matchMedia("(max-width:760px)")` change:** l.4085, 4340, 4813
- **History API:** `history.pushState({xo:1})` (l.4659).
- **Timers:**
  - `setInterval(tickElapsed, 1000)` (l.1959)
  - `S.heldT` and `S.askT` (l.1913–1928); runs transcript poll every 2.5 s (l.1615)
  - commit windows `Kit.COMMIT_MS` (stops, l.1684, 2487)
  - `savedSoon` 2.5 s (l.236); record undo 3.05 s (l.2033); dock undo `hold` 2.7–3 s (l.1843)
  - `showMsg` retry up to 20 × 100 ms (l.3249)
- **Observers:**
  - ResizeObserver: dock (l.1773, 3083), thread page dock (l.2738)
  - MutationObserver: `#shd[hidden]` (l.3892), layers' `[hidden]` (l.4085)
- **Globals and hidden channels:**
  - `world.ui = { tbOpen }` (l.214), shared with chats.js
  - `S` is passed whole into create.js (which writes `S.desc`, `S.local`, `S.n`) and herald.js (`state: S`, owns `S.herald`)
  - `REC.view` and `REC.panel` are monkey-patched (l.265, 413); so is `STAGE.names` (l.409)
  - DOM elements carry expando caches `_h`, `_k`, `_built`, `_sk`, `_key`, `_busy`, `_ch`, `_shut`, `_sel`, `_copyN`, `_copyT`, `_redraw`, `_find`, `_seen`, `_ic`
  - `sideRender.shown`, `.needs` and `.ready` are stored as function properties; so is `updateComposer.dk`
- **DOM reached outside its own markup:**
  - `#stage [data-cx]` and `.cx-pd` (stage.js markup, l.3676)
  - `#panel` (decide.js markup, l.3143)
  - `.sheet-card` of other sheets
  - `.tw-menu`, `.c-h`, `.c-top`, `.c-body`, `.c-act`, `.card-in`: the decision card from decide.js `cardHtml`, measured by `fitDock` (l.1740–1772)
  - `.tb-cf[data-file]`, `[data-tb]`, `[data-b]`, `[data-r]`, `.tb-chev`, `.tb-answer`: turnview markup (l.3019–3068, 3663)
  - `.md-code code` (markdown, l.3690)
  - `[data-mx]`, `.mx-stack` (media, l.3291–3299)
  - `[data-run-call]` (turnview), `[data-runs]` (runsview)
  - `[data-chc]`, `[data-chat-retry]`, `[data-chat-edit]`, `[data-chat-stop]` (chats.js)
  - `[data-made-file]` (recordview)
  - `[data-stage-toggle]`, `[data-stage-open]`, `[data-lp-open]` (stage and launchpad buttons)
- **Keyboard shortcuts (through keys.js ids):**
  - **Global:** `shells`, `jump` (⌘K), `intel`, `write`, `keys`, `map` (⌘\), `sideFold`, `treeFold` (⌘B), `quickOpen` (⌘P), `findInFiles` (⌘⇧F)
  - **Home card:** `allow`, `back`, `details`, 1–9 and Enter (l.3709–3719)
  - **Escape ladder:** l.4585–4599
  - **Composer:** Enter and Shift+Enter, Esc, and @-list ↑ ↓ Enter Tab Esc (l.2370–2384)
  - **Lists:** project filter ↑ ↓ Enter Esc (l.591–608); All ↑ ↓ / Enter Esc (l.3935–3956); Jump ↑ ↓ Enter Esc (l.4047–4056)
  - **Pickers and menus:** settings rail arrows, Home and End (l.4327); side-more arrows and grip ↑ ↓ (l.4516–4531); icon picker arrows, Home, End, Esc (l.310–320)
  - **Header edit:** Enter and Esc (l.3514–3525)

#### 2.5 State it owns
- **`S` (l.134–158)**, plus fields added ad hoc later:
  - **View and navigation:** `view`, `parent`, `opener`, `scroll`, `trail`, `retrace`
  - **Sidebar filter:** `pfind`, `pfCur`
  - **Dock and lines:** `dockFold`, `lref`
  - **Thread header:** `tEdit`, `tMenu`, `tDel`, `tDelLose`
  - **Settings › Keyboard:** `recording`, `keyErr`
  - **Turn blocks:** `tbOpen` (shared through `world.ui`), `tbToggled`
  - **Stops:** `stops` (a Map)
  - **Messages:** `local` (optimistic rows per conversation), `alias` (server id → local id), `drafts`, `n` (id counter)
  - **Home:** `later` (a Set, shared with D), `pin`, `pinAnim`, `wash`, `seen`, `handledOpen`, `homeFocusNext`
  - **Herald:** `herald` (owned by herald.js), `_her`
  - **Checklist:** `ckOpen`, `ckSeen`, `ckFresh`
  - **Other:** `desc` (create.js), `allFilter`, `allDone`, `showHops` (a getter on SHAPE), `focusNext`, `hdrCtl`, `limitBusy`, `limitErr`, `heldT`, `askT`, `filled`
- **Module-level state:**
  - Maps and caches: `waitSince`, `savedT`, `projIcons`, `PICK`, `NEXT_SEEN`, `runsAsked`, `thumbs`, `FAVICON`, `HIST`
  - Runs sheet: `RS` (the sheet's state machine), `pendingStops`, `stopsOut`
  - Thread page and dock: `TP` (thread page), `TD` (main dock)
  - Composers and conversations: `MK` and `TP.K`, `MAIN` and `TP.C`
  - Draw loop and layers: `rendered`, `raf`, `scrollRaf`, `drawing`, `trayRaf`
  - Return targets: `jsel`, `jitems`, `jumpReturn`, `keysReturn`, `setReturn`, `allReturn`, `drawerReturn`
  - Sidebar: `SIDE` (`folded`, `editing`, `extras`)
  - Feature singletons: `CAP` (capabilities), `SHAPE`, `P`, `D`, `IQ`, `CH`, `CHG`, `VW`, `PATHS`, `QO`, `LB`, `SH`, `REC`, `MAP`, `FILES`, `LP`, `STAGE`, `FP`, `MDOCK`, `tray`, `CREATE`, `SETS`, `RTSET`, `SV`

#### 2.6 REGION MAP: lines 1–4819, contiguous, no gaps

Columns: **Lines** · **What it does** · **Uses** · **DOM owned or touched** · **Events, keys, storage, routes** · **Proposed home**

| Lines | What it does | Uses | DOM | Events / keys / storage / routes | Proposed home |
|---|---|---|---|---|---|
| 1–10 | File header comment (design lineage "17 · Converged") | — | — | — | drop (history) |
| 11–69 | 59 lines of imports (see §2.3). Unused: `countsHtml`, `hookOf`, `TOPICS` is used; turnview imported twice | all modules | — | side-effect imports: dropdown.js (custom element) | core/kernel loader; each module imports its own deps |
| 70–81 | `world = createWorld()`; `CAP` capability map; `SHAPE = createShapeStore` with remote get/put and herald notice; world `shape` event → `SHAPE.heard` | world, shape, api | — | GET/PUT `/api/chat/shape`; SSE `shape` | core/services (world, shape), boot-wired by core/kernel |
| 82–94 | Web pictures policy: `WEBPICS` key; `setWebImages` hook for markdown (local files → `fromSharedFile` with `fileRoute`, web → `webImagesHtml` unless shape off); `startRich()` | markdown, media, rich, shape | — | shape `xo:conversation/webpics` | modules/conversation (rendering setup) |
| 95–97 | `noun(w)`: the shape's word for a noun, with XO's word in a tooltip | SHAPE.word | — | — | core/platform words (shape-aware) |
| 98–112 | `params`; `PROJ(id)`, the project display name incl. `workspace`, `@account`, `@chats`; `store` JSON localStorage wrapper; `PHONE` media query; `NUM`/`num`/`low`/`plural`; `DRAFTS` key; `STOP_ICON` | world | — | localStorage wrapper; `matchMedia(max-width:760px)` | `PROJ` → core/services world selectors; `store` → core/platform store; `PHONE` → core/platform (viewport); num/plural → core/platform words |
| 113–131 | Theme: `THEME.get`, `applyTheme` (data-theme, diff theme, meta color-scheme and theme-color from `--canvas`, `#theme` icon and labels); applied at load | diffview.setTheme, ICON | `html[data-theme]`, metas, `#theme` | localStorage `cv-theme` | core/ui theme service (diffview subscribes) |
| 132–162 | App state `S`, `waitSince`, `#live`, `announce(text, still)` (40 ms reset trick) | SHAPE | `#live` | timers | `S` must be split per module (see §3); `announce` → core/platform a11y |
| 163–192 | `P = createPacing`; `D = createDecisions` with callbacks: `render`, `back` (focus to place region, `S.focusNext`), `later`, `onOpenThread` (hosts → chat or plain session), `onNotSent`, `onAllClear`, `onUndone` (pin and dock undo end), `onBreak`, `onSent` (auto-resolve after "Stop here") | pacing, decide, world.act.resolve | panel (via D) | herald timings | modules/decisions (its own wiring) |
| 193–200 | `IQ = createIntel` (simple mode from shape, chip redraw, `recordLine`, onMoved announces and goes) | intel, rtName | — | shape `xo:composer/intel` | modules/intel |
| 201–214 | `CH = createChats` (`restore` puts words back in the composer on the Chats page); `world.ui = {tbOpen}` global | chats | — | — | modules/chats; `world.ui` → conversation service API |
| 215–237 | `CHG = createChanges`; `VW = createViewer` with ask callbacks (`askPlace`, `askAboutLines`, `composeAbout`, `askAboutFile`), edits saved, thread titles, `away`/`opened`/`home` focus; `savedSoon` debounce 2.5 s → `CHG.saved` | changes, viewer, FP, STAGE | viewer | timers | modules/changes; modules/files (viewer) |
| 238–246 | World `file` event → `VW.fileChanged`; create/delete/rename → `PATHS.changed` (worktree path parsing `.xo/worktrees/<id>/…`) | VW, PATHS | — | SSE `file` (file.version) | modules/files |
| 247–256 | `PATHS = createPaths`; `placeNow()` (files scope of the view); `QO = createQuickOpen` (open file, open files, layer → `syncInert`) | paths, quickopen, files.scopeOf | quick-open layer | ⌘P / ⌘⇧F handled later | modules/search (quickopen) + modules/files (paths) |
| 257–259 | `LB = createLightbox`; `wireDragOut(#msgs)` | lightbox, media | `#msgs` | dragstart out | modules/conversation (media) |
| 260–266 | `SH = createShells` (`wanted` from shape `xo:dock/shells`); `CAP.terminal`; `REC = createRecord`; `REC.view` patched | shells/dock, recordview | `#shd`, `#nv-shells` (in shells) | shape | modules/shells; modules/artifacts |
| 267–286 | World helpers: `projects()`, `projIcons` memo, `ownIcon`, `projectIcon(pid)` (classify by name and titles, or shape `layout.icons`) | world, projicons, SHAPE | — | shape `layout.icons` | modules/projects (icon service, public API `projectIcon`) |
| 287–337 | Project icon picker: `PICK`, `pickIcon` (popover in body, grid, arrow, Home and End keys, Esc), `closePick`, `chooseIcon` (→ `SHAPE.patchMine`); document click `[data-pj-icon]` and outside pointerdown | projicons, SHAPE | creates `.side-pop.pk-pop` in body; `[data-pj-icon]` | click and pointerdown on document; keys ←→↑↓ Home End Esc | modules/projects (picker; registers `header.title` affordance) |
| 338–347 | `threadsOf`, `convThread(v)`, `nameWith` (comms naming), `convProject`, `sessionOf` | world, comms | — | — | core/services world selectors (+ places/router for view parsing) |
| 348–362 | `askTitle`, `askShort` (decision item wording) | Kit, markdown, timeline | — | — | modules/decisions (public helpers) |
| 363–383 | Thread state vocabulary: `STATE_WORD`, `isBusy`, `isHeld`, `glyphOf`, `wordOf`, `stOf`, `setThreadInfo` for markdown thread tokens, `SORT_STATE` (unused) | timeline.heldShort | — | — | core/services threads (state model) — used app-wide |
| 384–413 | `MAP`; `FILES`; Launchpad `lpProject`, `lpThread`, `LP = createLaunchpad` with herald notice and unnotice bridges; `STAGE = createStage` (frames from shape `panel`, threads, shell, launch); `FP = createFilesPage`; `STAGE.names` patched; `REC.panel = STAGE` | map, files, launchpad, lpapi, stage, filespage | `#map`, `#stage` (stage), `#viewer` | Launchpad API (lpapi.js); shape `xo:panel/*` | shell (panel host = stage); modules/map, files, launchpad register as `panel.page` / `panel.frame` |
| 414–421 | `agentOf`, `threadMark`, `threadAgentWords` (unused), `RT_EFFORT` | runtimes | — | — | modules/runtimes (public: `threadMark`) |
| 422–462 | `waitingOn(t)` (limit reset time); `rtTag(t, cls)`: runtime tag/limit button in header or list row | runtimes, timeline | emits `[data-set-open=runtimes]` | shape `xo:thread/runtime` | modules/runtimes (`thread.badge` contribution) |
| 463–481 | `STEER_LIVE=false` flag; `sendWhileRunning`; `movable` (continue elsewhere); `threadTargetHtml` (composer target line in a thread) | runtimes, world.act.policyFor | — | — | modules/runtimes (+ composer target provider from threads) |
| 482–506 | `doneToday`; world events → herald lines (coordinator replied, moved, done, failed); `waitSince` bookkeeping; `short1` | world.onEvent, IQ.movedHere | — | SSE `message`, `ask`, `resumed`, `moved`, `done`, `state` | core/services notifications (event → notice rules), each rule owned by its module |
| 507–518 | `pings(needs)`: leverage-gated herald pings for newly arrived asks | P.mayPing | — | — | modules/decisions |
| 519–585 | `sideRender(needs)`: Home and WS counts, aria, active row, Artifacts count, project filter visibility, project rows (needs/busy/held/wash animation), reconcile into `#projects` | D, REC.artifacts.count, world, SIDE.folded | `#home-n`, `#nv-home`, `#ws-n`, `#nv-ws`, `#nv-chats`, `#nv-arts`, `#arts-n`, `#side-find`, `#pf-n`, `#projects` | — | shell (sidebar host and place rows) + modules/projects (project list section) |
| 586–610 | `FIND_AT=8`; project filter input wiring | — | `#pf-in` | input; keys Esc ↑ ↓ Enter | modules/projects |
| 611–649 | Home: `landed` (skeleton → content arrival); **`patch(el, html)`**, the generic focus-preserving in-place redraw used app-wide; `homeParts` | motion, redraw | — | — | `patch` → core/ui (render primitives, next to redraw.js); `homeParts` → modules/home |
| 650–714 | Home "next move" card: `optHtml`, `nextActHtml` (glance options, allow/back, Decide/Later, Send-back note), `nextHead`, `NEXT_SEEN`, `nextCardHtml` | content, Kit, review, paidview | markup ids `#nx-note-in`, `#nx-h` | — | modules/home (consumes the decisions API) |
| 715–800 | `homeRender(needs)`: builds `#home` skeleton once (`#hm-head`, `#hm-since`, `#hm-next`, `#hm-then`, `#hm-end`, `#hm-made`), greeting/sub, Create button, next card (panel-open placeholder, re-arm), calm line, focus handoff, Then list and foot, `REC.homeSinceLines`, `REC.homeMade`, `endRender`, `SV.homeOrder` | skeleton, REC, SV, D | `#home` subtree | — | modules/home; `#hm-since`, `#hm-made` slots → `home.block` place (artifacts registers) |
| 801–849 | `endRender` (Handled line), `handledListHtml`, `nextDecide` (300 ms read guard, stamp animation), `setHandled` | D, Kit.READ_MS | `#hm-end`, `#handled`, `#hd-*` | — | modules/home |
| 850–860 | `chatOf`, `convOfChat`, `convHost` | world | — | — | core/services (conversation addressing) |
| 861–1053 | **`messagesOf(conv)`**: the message model. Root row, optimistic locals and echo merge (`S.alias`), load notes, history line, forward origin and find-rows, routed, queued, thread cards, project done/failed events, decisions and not-sent events, coordinator controls (F6), limit cards, move banners, turns segmented around messages, relayed messages and hop notes, hop lines (shape), chat hops, coordinator failure, empty/start, page floor, seq+time stable merge | world.state (timeline, hist, threadHist, found, turns, hops, routed, controls, failed), timeline.js, turnview, D.decisions/notSent | — | `world.act.findRows`, `projectOf`, `chatId` | modules/conversation (model, pure) → core/services conversation selector; event sources (decisions, threads) should register `conversation.event` providers |
| 1054–1060 | `proseHtml` (markdown with has-table) | markdown | — | — | modules/conversation |
| 1061–1081 | `threadCardHtml(tid, needs)`: thread card in messages | REC.latestOf, SHAPE | `[data-made-file]`, `[data-decide]`, `[data-go]` | shape `xo:thread/branch` | modules/threads (`conversation.block` "thread-card") |
| 1082–1101 | `queuedMeta(conv)` (waiting and Interrupt); `nameOf(conv, who)` | running, workingRuns, SHAPE | `[data-interrupt]` | — | modules/conversation (+ composer stop API) |
| 1102–1118 | `moveBannerHtml` (F4 continued in/from, Pick back up) | runtimes | `[data-unfreeze]` | — | modules/runtimes (`conversation.block` "move") |
| 1119–1147 | `HS_THEM`/`HIST_SKEL` skeleton; `answeredAfter`; `passedTo` (hop → thread title) | world.state.hops | — | — | modules/conversation |
| 1148–1168 | Empty-project starts: `STARTS`, `startHtml`, `startDraft` (prefill composer) | SHAPE.word, composer fns | `[data-start]` | — | modules/projects (`conversation.empty` place) using the composer API |
| 1169–1297 | **`msgItems`/`msgItemsOf`**: the markup for each row kind (gone thread, day separators, you/sending/failed/receipt/route rows, coordinator and agent messages with iq tag and cards, turn, card, back-quote, passedOn, control, limit, move, asked, system, note, start, hist, event, rec); sets the `drawing` global | CH.items, STAGE.chosen, CHG.forTarget, media, turnview | `[data-retry]`, `[data-edit]`, `[data-go-msg]`, `[data-limit]`, `[data-tb]`, `[data-older]`, `[data-rec-undo]` | — | modules/conversation renderer with a **keyed `conversation.block` registry** (kind → renderer); limit → runtimes, control → threads, turn → conversation/turns |
| 1298–1309 | `wsHeadRender` (Workspace intro at top of history) | — | `#ws-head` | — | modules/conversation (workspace) |
| 1310–1350 | Header helpers: `counted`, `countLine`, `threadCounts`, `threadsCtl` (Threads button → panel), `hostNeedHtml` (coordinator needs you), `convName` (unused) | threadState | `[data-stage-open]`, `[data-dock-open]` | — | modules/threads (`header.action` "threads"); modules/decisions (`header.title` need) |
| 1351–1436 | **`topRender(needs)`**: header per view kind (chats, ws counts, project icon+title+need, thread title/label edit, badge, rtTag, Resolve, ⋯ menu, Launchpad and Stage buttons), back button, `LP.ensure`, checklist, tdel, `REC.sinceLine` | CH, LP, STAGE, REC, PICK | `#top` (data-kind, data-state), `#top-back`, `#top-who`, `#top-end`, `#conv-title`, `#tw-edit` | — | shell (header host) + `header.title`/`header.action`/`header.menu` places filled by projects, threads, launchpad, stage, chats, runtimes |
| 1437–1482 | `checklistRender(needs, th, view, listId)`: checklist bar with fresh-tick animation, modes, runs strip | runsStrip, SHAPE | `#thead` / `#tpthead` | timer 1.56 s | modules/threads (thread head) |
| 1483–1507 | Sub-agents strip: `LIVE_RUN`, `runsAsked`, `workingRuns`, `runsStrip` (lazily lists runs) | runsview, world.act.listRuns | — | GET runs | modules/runs (or threads/runs) |
| 1508–1629 | Runs sheet: `RS` state machine, `canStopRuns`, `sheetStops`, `runsHook`, `runsRender` (focus keep), `runsEscape`, `openRuns`, `runsLand`, `readRunsList` (opening tokens), `openRun`, `readTranscript` (paged, 2.5 s poll), `closeRuns` (focus return) | runsview, world.act.run, transcript, listRuns, feature | `#runs`, `#runs-card` | GET `/chat/runs/:id`, `/transcript`; poll timer | modules/runs |
| 1630–1708 | Run stops: `pendingStops`, `stopsOut`, `stopReceipt` (honest wording per endpoint type), `stopRunsUndo` (3 s commit window, herald), runs sheet click/keydown handlers | Kit.COMMIT_MS, herald | `#runs` | POST `/chat/runs/:id/stop`, `/sessions/:s/runs/stop`; Esc | modules/runs (shares the "pending stops" herald with composer stop: core/services stops) |
| 1709–1874 | **`createDock({el, view, region, TD})`**: docked decision for a conversation: `dockSwap` (focus-safe), `fitDock`/`dockEdges` (one-scroll mode, Answers pill, fades), ResizeObserver, `dockRender` (chat confirm first, folded line, card from `D.cardHtml`, `D.wireCard` after-hook with stamp, done line and Undo window), click/keys, `dockGestures`; `MDOCK`, `TD`, `dockRender` | D (cardHtml, wireCard, cardKeys, decisions, undo), CH.confirmHtml, morph, hold, gestures | `#tdock` (+ `#tptdock`) | ResizeObserver; scroll capture; keys via D.cardKeys | modules/decisions (`dock.card` place renderer); chat confirm via a `dock.card` priority-chain (chats first) |
| 1875–1959 | Typing line: `openAsk(project)` (open hop ask ≤20 min), `typingRender(C)` (held, coordinator replying/doing, waiting for WS, chat working, thread working), `tickElapsed` with `setInterval` 1 s | world.state hops/turns/awaiting, world.act.replying/doing/coordinatorHeld/sessionHeld, CH.working | `#typing` / `#ttyping`, `.elapsed[data-since]` | timers `S.heldT`, `S.askT`, interval | modules/conversation (typing) |
| 1960–2025 | Herald: lazy `HER()`, `regionRings()`, `keepFocusInView()` boot calls, `heraldShow/For/Put/Next/Drop`, `heraldRender` (notice or connection line via `connLine`), `heraldRoom` (`--herald-room` measure), `heraldBack` focus | herald.js, ring.js, focusview.js | `#herald`, `#dock`, `#app` style | — | core/platform notices service (API: show/forMsg/drop/next) + shell renders it; `regionRings`/`keepFocusInView` → core/ui boot |
| 2026–2075 | Intelligence: `recordLine` (local "rec" row and herald with Undo), `recUndoLeaves`, `undoRecord`, `chipRender` (the `#iq` chip, fade swap) | IQ | `#iq` / `#tiq` | timer 3.05 s | modules/intel (`composer.tool` + `conversation.local-row`) |
| 2076–2095 | Composer object `MK` (main) and `wireComposer(K)` for thread-page composers | — | `#say`, `#send`, `#composer`, `#target`, `#say-label`, tray els, `#iq` | Enter, Shift+Enter, Esc; submit | modules/composer (factory `createComposer`) |
| 2096–2229 | Attachments: `tray = createTray`, `canAttach`, `attachChat`, `filesHere`, thumbnails (object URLs), `chipHtml`, `trayRender`, `addFiles`, `insertText`, `#attach`/`#att-input` wiring, `wireTray` (remove/retry/view/inline, paste → file), page-level drop veil | attach.js, api.uploadAttachment, VW | `#att-tray`, `#attach`, `#att-input`, `#att-note`, `#drop-veil`, `#drop-ic` | upload XHR; paste; window drag events | modules/composer (attachments sub-module) |
| 2230–2265 | `growSay`, `running(view)` (what Stop stops), `sendRender` (send/stop icon, disabled reasons) | CH, world.act | `#send` | — | modules/composer (+ stop service) |
| 2266–2366 | `chatTargetRender`, `targetLineRender` (where the message goes / why paused), `updateComposer` (tray, lref, target, placeholder, send, grow, @-list build), `syncPlaceholder`, `atClose`, `pickAt`, `saveDraft`, `loadDraft` | timeline.parseTarget, CH, projectIcon | `#target`, `#at-list`, `#say` aria | localStorage `cv-drafts:live` | modules/composer; @-mention → `composer.mention` provider from modules/projects; drafts → core/services drafts |
| 2367–2436 | Composer event wiring: say input/click/keydown (IME guard, @ list keys, Enter send, Esc blur), @ list mousedown/pointermove, composer "held" shape during pointer, submit, target click (chats setup or @ insert), Send now, `#iq` click | CH, IQ | `#say`, `#at-list`, `#composer`, `#target`, `#send-now`, `#iq` | keys; document pointer events (capture) | modules/composer (+ chats provides target/send-now via places) |
| 2437–2519 | Stop/Interrupt: `stopLive` (3 s Undo, turn token check, abort, honest receipts, Retry), `stopsHerald` (one Undo for all stops incl. run stops), `stopRun`, `interruptRun` | world.act.stop/turnOf, sound | `[data-interrupt]`, `[data-chat-stop]` | POST `/chat/abort` | core/services stops (shared by composer, runs, thread menu) |
| 2520–2555 | `lift` (bubble rise animation), `liveBlock`, `blockFor` (the one send gate), `refuse`, `connDest`, `composerDest` | timeline.sendBlock, herald.refusedNotice | — | — | modules/composer (send gate → core/services send) |
| 2556–2698 | Sending: `sendLive` (target parse, lref prefix, optimistic row, client id, sound, carry to conversation, herald), `deliverLive` (`once`), `postLive`, `postWithFiles` (re-upload on `unknown_attachment`), `send` (chats vs storm), `retry`, `putBack`, `editFailed` | world.act.ask/reply, tray, pending, sound, STAGE.resumeFollow | — | POST messages, attachments | core/services send (outbox: optimistic rows, alias, retry) + modules/composer UI |
| 2699–2816 | **Thread page in the panel (P2)**: `TP`, `tpView`, `tpMount` (builds its own head, checklist, scroller, msgs, dock, composer markup; follow; conv; composer; tray; dock; files drop; iq; msgx decoration; ResizeObserver; scroll paging), `tpShow`, `tpUnmount`, `STAGE.page("thread", …)`, `tpHead`, `tpMenuHtml`, `drawThreadPage`, `[data-tp-full]` click, `openFromPanel` | follow, msgx, stage, createConv, createDock, wireComposer | builds `#tphead`, `#tpthead`, `#tscroller`, `#tcolumn`, `#tmsgs`, `#ttyping`, `#tpdock`, `#tptdock`, `#tpcomposer`, `#tsay`, `#tsend`, `#ttarget`, `#tiq`, `#tatt-*` | drag/drop; ResizeObserver; scroll | modules/threads (registers `panel.page` "thread"), built from conversation + composer + decisions factories |
| 2817–2894 | Render core: `createConv`, `MAIN`, `FIRST_MSG` (unused), `rendered`, `raf`, **`schedule()`**, **`render()`**: data-view/conv/gone on `#app`, page visibility, phone title, sidebar, Home/Artifacts/conversation, loadAhead, thread page, dock, herald, target, placeholder, send, chip, `D.sync`, `MAP.render`, `VW.notice`, `STAGE.sync`, `FP.sync`, document title, favicon, `S.focusNext` | everything | `#app`, `#home`, `#arts`, `#conv`, `#pb-t` | rAF | core/kernel (scheduler + render pass that calls each registered module's `render(ctx)`), shell (page host switching) |
| 2895–2923 | `placeRegion`; favicon progress (`FAVICON`, `faviconRender`, inline SVG) | — | `link[rel=icon]` | — | `placeRegion` → shell (focus fallback); favicon → shell (tab status) |
| 2924–2983 | `loadAhead` (page older), `loadOlderNow` (focus keep), `drawConv(C, needs)` (CHG.sync, items, folds, readingPlace, reconcile, hydrateMedia, holdPlace, workMotion, ensureRoot, typing, open at latest) | follow, reconcile, media | conv elements | `world.act.loadOlder`/`loadOlderThread` | modules/conversation |
| 2984–3090 | Reading place and motion: `isMessageRow`, `readingPlace`, `childOf`, `holdPlace`, `stirred`, `foldsBefore`, `workMotion`; scroller scroll (loadAhead, `#top.is-scrolled`); dock ResizeObserver (`--dock-h`, `is-stacked`, heraldRoom); `initFollow()` | motion, follow | `#scroller`, `#top`, `#dock`, `#app` | scroll; ResizeObserver | modules/conversation (scroll/motion); dock measuring → shell |
| 3091–3184 | Navigation: `saveScroll`, **`go(v, opts)`** (viewer leave guard, resets, close settings/drawer/IQ, phone panel close, opener memory, trail, parent, REC.leave, follow, dock reset, enter animation, draft, render, scroll restore, focus), `returnPill` | VW, FP, STAGE, IQ, REC | `#home`, `#arts`, `#column`, `#panel`, `#mx-return` (created in `#conv`) | — | core/platform router (places/router: `go`, parent, trail) + shell (transitions, focus); module hooks `onLeave`/`onEnter` |
| 3185–3230 | `liveReady`, `follow()` (watch scopes, hops, thread/session watch, CH.open), `loadChatHops`, `ensureRoot`, `back()`, `#top-back` click | world.act.watch* | `#top-back` | SSE scopes; GET hops | router enter-hook per page (conversation/chats); `back` → router |
| 3231–3259 | `decideKey` (in-thread dock vs panel), `showMsg(id)` (find, toRow, flash) | D, follow.toRow | `#tdock`, `#msgs` | timers | modules/decisions (`decideKey`), modules/conversation (`showMsg`) |
| 3260–3300 | `fwdSource`, `reactionsHtml`, `reactorName`, `openMedia` | timeline, media, LB, VW | `[data-mx]` | — | modules/conversation |
| 3301–3322 | `drawing` global, `fileRoute(path, conv)`, `openSharedFile(btn)` | timeline.sharedFileRoute, VW | `[data-file]` | — | modules/files (route resolution), called from conversation |
| 3323–3412 | Ask about lines/file: `youText` (capsules), `openLineRef`, `askPlace`, `askAboutLines`, `composeAbout`, `askAboutFile`, `lrefRender`, `sendAbout` | changes.lineRef/fileRef, files.fileScope, fileicons, send | `#cref` | — | modules/files (ask-about) using composer API (`composer.attachment` "line-ref") and send service |
| 3413–3531 | Thread header actions: `resolveThread` (once, herald mid, Undo/Retry), `closeThreadMenu`, `menuKeys(#top)`, `startThreadEdit`, `endThreadEdit`, `saveThreadField`; `#top` click (`data-dock-open`), keydown (edit, Esc), input, focusout autosave | world.act.resolve/editThread, pending, keynav | `#top`, `#tw-edit`, `[data-tmenu]` | PATCH thread; keys Enter/Esc | modules/threads |
| 3532–3700 | **Global click router** (one document listener, about 45 branches): `convAt`/`composerAt`, `data-go`(+msg), `a[data-thread]`, older, start, decide, next*, create, all-threads*, switch*, shell, open-all, glances, later, bring, handled, bring-in, rec-undo, herald-undo, chc, chat-retry/edit/stop, run-call, runs, tb (fold + unpin + motion), resolve, tmenu, tgo, tcopy (clipboard), tdel/no/yes, limit, tmove (IQ picker), unfreeze, tfield, ck, nx-opt/allow/back/send/cancel, retry, interrupt, edit, mx, lref-x, ref, tb-cf (diff in Changes or Files), file, copy (code copy) | most modules | document | click; clipboard | **dissolve**: core/platform "actions" registry (`data-action` → handler, registered by each module); see §3 |
| 3701–3725 | Home card keydown (note Enter/Esc, 1–9, allow, back, details), `openNext` | K, Kit | `#home`, `#nx-note-in` | keys | modules/home |
| 3726–3763 | `STATE_WORDS`, `threadState(t, needs)`, `panelThreads(v)` (grouped rows incl. coordinator, Map's doing line) | D, MAP.agents | — | — | modules/threads (public `threadState`, `panelThreads` → panel frame "threads") |
| 3764–3818 | All threads sheet: `allRender` (search, filter, fold done), `ALL_F`, `allFilterRender`, `radioKeys(#all-f)` | SHAPE.word, redraw | `#all`, `#all-h`, `#all-q`, `#all-f`, `#all-list` | — | modules/threads |
| 3819–3875 | Thread ⋯ menu: `threadSiblings`, `threadMenuHtml`; delete: `tdelRender`, `deleteThread` (would_lose_work confirm, restore Undo) | panelThreads, SH, movable | `#tdel` | DELETE thread; POST restore | modules/threads (`thread.menu` list place: shells, runtimes add items) |
| 3876–3899 | Panel Shell: `SHD_HOME`, `panelShell(on, host)` (moves `#shd` into panel), MutationObserver, `openShell(where)` | SH, STAGE | `#shd` | MutationObserver | modules/shells (`panel.page` "shell") |
| 3900–3970 | `openAll` (drop or sheet), `closeAll`, search input, keydown (/ Esc ↑ ↓ Enter, IME), click (filter, done fold, go) | — | `#all*`, `[data-switch]` | keys | modules/threads |
| 3971–3978 | `CREATE = initCreate` (passes `S`), `#side-add` | create.js | `#side-add`, `#create-dlg` (in create.js) | — | modules/create-project (`sidebar.action`, `home.action`, `jump.action`) |
| 3979–3999 | Phone drawer: `setDrawer`, menu/close/scrim wiring | — | `#app.drawer`, `#side-scrim`, `#pb-menu`, `#top-menu`, `#side-x`, `#side`, `#nv-home` | — | shell (phone layout) |
| 4000–4067 | Jump (⌘K): `threadIc`, `jumpRender` (places, projects, threads, typed verbs incl. theme/settings/keys/intel/stage, `REC.jumpItems`), `focusOverlay`, `openJump`, `closeJump`, input/keys/pointer/click | world, CREATE, IQ, STAGE, REC | `#jump`, `#jump-q`, `#jump-list` | keys ↑ ↓ Enter Esc | modules/search (jump) with a **`jump.item` / `jump.action` list place** every module contributes to |
| 4068–4108 | Layer manager: `syncInert` (sheets, QO, Settings, phone drawer), observers, `keyLayer`, Tab wrap trap | — | `#app`, `#main` children, `#side` | window keydown Tab; MutationObserver; PHONE change | core/ui (layers / focus trap service: `layer.push/pop`) |
| 4109–4190 | Keys sheet element; Settings › Sounds (`soundRender`, `#sound-tog` turn), Settings › General (`hopsRender`, `webpicsRender`, `deviceSaid`, webpics toggle, Chat bubbles `setChatBubbles`, hops toggle); `openKeys`/`closeKeys` | sound, SHAPE.setDevice, UNKEPT | `#keys`, `#sound-tog`, `#hops-tog`, `#webpics-tog`, `#bubbles-tog` | localStorage `cv-bubbles`; shape device layer | `settings.section` contributions: sounds → core/ui sound; bubbles + webpics → modules/conversation; hops → modules/threads; keys sheet → core/platform keys |
| 4191–4212 | Settings init: `setEl`, `SETS`, `RTSET`, `SV`; `shapeApply` (SV.apply, work mode, toggles, hops reload, SH.redraw, STAGE.reshape); SHAPE.onChange | settings, rtsettings, shapeview, turnview.setWorkMode | `#settings` | — | modules/settings host; shape fan-out → core/services shape `onChange` subscribers per module |
| 4213–4235 | `decideLimit` (F5 limit item), `unfreeze` (F4) | world.act.decideItem/editThread | `[data-limit]`, `[data-unfreeze]` | POST item decision; PATCH thread | modules/runtimes |
| 4236–4274 | `setPage`, `openSettings`, `closeSettings`, `#set-side`, `#set-phone`, `#set-x`, tab clicks, document `[data-set-open]` | SETS, RTSET, SV, D, IQ | `#settings`, `#set-side`, `[data-set]`, `[data-page]` | — | modules/settings (route `settings/<page>`) |
| 4275–4340 | Shortcuts UI: `keysSheetRender`, `keysPageRender` (rebind, reset), list click, pointerdown cancel, capture keydown recorder, `K.onChange`, settings rail arrow keys, rail orientation on phone | keys.js | `#keys-cols`, `#set-keys-list`, `.set-nav` | window keydown capture; keys ←→↑↓ Home End | core/platform keys (sheet + settings section); rail keys → modules/settings |
| 4341–4348 | Theme toggle click | applyTheme | `#theme` | localStorage `cv-theme` | core/ui theme (`sidebar.foot` entry) |
| 4349–4556 | **SIDE**: fold (`xo-side-folded`), bar model (`CORE` places, `PLACES` = Settings pages), `bar()`/`save`/`reset`/`adopt` (legacy keys → shape `layout.side`), `pin`, `move`, `apply` (reorders nav rows, makes `[data-set-open]` rows), `drawMore` (menu or editor), `edit`, `openMore`, `closeMore`; wiring for fold, jump, more, more click/keys/drag/drop, outside pointerdown; `SIDE.apply()`; `SHAPE.synced` adopt; `SHAPE.onChange` | SHAPE, K.hint, redraw, xi | `#side-fold`, `#side-jump`, `#nv-more`, `#side-more`, `#side .nav .nrow` | localStorage `xo-side-folded`, `xo-side-bar`, `xo-side-pins`; shape `layout.side`; drag `text/x-xo-place`; keys | shell (sidebar: entries come from the `sidebar.entry` place, so CORE/PLACES become registrations) |
| 4557–4558 | Document click: `[data-stage-toggle]`, `[data-stage-open]`, `[data-lp-open]` → STAGE | STAGE | — | click | shell (panel host actions) |
| 4559–4619 | Global keys: `GLOBAL` map (shells, jump, intel, write, keys, map, sideFold), window keydown (recording guard, IME, shells own keys, mod-globals, jump/IQ/create guards, **Escape ladder** over 12 layers, non-mod globals), `runGlobal` (treeFold, quickOpen, findInFiles) | K, SH, QO, RS, FP, D, CH | — | window keydown | core/platform keys (command registry: each module registers `command` + default key) + core/ui layers (Escape goes to the top layer) |
| 4620–4671 | Phone Back: `sheetsOpen`, `placeOk`, `canBack`, `stepBack` (same ladder as Escape plus trail), `HIST`, `armBack`, popstate, arm on click/keyup/touchend/`xo:gesture` | history API | — | popstate; pushState `{xo:1}`; custom event `xo:gesture` | core/platform router (history) + core/ui layers |
| 4672–4699 | `wireGestures({...})` with 7 sheet descriptors (panel, all, runs, jump, keys, iq-pop, cs-pop), resolve-by-swipe, toast | gestures.js | `#panel`, `#all`, `#runs`, `#jump`, `#keys`, `#iq-pop`, `#cs-pop` | touch | core/platform gestures, fed by the layer registry (each layer declares `swipeClose`) |
| 4700–4760 | `whenWorld(test, fn)`; `resolveFromRow` (swipe-resolve row with its own Undo/Retry line) | world.subscribe, resolveThread | `#all-list li` | — | `whenWorld` → core/services world; `resolveFromRow` → modules/threads |
| 4761–4765 | `#nv-shells` click closes drawer; `#pb-t` click scrolls to top | — | `#nv-shells`, `#pb-t` | — | shell (phone layout) |
| 4766–4819 | **Boot**: fills icons into static markup (brand, sidebar, phone bar, settings rail icons map incl. a dead `night` entry, search icons, close buttons, send); chat setup popover wiring (`#cs-pop` change/click/keys/outside pointerdown, radioKeys); `applyTheme` again; `SIDE.fold`; `soundRender`; PHONE change → drawer + render; `world.subscribe(schedule)`; `keepTurning()`; `follow()`; `loadDraft()`; `render()` | ICON, XO, SHAPE_IC, CH | many static ids, `#cs-pop` | PHONE change | icons → each owner's markup (rendered from templates, no post-fill); `#cs-pop` → modules/chats; boot sequence → core/kernel |

Coverage check: the ranges above run 1–10, 11–69, 70–81, …, 4761–4765, 4766–4819, each starting at the previous end + 1.

#### 2.7 Smells that matter for modularity (evidence)

1. **God module and god render.**
   - `render()` (l.2840–2894) draws every surface in a fixed order and calls 15 module syncs (`D.sync`, `MAP.render`, `VW.notice`, `STAGE.sync`, `FP.sync`, …).
   - Every module asks for a full redraw through an `onChange: () => schedule()` callback.
   - There is no per-module invalidation. A registry needs `render(ctx)` per registered place, with dirty flags.
2. **One mutable state bag `S` shared across features** (l.134).
   - It is passed **whole** into create.js (writes `S.desc`, `S.local`, `S.n`: create.js) and herald.js (`state: S`, l.1964).
   - Fields are added ad hoc far from the declaration: `S.focusNext` l.174, `S.pinAnim` l.186, `S.hdrCtl` l.1402, `S.limitBusy` l.1267, `S.tDel` l.3622, `S.tbToggled` l.3607, `S.heldT` l.1913.
   - `S.later` is shared by reference with decide.js (l.175).
   - `world.ui = {tbOpen: S.tbOpen}` (l.214) is a hidden global read by chats.js.
3. **Monkey-patching other modules' objects:** `REC.view = …` l.265, `STAGE.names = …` l.409, `REC.panel = STAGE` l.413. These are cycles: REC ↔ STAGE ↔ app.
4. **Construction-order cycles hidden by hoisting and closures.**
   - `VW` (l.217) references `FP` and `STAGE` before they exist (l.404–407). It works only because they are called later.
   - `PATHS`'s `onChange` references `QO` and `FILES` before they are defined (l.248).
   - `CH` receives `heraldShow`, `go` and `schedule` as wrappers to dodge TDZ (l.203).
   - `HER()` is lazy because heralds can be asked for before `S` is ready (l.1964).
   - A kernel with explicit lifecycle (register → start) removes this.
5. **One document click router** (l.3537–3700, about 45 `data-*` branches in a fixed order) plus 7 more document or window click listeners.
   - Order is load-bearing: `#iq-pop` returns early; `data-go` is skipped inside `#all` and `#stage`; `[data-tb]` must run before `[data-file]`; `.tb-cf[data-file]` must run before `[data-file]`.
   - Several modules emit hooks only app.js handles: chats.js `data-chc`, `data-chat-*`; turnview `data-run-call`, `data-file`; markdown `data-copy`, `data-thread`; media `data-mx`; runsview `data-runs`.
   - Proposed fix: an action registry in core/platform with scoped delegation.
6. **Duplicated ladders.**
   - Escape (l.4585–4599), `stepBack` (l.4631–4655), `canBack` (l.4627), `sheetsOpen` (l.4625), `keyLayer` (l.4088), `syncInert` (l.4074) and the `wireGestures` sheet list (l.4685–4693) each list the layers again, in slightly different orders.
   - Escape omits LB and STAGE-on-phone; stepBack includes them.
   - Proposed fix: one layer stack in core/ui.
7. **Duplicated per-conversation code paths.**
   - Main vs thread-page: `MK` vs `TP.K` and `MAIN` vs `TP.C`. Functions take `K = MK` or `C = MAIN` defaults, but many still read globals: `say`, `atList`, `$("#composer")`, `S.view` in `updateComposer` main branch (l.2302–2333), `lrefRender` (only `#cref`), `chatTargetRender`, `sendNowRender`, `returnPill`, `showMsg`, `openMedia` (`msgsEl`).
   - The thread page therefore lacks @-mentions, line refs and send-now.
   - Proposed fix: a real `createConversation` / `createComposer` factory in modules/conversation and modules/composer.
8. **Theme and bubbles logic duplicated** between index.html inline scripts (l.8, 11) and app.js (l.115–131, 4166–4179). Settings rail icons are duplicated (l.4797), with a dead `night` key.
9. **Dead or unreachable code** (grep of the snapshot's js/):
   - Hooks app.js handles but **nothing renders**: `[data-switch]` (l.3553), `[data-next]` (l.3550), `[data-all-threads]` (l.3552). So `openAll()` (l.3901) and the whole **All threads sheet** `#all` (l.3764–3970, plus `resolveFromRow` l.4714) appear unreachable from the UI.
   - Only gestures.js reads `#all-list`. Its role was taken by the panel's Threads (`threadsCtl` → `data-stage-open`). Confirm with the owner before porting.
   - Thread-page ⋯ menu: `TP.menu` is never set to true. No handler for `[data-tp-menu]` exists (l.2783 renders it; l.2774 only clears it), so `tpMenuHtml` (l.2788) is never shown. This is a bug, not dead code: the button does nothing.
   - Unused: `countsHtml` import (l.49), `hookOf` (l.69), `SORT_STATE` (l.383), `threadAgentWords` (l.420), `convName` (l.1350), `FIRST_MSG` (l.2832), `const tf` read before use (l.3615).
   - Leftovers: `nd` in `heraldRender` (l.1994–1996), the `[data-tfield]` lookup ordering, `keepBottom` no-op (l.1733), `SIDE.drawPins` alias (l.4451).
   - The `STEER_LIVE=false` feature flag (l.466) gates UI on a backend deploy. It belongs in capability negotiation (`CAP`), not a constant.
10. **Markup built as strings with event hooks by attribute**, then post-filled icons at boot (l.4768–4810).
    - A static button in index.html is empty until app.js runs.
    - Modules should own templates for their own markup.
11. **Cross-module DOM reach.**
    - `fitDock` measures decide.js's card internals (`.c-h`, `.c-body`, `.c-act`, `.card-in`).
    - `workMotion` measures turnview internals (`[data-b]`, `[data-r]`, `.tb-chev`).
    - `l.3676` focuses `#stage [data-cx]`; `l.3143` checks `#panel`.
    - These need public APIs (`D.fit(frame)`, `turns.motionParts(el)`, `stage.focusChange(path)`).
12. **The `patch()` primitive (l.629) belongs in core/ui** but lives in app.js. Other modules use `redraw` + `_h` caching by hand (l.1425, 1430, 1448, 1521, 2139, 2272, 2292, 2784, 3395, 3854, 4476), with no single "keyed region" helper.
13. **Optimistic messages and client ids are generated in two places** (`sendLive` l.2576 and `sendAbout` l.3404, identical id and cid code). Create.js writes `S.local` too. This needs one outbox service.

#### 2.8 Proposed homes (summary for app.js)

- **core/kernel:**
  - boot sequence (l.4766–4819)
  - scheduler and render pass (l.2833–2894)
  - module construction now done inline (l.163–413, 3973, 4193–4198), which becomes registration
- **core/platform:**
  - `announce` (l.162) and `store` (l.101)
  - router: `go`, `back`, trail, parent, `stepBack`, history (l.3091–3230, 4620–4671)
  - action registry (replaces l.3532–3700)
  - keys and commands (l.4275–4340, 4559–4619), gestures wiring (l.4672–4699)
  - notices / herald (l.1960–2025)
  - words: `noun`, `num`, `plural` (l.95–109)
- **core/ui:**
  - theme (l.113–131, 4341–4348)
  - `patch` (l.629–641), layers, inert and Tab trap (l.4068–4108)
  - `focusOverlay` (l.4039), sound setting (l.4109–4137)
- **core/services:**
  - world selectors (`PROJ`, `convThread`, `chatOf`, `convProject`, `threadsOf`, `whenWorld`)
  - thread state vocabulary (l.363–383, 3726–3736)
  - shape store and fan-out (l.70–81, 4199–4212)
  - drafts (l.2365–2366), outbox / send (l.2520–2698, 3398–3412)
  - stops: commit windows, honest receipts (l.1630–1685, 2437–2519)
- **shell:**
  - sidebar host (l.519–585 frame part, 4349–4556)
  - header host (l.1351–1436 frame), panel host (STAGE wiring l.404–413, 4557–4558)
  - page switching (l.2856–2860), dock measuring (l.3076–3089)
  - phone drawer and bar (l.3979–3999, 4761–4765), favicon and title (l.2888–2923), `placeRegion`
- **modules:**
  - **home:** l.611–849, 3701–3725
  - **conversation:** l.82–94, 850–1297, 1875–1959, 2817–3090 (draw parts), 3231–3300
  - **composer:** l.2076–2436, 2520–2555 UI
  - **decisions:** l.163–192, 348–362, 507–518, 1709–1874, 3233–3246
  - **threads:**
    - l.1061–1081, 1310–1350 (threads control), 1437–1482
    - l.2699–2816 thread page, 3413–3531, 3726–3970, 4700–4760
  - **runs:** l.1483–1708
  - **projects:** l.267–337, 586–610, 1148–1168, @-mention provider
  - **runtimes:** l.414–481, 1102–1118, 4213–4235
  - **files:** l.238–256, 3301–3412
  - **intel:** l.193–200, 2026–2075
  - **chats:** l.201–213, 4776–4788
  - **search/jump:** l.4000–4067
  - **settings:** l.4109–4274 host and General
  - **shells:** l.260–262, 3876–3899
  - **map, launchpad, artifacts, create-project:** wiring lines only (l.384–413, 263–265, 3971–3978)
- **apps-host:** nothing in app.js today. Note that the panel's "later apps" (comment l.386) is the intended entry: `panel.page` registrations.

---

## 3 · Domain summary

### 3.1 Module boundaries for the hub's content
app.js should shrink to **boot only** (`kernel.start([...modules])`, about 50 lines). Proposed modules and what they take from app.js:

- **core/kernel**
  - `createKernel()`: a registry of places, lifecycle `register(module) → start(ctx) → stop()`, a scheduler (`invalidate(placeId)` replacing `schedule()`), and an event bus.
  - The bus carries world events and app events: `view:changed`, `shape:changed`, `herald:*`.
- **core/platform**
  - `router`: `go`, `back`, `stepBack`, history arming, trail, parents, `onEnter/onLeave` per route kind (`home`, `ws`, `p:`, `t:`, `c:`, `chats`, `artifacts`).
  - `actions` (delegated `data-action` registry), `keys` (commands + bindings, already keys.js), `notices` (herald), `announce`.
- **core/ui**
  - `layers`: one stack used by Escape, phone Back, inert, Tab trap, gestures and swipe-close.
  - `patch`/`redraw`, theme, sound, icons.
- **core/services**
  - world selectors, thread state, conversation addressing, drafts, outbox (optimistic rows, alias, retry, client ids), stops (commit-window jobs + receipts), shape.
- **shell**
  - sidebar, header, panel host (stage), dock stack, page host, phone layout, favicon and title.
- **modules/***: as in §2.8.

### 3.2 Places (slots) this domain needs

| Place | Kind | Scope | Registered by (today's code) |
|---|---|---|---|
| `page` (route kind → page) | keyed | app | home (`home`), artifacts (`artifacts`), conversation (`ws`,`p:`,`t:`), chats (`chats`,`c:`) |
| `sidebar.entry` | list, ordered by the shape `layout.side` | app | home, conversation(ws), chats, artifacts, settings pages (runtimes, routing, rules, worktrees, keys), later apps |
| `sidebar.section` | list | app | projects (filter + rows) |
| `sidebar.action` / `sidebar.foot` | list | app | create-project (+ New), shells toggle, theme, settings |
| `header.title` | keyed by route kind | conversation | projects (icon picker + name), threads (title/label edit, badge), chats, conversation(ws counts) |
| `header.badge` | list | conversation | runtimes (`rtTag`), decisions (`hostNeedHtml`) |
| `header.action` | list, priority-ordered | conversation | threads (Threads control, Resolve, ⋯), launchpad (Deploy), stage (panel toggle) |
| `thread.menu` | list of groups | thread | threads (prev/next, rename, label, delete), shells (open shell), runtimes (continue elsewhere), stops (Stop) |
| `thread.head` | list | thread | threads (checklist), runs (sub-agents strip) |
| `conversation.block` | keyed by row kind | conversation | conversation (you/them/day/hist/note/event/system), threads (card, control), runtimes (limit, move), intel (rec), decisions (dec events), projects (start), artifacts (since) |
| `conversation.source` | list | conversation | contributors of rows to `messagesOf`: decisions (decisions/notSent), threads (done/failed lines), hops, turns, relays |
| `conversation.empty` | priority-chain | conversation | projects (starts), conversation (notes) |
| `conversation.typing` | priority-chain | conversation | held (runtimes), coordinator replying, WS ask, chats working, thread working |
| `dock.card` | priority-chain | conversation | chats (send-now confirm) > decisions (docked card / folded line) |
| `composer.target` | priority-chain | conversation | chats (chat target), send gate (paused), projects (@ target), threads (`threadTargetHtml`), default coordinator |
| `composer.tool` | list | conversation | attachments (paperclip), intel (chip), chats (send now) |
| `composer.attachment` | list | conversation | attachments tray, files (line-ref capsule `#cref`) |
| `composer.mention` | single | app | projects (@ list) |
| `panel.page` | keyed | conversation | threads ("thread"), files ("files"), shells ("shell"), later apps |
| `panel.frame` | list, ordered by shape `xo:panel/*` | conversation | threads, changes, map, launchpad |
| `home.block` | list, ordered by shape `xo:home/*` | app | home (head, next, then, end), artifacts (since, made) |
| `settings.section` | list (tab order) | app | conversation (General: bubbles, webpics), threads (hops), shape, routing, runtimes, rules, worktrees, sounds, keys |
| `jump.item` / `jump.action` | list | app | core places, projects, threads, artifacts (`REC.jumpItems`), create, settings, keys, theme, intel, stage |
| `command` (key-bound) | keyed | app | shells, jump, intel, write, keys, map, sideFold, treeFold, quickOpen, findInFiles, decision keys |
| `layer` | stack | app | jump, keys, all, runs, quickopen, settings, drawer, iq, chat setup, lightbox, create, viewer/files page, decisions panel |
| `notice.rule` | list | app | event → herald mappings (l.485–503), pings (l.508) |

### 3.3 Public API the hub currently provides (what the kernel/services must expose)
These names are passed as callbacks today:
- `go(view, {panel, focus, carry, from})`, `back()`, `schedule()` (becomes `invalidate()`)
- `announce(text, still)`, `heraldShow(h, ms)`, `heraldFor(mid, make, ms)`, `heraldDrop(mid)`
- `PROJ(id)`, `isBusy(t)`, `isHeld(t)`, `threadState(t, needs)`, `threadMark(t)`, `projectIcon(pid)`
- `placeRegion()` (focus fallback), `syncInert()` (becomes `layers.sync`), `setDrawer(open)`, `view()` (becomes `router.current`)
- `openFromPanel(v, e)`, `panelThreads(v)`, `panelShell(on, host)`
- composer: `putBack(text)`, `composeAbout`, `askAboutFile`, `askAboutLines`
- `resolveFromRow`, `whenWorld`

### 3.4 Risks in the move (subtle behaviour, easy to lose)

- **Focus handoffs everywhere**, all graded by testers:
  - `patch()` refocuses by data-fid/id/data-* (l.629–641)
  - `dockSwap` (l.1725), `S.focusNext` resolved after render (l.2893)
  - `heraldBack` (l.2025), `recUndoLeaves` (l.2041), `closeRuns` return chain (l.1625–1628)
  - `closeSettings` takes (l.2266), `focusOverlay` waiting for a closing `<dialog>` (l.4039–4043)
  - `go()` opener memory and return pill (l.3116–3184)
  - Any per-module rewrite must keep "focus is never on BODY".
- **The press-survives-redraw rule:**
  - Regions are redrawn in place (`redraw` + `_h` caches) so a click whose pressed node is replaced isn't dropped (comment l.623–628; the latest merge on this branch is exactly this fix).
  - A component framework that re-creates nodes would regress it.
- **Message model ordering** (`messagesOf` l.1036–1052):
  - Stored rows are sorted by `seq`, the rest by time, then stably merged.
  - Event lines are gated by the loaded history (`since`, l.934) and by the page floor (l.1040–1042) to avoid scroll jumps.
  - Echo merge: optimistic rows are kept once via `S.alias` (l.874–880).
  - Turn segmentation keeps the running turn's key `turn:<id>` stable (l.957–978).
- **Scroll anchoring:**
  - `readingPlace`/`holdPlace` run twice (sync and microtask after msgx decoration, l.2975).
  - `workMotion` glides only on screen.
  - The conversation opens at the latest but does not re-pin on first fill (l.2961–2982).
  - See memory: follow.js owns scroll.
- **Undo windows are real time:**
  - `hold()` not `wait()` under reduced motion (l.1839–1843).
  - `Kit.COMMIT_MS` stop windows with turn-token checks (l.2444–2469).
  - Undo past `undoUntil` is a no-op (l.3575).
  - Read guard of 300 ms on Home cards (`NEXT_SEEN`, l.750–752, 834).
- **Honest receipts:** `stopReceipt` distinguishes the endpoint types (l.1640–1649); `run_not_live` and 501 wording (l.1678–1681).
- **IME guards:** `isComposing || keyCode===229` early returns in every key handler (l.2090, 2374, 3518, 3703, 3936, 4050, 4574). They are easy to drop when splitting handlers.
- **Escape order and phone Back order** (l.4585–4599, 4631–4655): which layer closes first is product behaviour.
- **Global key rule:** ⌘/Ctrl keys work while typing; non-modifier globals don't (l.4580–4606). Shells own all keys except their toggle (l.4576).
- **Send gate:** `blockFor` must be asked with the **message's** destination, not the composer's draft (l.2533–2539, 2667, 3402).
- **Pre-paint flags:** theme and bubbles must be set before the first paint (index.html l.8, 11), and skeleton.js must run before app.js (l.289) so Home doesn't shift.
- **msgx.js double entry:** it self-decorates the main chat on import (msgx.js l.906). The thread page decorates its own (l.2735). Moving msgx without keeping the main-chat call loses the bubbles and back-to-latest behaviour.
- **Shape-driven visibility:** about 10 shape keys gate surfaces (§2.4). `shapeApply` fans out to SV, turnview work mode, toggles, hop reloads, shells and stage (l.4200–4210); each must become a subscriber.
- **Legacy storage migration:** `xo-side-bar` and `xo-side-pins` move into the shape once (l.4407–4413); `cv-hops` was already folded (comment l.140). Drafts live under `cv-drafts:live`.
- **Unreachable All-threads sheet and the broken thread-page ⋯** (§2.7 #9). Decide explicitly whether they are ported, removed or fixed. Don't carry them silently.
