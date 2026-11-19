# The conversation's single-instance code: the map for P1 (conversation.js)

The line numbers are against a9040c25. This map comes from a read-only research pass. It's the plan's working notes for turning the one conversation into instances: the main chat in `#conv`, and a thread page in the panel (`STAGE.page("thread")`).

## Easy to make an instance
- **The message list.** `messagesOf(conv)` (857) and `msgItems(conv, needs)` (1164) already take `conv`. Two of their helpers read `S.view` instead:
  - `queuedMeta` (1084: `conv === S.view ? running() : null`);
  - `fileRoute` (3152-3156).
- **The draw pipeline.** It only closes over the `msgsEl` and `scroller` constants (2687):
  - `reconcile(msgsEl, …)` (ui.js:272, generic; it fires `redrawn`, which msgx.js:589 listens to);
  - `hydrateMedia` (media.js:546, root-parameterised);
  - `readingPlace` / `holdPlace` (2838-2854);
  - `foldsBefore` / `workMotion` (2856-2914, plus `S.tbToggled`);
  - `ensureRoot` (3059);
  - `loadAhead` / `loadOlderNow` (2802 / 2817);
  - `showMsg` (3094), `returnPill` (2994), and `openMedia`'s root (3136).
- **`render()` state:** `rendered` (2690), `S.filled` (2728).
- **follow.js** (~120 lines). Its module state is `pinned`, `lastTop`, `place`, `at`, `width` and `held`. It looks up `#scroller` (`sc()`), `#msgs`, `#dock` and `#column`.
  - **Exports and their callers:**
    - `fromLatest`: msgx 813/840/870;
    - `fromTop`: app 2804/2919;
    - `isPinned`: 2734;
    - `toLatest`: app 2574/2577/2744, msgx 424/856;
    - `unpin`: 3442/3518;
    - `toRow`: 3012/3099;
    - `initFollow`: 2935 (pinned by tests/layout-reads).

## Hard, and why
1. **The composer.** One `say` (2095), used at about 40 sites.
   - Document-level listeners: the drop veil (2212-2226), `GLOBAL.write` (4415), and `gestures A.say` (355-359).
   - Focus strings `"#say"` (225, 2043, 2220, 2735, 3412, 3458, 4081).
   - msgx's reply chip goes into `#composer` (606-665).
   - The send path reads `S.view`:
     - `send` 2634, `sendLive` 2546-2581, `postLive` 2606, `running` 2234;
     - `liveBlock` 2518, `composerDest` 2540, `filesHere` 2107, `sendRender` 2246;
     - `updateComposer` 2290-2323, `trayRender` 2129;
     - `lrefRender` 3231, `chatTargetRender` 2263, `targetLineRender` 2276;
     - drafts 2354-2355 (`S.drafts[view]`).
2. **The document click delegation** (3376-3550) dispatches on `S.view`:
   - `[data-chc]`, `[data-run-call]`, `#thead` runs, `[data-tb]` → `unpin`;
   - `[data-tmove]`, `[data-ck]`, `[data-lref-x]`, `.tb-cf` → `CHG.forTarget(S.view)`;
   - `[data-older]`, `[data-start]`, `[data-interrupt]`, `[data-edit]`, `[data-mx]`.
3. **msgx.js** is all module-level.
   - Its singletons: `conv` (29), `msgs` (32), `scroller` (724), `composer` (606), `tdock` / `herald` (818).
   - It reads `#app[data-view|data-conv]` (171, 304, 618, 645).
   - Maps keyed by `data-k`: `ROWS` (211), `WORKING` / `FINISHED_CARDS` / `ENDED` / `HOLD` (318-326). A thread's root key is the same in the project timeline, so two instances collide.
   - Its sheets `#mx-hold` / `#mx-order` use `#msgs>[data-k]` (327-341).
   - It makes one reply chip, one `.mx-down` (808-811) and one `qpop` (698).
4. **The dock.**
   - `TD` (1743), `dockRender` (1799-1878), `fitDock` / `dockEdges`, `dockRO` (1797), and listeners (1798, 1879-1892).
   - `go()` resets it (2973).
   - gestures drag `#tdock` (285-306), and msgx observes it (818-884).
   - `has-tdock` / `has-tdock-card` sit on `#app`.
5. **The herald and dock room.** `--dock-h` (2926-2934) and `--herald-room` (2033-2039) are on `#app`, and `connLine` follows the main composer. Keep the herald app-level.
6. **CSS.** `#msgs` ×42 (msgx.css, rich.css), `#typing` ×4, `#composer` / `#say`, `#target` / `#dock` / `#conv` (fileview.css), `#top` (phone.css), `#top-end` (launchpad.css). There are also `.app[data-view=…]` rules.
7. **storm.js** watches one thread: `watched.thread` (76, 1122-1123).
   - Turn pruning keeps only its session (897-905).
   - Hop notes are read only for it (764).
   - It reloads after a reset (865-866).
   - The "on screen" checks against `S.view` are at app 483, 509, 2052 and 2606.
8. **The header.** These ids are fixed: `#conv-title`, `#tw-edit`, `#ck-list`, `lim-h-*`, `tdel-q`. `topRender` (1379-1465) also draws the main-only chrome: LP, STAGE button, chead, crail, since.
9. **Tests.** 28 unit tests read app.js source text. The browser suites use the ids.

## State
- **Per conversation, and a singleton today:**
  - `S.view` (main), `rendered`, `S.filled`, `S.tbToggled`;
  - `S.heldT` / `S.askT` (typing), `S.ckFresh`;
  - `TD`, `scrollRaf`, `trayRaf`, `updateComposer.dk`, `atList._sel`;
  - follow.js state, and msgx's `reply` / `unseen` / `g` / `touch`.
- **Keyed already, so safe to share:**
  - `S.drafts[view]`, `S.local[conv]`, `S.lref[conv]`, the tray;
  - `S.dockFold[askKey]`, `S.ckOpen[tid]`, `S.ckSeen[tid]`, `S.tbOpen[block]`;
  - `S.alias`, `S.stops`, `S.desc`.
- **Main navigation only:** `S.parent`, `S.opener`, `S.trail`, `S.retrace`, `S.scroll`.

## The extraction order (each step leaves the app working)
1. **CSS ids → classes.**
   - `#msgs` → `.msgs`, `#typing` → `.typing-slot` (msgx.css, rich.css).
   - Dock and herald room variables and `has-tdock` go on the conversation's host, not `#app`.
2. **follow.js → `createFollow({scroller, column, msgs, dock})`.** The old exports stay, as the main instance.
3. **Conv explicit everywhere:**
   - `queuedMeta(conv, run)`, `fileRoute(path, conv)`;
   - `running(view)`, `liveBlock(view, text)`, `composerDest(view, text)`, `filesHere(view)`.
4. **js/conversation.js: the draw members as one instance over the existing ids.** `render()` calls `MAIN.draw(needs)`.
5. **msgx.js → `decorateConversation(inst)`.** Per-instance maps, sheets scoped by host, and one chip and one down button per host. Collision-proof `ROWS`.
6. **`createComposer(inst)`.**
   - It takes the send path, drafts, tray rendering, lref and target.
   - `activeComposer()` serves write, the drop veil and `heraldBack`.
   - Focus strings become functions.
7. **The dock → per instance:** `TD`, `dockRO`, the listeners, and a gestures hook.
8. **Click delegation → `instanceOf(e.target)`.**
9. **storm.js → `watchThreads(set)`.** Prune the union. The "on screen" checks ask every instance.
10. **The header → `threadHead(t, els)`,** without fixed ids. The main chrome stays in `topRender`.
11. **The panel:** `STAGE.page("thread", {mount: (host, key) => createConversation({host, view: "t:" + key}), onShow, onHide, unmount, canClose})`, and routing in `go()`.
