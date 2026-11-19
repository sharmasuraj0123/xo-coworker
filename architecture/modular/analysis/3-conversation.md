# 3 · Conversation and decisions domain: analysis

Snapshot: /tmp/xo-6c73139 (release/2026-11-19 @ 6c73139). Every file in scope was read in full; app.js was read where it holds this domain's code: conversations (850–1300), the dock (1710–1875), typing (1876–1960), the composer (2027–2700), the Thread page and render/drawConv (2700–3260), and clicks (3533–3725).
Line numbers are the snapshot's.

---

## 0. The new "conversation instance" API (seed of `modules/conversation`)

Today (19 Nov, P1/P2 of the threads-panel work) the chat stopped being one page-wide singleton. A conversation is now made of **five per-instance parts**. Three live in app.js and two in their own modules:

| Part | Where | Factory | Main instance | Thread-page instance |
|---|---|---|---|---|
| Follower (scroll owner) | js/follow.js:27 | `createFollow(els)` | `MAIN` follow.js:143, built at module load; legacy wrappers follow.js:144–150; `initFollow()` is called at app.js:3090 | `TP.follow = createFollow(els)` app.js:2720, `.init()` 2721, `.destroy()` in tpUnmount 2756 |
| Conversation record | app.js:2826 | `createConv({...})` | `MAIN` app.js:2829 | `TP.C` app.js:2722 |
| Drawing | app.js:2959 | `drawConv(C, needs)` | called by `render()` 2867 | called by `drawThreadPage()` 2802, from `render()` 2873 |
| Decoration (msgx layer) | js/msgx.js:36 | `decorateConversation(E)` | self-called at module eval, msgx.js:906–912 | app.js:2735 |
| Composer | app.js:2084 / 2723 | object literal (`MK`, `TP.K`), plus `wireComposer(K)` 2087 and `wireTray(K)` 2174 | `MK` 2084 (wired by bespoke main-only code 2368–2435) | `TP.K` 2723 |
| Docked decision | app.js:1718 | `createDock({el, view, region, TD})` | `MDOCK` 1872 (`TD`, `dockRender` aliases 1873–1874) | `TP.dock` 2727 |

### 0.1 `createFollow(els)` (follow.js:27–140), exactly

- **Input** `els`: `{ scroller, column, msgs, dock }`. Each value is an element or a zero-arg function returning one, and is read lazily through `get(k)` (line 28). The main instance passes functions over `#scroller #column #msgs #dock`.
- **Returns** `{ fromLatest, fromTop, isPinned, toLatest, unpin, toRow, init, destroy }`:
  - `fromLatest()`: px from the bottom, `max(0, scrollHeight - clientHeight - scrollTop)` (35).
  - `fromTop()`: `max(0, scrollTop)` (36).
  - `isPinned()`: the boolean `pinned` (37).
  - `toLatest(smooth=false)`: sets `pinned=true` and scrolls to `scrollHeight`, smooth only when asked and reduced motion is off (39–43).
  - `unpin(row?)`: sets `pinned=false`. It walks up from `row` to the direct child of `msgs` that carries `data-k` (49–51). If one is found it becomes the *held* row (`held=true`, `place={k,y}`). Otherwise `notePlace()` records the centre row (47–55).
  - `toRow(el, smooth=false)`: unpins and clears `held`. It centres `el` in the part of the scroller not covered by `dock`, scrolling **only this scroller** and never using `scrollIntoView`. It glides only when the distance is ≤ 1.5 viewports, otherwise it jumps (61–73).
  - `init()`: attaches a passive `scroll` listener (108–125) and one `ResizeObserver` on `column` and `scroller` (128–135).
  - `destroy()`: disconnects the RO and removes the scroll listener (138).
- **Private state**: `pinned`, `lastTop`, `place {k,y}`, `at` (cached index of the centre row), `width` (the column width the RO saw last), `held`, `ro`, `onScroll`. `seenW` is local to init (105).
- **The main instance's quirk**: app.js's `MAIN` conv does **not** hold the follow.js `MAIN` object. It holds an object literal of the module-level wrappers (app.js:2830): `{ toLatest, unpin, isPinned, fromTop, toRow, fromLatest }`. That object has no `init` or `destroy`. Code that calls `C.follow.destroy()` must not assume the method exists on MAIN.
- Test: tests/follow-instance.test.mjs (it checks two independent instances, `destroy` removing the listener, and the legacy exports).

### 0.2 `createConv({ view, msgs, scroller, column, typing, follow, main=false })` (app.js:2826–2828)

Returns a plain record:
`{ get view() /* calls view() if it is a function */, msgs, scroller, column, typing, follow, main, rendered: null, filled: null }`.
- `rendered`: the view key last *opened* in this conversation. It sets `opening = C.rendered !== v` (2961). `loadAhead` reads it, and it also gates the gallery and loadAhead (2929).
- `filled`: the view key whose live data has arrived (`liveReady`). The first real fill draws quietly (2964–2966). When `C.main` is set, it is mirrored to `S.filled` (2967).
- `main`: when true, `$("#say")` is the focus fallback in reconcile (2973) and `S.filled` is mirrored.
- tpShow resets `rendered`/`filled` to null when the page shows another thread (2745). That reset is what forces "opening → toLatest".

**Functions that take a `C`**: `drawConv(C, needs)` 2959, `loadAhead(C=MAIN)` 2927, `loadOlderNow(C=MAIN)` 2943, `typingRender(C=MAIN)` 1897, `readingPlace(C)` 2992, `holdPlace(C, a)` 3003, `childOf(C, k)` 3002, `foldsBefore(C, items)` 3019, `workMotion(C, folds)` 3039. Instances are routed by `convAt(el)` 3535 (`TP.box.contains(el) ? TP.C : MAIN`).

### 0.3 `drawConv(C, needs)` (app.js:2959–2983), in order

1. `opening = C.rendered !== v`; `quiet = opening`. The first fill (`liveReady(v)` and `C.filled !== v`) is also quiet (2963–2966).
2. `CHG.sync(v)`: the Changes service reads this place's changes (a side effect, 2968).
3. `items = msgItems(v, needs)`: the **app.js** item builder (1170–1297). It sets the module-global `drawing = conv` (1171) so that `fileRoute()` knows which conversation is drawing.
4. `folds = foldsBefore(C, items)` unless quiet. It measures the `[data-b]/[data-r]` heights of rows whose HTML changes.
5. `place = readingPlace(C)` when the conversation is not opening and not pinned. That is the first message row (not `hist/note/empty/day|`) whose bottom is below the scroller top.
6. `reconcile(C.msgs, items, {quiet, fallback})` (ui.js:272): keyed DOM reconcile. Rows that hold focus **or the pressed node** are redrawn in place (`redraw`), and a `redrawn` CustomEvent is fired for them.
7. `hydrateMedia(C.msgs)`: pictures load, fade in, and keep their decoded `<img>`.
8. `holdPlace(C, place)` runs **twice**: once synchronously and once in `queueMicrotask`, *after msgx's MutationObserver decoration* (2975).
9. `workMotion(C, folds)`: folds glide (WAAPI) and new steps `arrive()`. `S.tbToggled.in` picks which conversation the toggled fold belongs to (3041).
10. `ensureRoot(v)` finds a thread's root row, and `typingRender(C)` draws the typing line.
11. `if (opening) { C.rendered = v; C.follow.toLatest(false); }`: opening a conversation lands at the latest, after everything above.

### 0.4 `decorateConversation(E)` (msgx.js:36–903), exactly

`E` = `{ conv, msgs, scroller, typing, composer, say, send, atList, dock, tdock, herald, host, follow: {toLatest, fromLatest}, isThread(), view?(), onView?(fn), main? }`. Returns `{ decorate, conv, msgs }`. There is **no destroy**.
- `conv`: the box the back-to-latest button (`.mx-down`) is appended to (823).
- `msgs`: the list. Its `id` builds the CSS selector `SEL` that the order and hold style sheets use (42, 345, 351).
- `composer`: the reply chip is inserted before `.composer-field` (625). `say` and `send` are read by the quote logic (663–677).
- `atList`: Enter and Escape defer to an open @ list. Pass `null` when there is none (thread page).
- `dock`, `tdock`, `herald`: positions of the back-to-latest button (831–861) and has-tdock classes on `host` (890–896). `herald` may be null.
- `follow`: only `toLatest` and `fromLatest` are used (38).
- `isThread()`: picks the naming rules and the project-icon swap (181, 314).
- `view()`: which conversation a reply belongs to (628). Without it, the code reads `#app[data-conv]`.
- `onView(fn)`: a subscription for "another conversation now shows". The main instance instead watches `#app[data-conv]` with a MutationObserver (656–657).
- `main`: chooses the style element ids `mx-hold`/`mx-order` over `mx-hold-<msgs.id>` (337, 346).
- The thread page passes `conv: box, host: box, herald: null, atList: null, isThread: () => true, view: tpView, onView` (app.js:2735–2736).

### 0.5 Composer objects `K` (app.js:2084, 2723)

Shape: `{ main, get view(), say, send, form, target, label, conv|get conv(), tray, attach, input, note, iq }`.
- `MK` (2084): over `#say #send #composer #target #say-label #att-tray #attach #att-input #att-note #iq`. Its `conv` getter returns MAIN.
- `TP.K` (2723): over `#tsay #tsend #tpcomposer #ttarget #tsay-label #tatt-tray #tattach #tatt-input #tatt-note #tiq`. `conv: TP.C`.
- **K-aware functions**: `wireComposer` 2087 (TP only), `wireTray` 2174, `trayRender` 2129, `addFiles` 2150, `insertText` 2166, `growSay` 2230, `sendRender` 2250, `targetLineRender` 2280, `updateComposer` 2294 (`!K.main` takes a short path, 2295–2300), `syncPlaceholder` 2336, `saveDraft`/`loadDraft` 2365–2366 (`S.drafts` keyed by view → localStorage `cv-drafts:live`), `chipRender(fade, K)` 2059, `send(K)` 2645, `sendLive(raw, K)` 2557, `putBack(text, K)` 2681, `editFailed(id, K)` 2689. `composerAt(el)` 3536 routes a click to its composer.
- **Still main-only (not K-aware)**: the @ list (`atList`, `pickAt`, `atClose`, 2345–2395), the line-ref chip (`lrefRender`, `S.lref`), `chatTargetRender` and `sendNowRender` (Chats), the "held" shape on Home (2398–2411), the page-wide drop veil (2215–2229), and `connDest()` 2548. Also, `liveBlock(view, text = say.value)` 2529 and `composerDest(view, text = say.value)` 2551 **default to the main composer's text**. Every K-aware caller passes `K.say.value` explicitly, and a new caller must do the same.

### 0.6 `createDock({ el, view, region, TD })` (app.js:1718–1871)

Returns `{ render(needs), TD, el }`. It draws the conversation's docked decision card (`D.cardHtml(n,"dock")` + `D.wireCard`), its fold line, and its 3 s Undo line (with `TD.busy` and `TD.undone`). It also draws the Chats "send now" confirm (`CH.confirmHtml`). It reads the shared `S.dockFold` and `D.isOpen()`. Per instance it owns a `ResizeObserver dockRO` plus click, keydown and capture-scroll listeners on `el` and `dockGestures(el)`, and none of these are torn down. `D.onUndone` reaches **only the main** `TD.undone` (app.js:186).

### 0.7 The Thread page as a mounted conversation (app.js:2700–2816)

`STAGE.page("thread", { single, width, title, icon, mount: tpMount, onShow: tpShow, unmount: tpUnmount, canClose, escape })`, 2761. This is already the shape of a "panel.page" registration.
- `tpMount(box)` 2707: writes the page's markup, which recreates the main chat's skeleton with `t*` ids. It then creates the follower, conv, composer, and dock, wires files (paperclip and a drop scoped to `box` that calls `stopPropagation`) and the IQ chip, decorates, adds a RO that sets `--dock-h` on `box`, and adds a scroll listener that calls `loadAhead(TP.C)` once per rAF.
- `tpShow(key)` 2741: saves the old draft, resets `C.rendered`/`filled` and `TD`, calls `world.act.watchSideThread(key)` and `loadDraft`, notifies `TP.viewSubs`, and calls `render()`.
- `tpUnmount` 2754: saves the draft, `follow.destroy()`, `watchSideThread(null)`, and nulls TP. **It does not undo** the msgx decoration, the dock, or the ROs and listeners added in tpMount.
- `drawThreadPage(needs)` 2797: `tpHead`, `checklistRender(... $("#tpthead"), view, "tck-list")`, `drawConv(TP.C)`, `TP.dock.render`, then the composer.
- `openFromPanel(v, e)` 2812: inside a chat, a thread clicked in the panel opens as this page. ⌘/Ctrl-click, or Open full width, goes to the full view instead.

---

## 1. Per file

### js/follow.js (150 lines)
- **Purpose**: the only owner of a conversation's scroll position. It holds one state, pinned (at the latest) or reading, and that state is derived from the scroll position itself, never from input events or timers.
- **Exports**: `createFollow`, plus the main-instance wrappers `fromLatest`, `fromTop`, `isPinned`, `toLatest`, `unpin`, `toRow`, `initFollow`. **Imported by** app.js:36 (all of them) and msgx.js:16 (`toLatest`, `fromLatest` as main*). Tests: follow-instance, changes, focusview, layout-reads, browser flows.
- **Imports**: none.
- **Coupling**: `document.getElementById("scroller"|"column"|"msgs"|"dock")` for MAIN (143); `matchMedia(prefers-reduced-motion)`; `ResizeObserver`; a passive `scroll` listener. It has no storage, events, or timers.
- **State**: per instance, as in §0.1. One module-level `MAIN` instance is created at import.
- **Responsibilities**: (a) pinned/reading state 30–43; (b) unpin with a held row 47–55; (c) jump to a row (`toRow`) 61–73; (d) the centre-row place tracker `notePlace`/`keepPlace` 79–99; (e) the scroll classifier 108–124; (f) growth keeping and width-change place-keeping in one RO 128–135; (g) teardown 138; (h) the legacy singleton 143–150.
- **Subtle behaviours that must survive a move** (scroll anchoring has broken before with column-reverse, windowing, and content-visibility):
  1. *Only four writers* touch `scrollTop` (header 13–18): `toLatest`, pinned growth, `toRow`, and width-change `keepPlace`. Anything new that scrolls the conversation (scrollIntoView, focus without `preventScroll`, a module's own "scroll to") breaks the model. msgx's quote-jump does call `hit.scrollIntoView` (msgx.js:705), which is a fifth writer that bypasses `toRow`.
  2. A scroll event that arrives with a change of column width is ignored: `seenW` is local to the handler, deliberately separate from the RO's `width`, because the RO may already have updated in the same frame (110–115).
  3. Following re-arms only at `gap <= 2` px, never "near the bottom" (116–120; QA R1).
  4. `ours = |top - lastTop| < 1` keeps a held row held across keepPlace's own scroll (119, 123).
  5. The place tracked is the row at the **centre** of the view, not the top. Re-wrapping above it moved the text by 48–72 px (75–78).
  6. Growth is kept in a `ResizeObserver` callback, before paint (126–132). Moving it to rAF or a MutationObserver would show a frame of drift.
  7. The browser's clamp when content shrinks is never read as "reached the latest", because `gap<=2` is checked against the post-clamp position only on real scroll events and width changes are excluded.
  8. It relies on the browser's native scroll anchoring for older pages landing above. That only works if `#msgs` is in normal flow: no `column-reverse`, no `content-visibility`, no windowing.
- **Smells**: MAIN is created at import over global ids, so the module has a page side effect. The main conv in app.js wraps the module functions instead of holding the instance (§0.1).
- **Proposed home**: `modules/conversation/follow.js`, unchanged, with the instance API only. Drop the singleton wrappers: the main conversation becomes an ordinary instance created by the conversation mount.

### js/msgx.js (912 lines)
- **Purpose**: the decoration layer over the rows app.js draws: Reply and Copy, the document view's action row with Good/Bad rating, quote cards, bubble tails and naming, the agent's "working" bubble, swipes, select-to-reply, and back-to-latest. It never changes the item list.
- **Exports**: `decorateConversation`. **Imported by** app.js:37, and loaded again as a module script from index.html:291 (the same module instance). The import has a side effect: the main conversation is decorated at eval (906–912). Tests: layout-reads, words, xoicons, state-hover.
- **Imports**: ui.js (`elapsed`, `ICON`, `xi`), follow.js (main `toLatest`/`fromLatest`), util.js (`copyText`, `COPY_REFUSED`, `space`), words.js (`wordsOf`).
- **Coupling beyond imports**:
  - DOM outside its own markup: `#app[data-view]` and `[data-conv]` (181, 314, 628, 656); `#projects .prow.is-on[data-go^="p:"] .pr-ic svg`, which clones the sidebar's project icon (313); `#live` for announcements (286, 693); `document.head` gets two `<style>` elements per instance (337, 346); `document.body` gets the `.mx-qpop` button per instance (713). It reads the app's row classes and markup contract: `.m .m-you .m-them .m-turn .m-card .cont .is-live .is-relay .bubble .mb .prose .mh b .av .av-t .turn .tb-* .tcard .tc-segs .sg .elapsed[data-since] .mx-stack .tb-files .md-table .md-code pre`, `[data-k]`, `[data-go]`.
  - Root attributes: the hold and order rules apply only under `:root[data-msgx]`, which is set **only when Chat bubbles is on** (index.html:11, app.js:4169). In the default document look, the "ended turn stays in place" order and the min-height hold are therefore inert.
  - Events: listens for `redrawn` from ui.js reconcile (599). Document-level listeners: `keydown` in capture (670), `submit` in capture (677), `mouseup` (728), `keyup` (729), `selectionchange` (730). `wheel` (non-passive) and `scroll` on the scroller (731, 778, 867). `pointerdown/move/up/cancel` on msgs (792–811). `click` on msgs (679).
  - Observers: MO on `typing` (324), MO childList on `msgs` twice (593, 869), MO on `tdock` subtree (890), MO on `herald` (898), RO on `typing` (325), RO on scroller/dock/tdock/herald (885–886).
  - Timers: `setInterval(tick, 1000)` per instance (591), and `tick` walks **document-wide** `.mx-work` (582); the 2.5 s label hold (419); 1.4 s step-flash timers (304); a 220 ms line swap (448); copy acknowledgement timers.
  - Storage: localStorage `xo-msg-rating` (222–224, 284). A comment marks a future `PUT /api/chat/chats/{chat}/messages/{key}/rating` (275–277).
  - It sets `data-noswipe` on rows to tell gestures.js that a swipe on a message is not the page's back-swipe (120).
- **State (per instance)**: `ROWS` (key → action row, capped at 800/600, 221–241), `RATED`, `STEPS` (thread card progress), `WORKING`, `FINISHED_CARDS`, `ENDED`, `HOLD`, `replies` (conv → reply), `reply`, `unseen` (back-to-latest count), the swipe `g`/`touch` state, `picked`, `toHeader`, `agentNameMemo`.
- **Responsibilities (by region)**:
  1. Row reading helpers 41–73: `nameIn`, `timeIn`, `bubbleOf`, `textOf`. → conversation/decorate
  2. Quote card on sent replies 75–110. → composer/reply (render side: conversation)
  3. `decorate()` 112–209: Reply/Copy bars, swipe arrow, emoji-only rows, tails, `mx-next-cont`, who is named, coordinator violet, working rows, project marks, card steps, action rows. → conversation/decorate
  4. Action row with rating 211–288, moved in place across redraws. → conversation/actions (a `message.action` slot)
  5. Thread card step animation 290–308. → threads module (card) or conversation/decorate
  6. Project mark on the coordinator avatar 310–325. → conversation/decorate (needs a `projectIcon(pid)` service, not a sidebar DOM query)
  7. Working bubble, ended-turn ordering, height hold, and settle animation 327–590 (`working`, `settle`, `fitLine`, `sizeWork`, `tick`, `wave`). → conversation/working
  8. Redraw re-decoration and focus hand-off 593–613. → conversation/decorate
  9. Reply chip, per-conversation reply, and quote prefix on send 615–677. → composer/reply
  10. Clicks: rate, reply, copy (generation-guarded), quote jump 679–707. → conversation/actions
  11. Select-to-reply popover 709–733. → composer/reply
  12. Swipes (trackpad wheel and touch) 735–811. → conversation/gestures
  13. Back-to-latest button and unseen count 815–898. → conversation/follow-ui
- **Smells**:
  - It is a god closure of about 870 lines with **no teardown**. Each `decorateConversation` call adds document listeners, a body element, two head styles, an interval, and observers. tpMount runs on every Thread page mount (app.js:2735), so these accumulate. The second instance's head style ids (`mx-hold-tmsgs`) are duplicated on each remount.
  - `projectMarks` reads the sidebar's DOM (313), which hides a dependency on the sidebar module.
  - `tick()` scans the whole document (582) and reads its own `WORKING` map, so every instance re-ticks every bubble.
  - The quote send path rewrites `say.value` in a capture-phase keydown/submit and restores it in `setTimeout(0)` (662–669). That fragile contract with app.js's `send()` relies on `send` reading the value synchronously.
  - `scrollIntoView` in the quote jump (705) bypasses follow.js (see follow.js note 1).
  - Main and thread instances find "the view" differently (an `#app` MutationObserver vs `onView`).
- **Subtle behaviours to keep**:
  - Decoration happens in the **same task** as the redraw: MutationObserver (microtask) plus the `redrawn` event. That is how focused or pressed Reply/Copy buttons survive (121–122, 216–220). Moving it to rAF breaks focus and press continuity.
  - Everything it adds carries `data-own` so that redraw.js keeps it (redraw.js:80–82).
  - Its `holdPlace` interplay: app.js runs holdPlace again in a microtask *after* this decoration (app.js:2975).
  - The working label changes at most every 2.5 s (417–421). The bubble only grows during a turn (574).
  - An ended turn's min-height is held by a keyed CSS rule from its first frame, then eased down after one beat (384–400). Changing that to a JS height set after paint reintroduces the 16 px clamp jump at the bottom.
  - Back-to-latest counts only `.is-new` rows that land at the end, and treats more than 6 removals as a swap, not news (869–884). It reads layout at most once per frame (865–867).
  - Sideways swipes yield to vertical scroll and to elements that scroll sideways themselves (773–789). A cancelled touch never replies (811).
- **Proposed home**: split into `modules/conversation/decorate.js` (1, 3, 6, 8), `modules/conversation/working.js` (7), `modules/conversation/actions.js` (4, 10, behind a `message.action` slot so rating and Copy register as actions), `modules/conversation/gestures.js` (12), `modules/conversation/latest-button.js` (13), and `modules/composer/reply.js` (2, 9, 11). Every part must return `destroy()`.

### js/turnview.js (331 lines)
- **Purpose**: renders one storm turn (its blocks: thinking, activity, plan, shared_files, narration, text, answer) as HTML. It folds the work, shows changed-file chips, the stopped, failed, or paused line, and the avatar tile. It also splits a turn at the agent's own messages.
- **Exports**: `setWorkMode`, `turnHtml`, `turnSegments`, `segmentTurn`, `turnAv`. **Imported by** app.js:25, 64 and chats.js:13. Tests: turnview, logic, media, xoicons.
- **Imports**: world.js `esc`, fileicons.js, ui.js (`ICON`, `elapsed`), markdown.js, media.js (`mediaHtml`, `fromSharedFile`, `dedupeByMade`), comms.js.
- **Coupling**: emits the markup contract `data-tb` (fold toggle key, handled by app.js click 3599), `data-b`/`data-r` (workMotion keys), `data-call-id` (msgx row identity), `data-run-call` (opens a sub-agent, app.js:3593), `.tb-cf[data-file]` (change chip, app.js:3663), and `.elapsed[data-since]` (ticked by app.js `tickElapsed`). `console.info` for unknown_wire notices.
- **State**: module-global `WORDS` (work mode, set from the shape `xo:thread/work`, app.js:4202) and `wireSeen`.
- **Responsibilities**: row and block HTML 24–108; work fold 110–201; plain-words summary 115–133; changed chips 146–162; wire-notice filter 203–216; after-silence cut 218–228; stopped line 230–238; `turnHtml` 247–277; segmentation 279–320; avatar 322–331.
- **Smells**: `WORDS` is a hidden global, so it cannot differ per mounted conversation. The `is-said` class is computed by regex on its own output in app.js (1252).
- **Proposed home**: `modules/conversation/blocks/turn.js`. Each block type becomes a renderer in a keyed `conversation.block` slot (thinking, activity, plan, shared_files, narration, text, answer), so third parties can render new block types. Work mode becomes an option passed per render.

### js/blocks.js (241 lines)
- **Purpose**: a pure store that applies storm turn and block frames (turn.started/finished/stopped, session, block.started/updated/finished, snapshot) according to the 7 client rules. It also prunes.
- **Exports**: `createTurns`. **Imported by** storm.js:14 only (consumers reach it through `world.state.turns`: `list`, `blocksOf`, `running`, `get`). Tests: turnview, storm, paging, changes, map.
- **Imports**: none. It has no DOM and no network.
- **State**: `turns` Map and `seen` (newest seq).
- **Subtle behaviours**: a block keeps the seq of its **first** frame (the basis of turnSegments). A finished turn is never reopened by older frames met during paging (127–132). A row patch *replaces* the row except for its output (17–29). Live output is kept when the final form has none (164–168).
- **Proposed home**: `core/services/world/turns.js`. It is world data, not view code.

### js/chats.js (452 lines)
- **Purpose**: the Chats feature: plain one-agent chats outside the coordinators. It covers the list, one chat's items (your prompts and storm turns), the header, the target line, the new-chat setup popover, sending (with send_while_running and the "send now" interrupt with its would_stop_runs confirmation), retry, and edit.
- **Exports**: `createChats`. **Imported by** app.js:35 (`CH`, created at 202–213).
- **Imports**: api.js (`api`, `clientId`, `NEWEST`), world.js, util.js, ui.js, markdown.js, turnview.js, timeline.js (`cliName`, `mainRuntime`, `chatOrder`, `BUSY_STATES`, `heldShort`, `heldBadge`), redraw.js, keynav.js, pending.js.
- **Coupling**: DOM `#cs-pop` (the setup popover, 269–331), `#conv-title` inside its header HTML, and the `<xo-select>` element. localStorage `cv-chat-prefs`. API: `api.sessions({role:"plain"})`, `api.session`, `api.observedMessages`, `api.models`, `api.prompt`. world: `world.subscribe` (141), `world.onEvent("now_became_add")` (421), and `world.act.sentAt/noteSession/sessionHeld/onTurn/sessionBusy/takeTrimmed/loadTurns/agentHeld`. It **writes** `world.state.sessions[...]` directly (377), which bypasses the store. Reads `world.ui.tbOpen` (178; app.js:214 puts the app's `S.tbOpen` there). Markup hooks: `data-go="c:…"`, `data-chat-retry`, `data-chat-edit`, `data-chat-stop`, `data-chc`, `data-cs`, `data-csmode`, `data-cs-done` (handled in app.js).
- **State**: `C` = list, loading, err, titles, hist, local (optimistic prompts), prefs, models, read, failed, pop, confirm, now.
- **Responsibilities**: list 46–99; history read 107–155; items 156–184; header 185–193; setup/catalog 196–339; send/deliver/confirm 341–425; public API 427–451.
- **Smells**: `view()` is always `S.view`, so a chat cannot be mounted in the panel. It mutates world state directly (377). It reaches into the app's state through `world.ui`. Its items are a parallel item builder to app.js's `msgItemsOf`.
- **Proposed home**: `modules/chats/` (it registers a `conversation.source` for `c:` and `chats` views, its own composer target-line provider, and a `sidebar.entry`). Its rendering of turns reuses `modules/conversation/blocks`.

### js/timeline.js (816 lines)
- **Purpose**: pure helpers between storm rows and the UI's shapes: message normalising, paging, busy/held/state rules, asks, routing and connection lines, target parsing, hops, relays, forwards, file routes, and stop words. It has no DOM and no fetch.
- **Exports** (by group): *rows*: `uiMsg`, `addReaction`, `updateMessage`, `reactionGroups`, `mergeRows`. *paging*: `pageAfter`, `canPageOlder`, `pageFloor`, `inPage`, `framesShort`. *conversation*: `waitsForTurn`, `echoes`, `threadAnchors`, `chatOrder`, `hopLine`, `hopNotes`, `relayedInto`, `forwardOrigin`, `sharedFileRoute`. *text*: `plainText`, `askText`. *state*: `threadState`, `BUSY_STATES`, `HELD_STATE`, `runWorks`, `readSub`, `sessionRead`, `statusLater`, `queuedButWorking`, `sessionBusy`, `HELD_FOR`, `heldOf`, `heldClock`, `heldWords`, `heldBadge`, `heldShort`, `soonestHeld`, `askingState`, `stormAsks`, `stopOf`, `stopWords`. *composer and connection*: `parseTarget`, `stripTarget`, `cliName`, `mainRuntime`, `sendErrorTitle`, `currentPools`, `routingOf`, `connLine`, `sendBlock`. *util*: `mapLimit`.
- **Imported by**: app.js:24, storm.js:16, chats.js:14, intel.js:21 (`mainRuntime`), map.js:24 (`heldWords`), recordview.js:31 (`sharedFileRoute`). Tests: logic, storm, paging, busy, conn-line, routing-truth, runtimes, attach, media, stopped-on-purpose, chat-read-order.
- **Imports**: attach.js `attachmentsOf`, runtimes.js `clockWords`.
- **Coupling**: none at runtime. The status vocabulary mirrors xo-space (thread_status.py, delivery.py) in comments.
- **Smells**: a grab-bag that spans world normalisation, view helpers, and composer gating. `cliName` and `mainRuntime` duplicate runtimes.js naming (`rtName`), with different words ("Claude" vs "Claude Code").
- **Proposed home**, split: `core/services/world/normalise.js` (rows, paging, busy/held/state, asks, stop, `currentPools`, `routingOf`); `modules/conversation/model.js` (`echoes`, `threadAnchors`, `waitsForTurn`, `hopLine`, `hopNotes`, `relayedInto`, `forwardOrigin`, `sharedFileRoute`, `reactionGroups`); `modules/chats/order.js` (`chatOrder`); `modules/composer/gate.js` (`parseTarget`, `stripTarget`, `sendBlock`, `connLine`, `sendErrorTitle`); `core/platform/util` (`mapLimit`, `plainText`, `askText`); held words to `core/platform/words` (or a shared "runtime words" service together with runtimes.js).

### js/markdown.js (519 lines)
- **Purpose**: a safe, escape-first Markdown renderer for messages: inline, blocks, tables, fences with highlight, math and diagram placeholders, ```chart, web and folder pictures, and link capsules (thread, file, outbound). It also provides an excerpt helper and a thread-link scan.
- **Exports**: `ARROW_OUT`, `shortUrl`, `outText`, `setThreadInfo`, `setRich`, `webImageUrl`, `fileImagePath`, `imageLine`, `setWebImages`, `renderInline`, `cells`, `renderMarkdown`, `excerptMarkdown`, `threadLinks`. **Imported by** app.js, turnview, chats, decide, runsview, media (`ARROW_OUT`, `outText`), lightbox (`ARROW_OUT`), mdlive (`renderMarkdown`, `renderInline`, `cells`), settings, map (`renderInline`), rich (`setRich`). Tests: logic, media, rich-markdown, xoicons.
- **Imports**: icon.js `xi`, util.js `esc`, highlight.js, fileicons.js, chart.js.
- **Coupling**: emits `data-thread` (app.js:3543 opens it), `data-file`/`data-file-name` (app.js:3681 opens it in the viewer), `data-copy` (app.js:3688), `.md-math[data-tex]`, `.md-diagram`, `.md-table`.
- **State**: three module-level hooks: `threadInfo` (set at app.js:382), `rich` (set by rich.js:41), and `webImages` (set at app.js:87; it reads the shape `xo:conversation/webpics` and `fileRoute`, and so the module-global `drawing`).
- **Smells**: renderer configuration is global through set* hooks, so all mounted conversations and Files' mdlive share one config. Picture routing depends on app.js's `drawing` global being set during `msgItems`.
- **Proposed home**: `core/ui/markdown/` (renderer, pure). Turn the hooks into an explicit `renderMarkdown(src, ctx)` context ({threadInfo, rich, images, route}), so a conversation mounted elsewhere passes its own route.

### js/rich.js (281 lines)
- **Purpose**: draws math (KaTeX) and Mermaid diagrams into the placeholders markdown.js writes. Work happens only after 600 ms with no input, in 8 ms slices. Results are cached by source (and theme) so redraws are identical. It also provides the chart hover crosshair.
- **Exports**: `cachedMath`, `cachedDiagram`, `drawMath`, `drawDiagram`, `startRich`. **Imported by** app.js:29 (`startRich`, called at app.js:94) and mdlive.js:15 (`drawMath`, `drawDiagram`). Tests: rich-markdown, mdlive.
- **Imports**: markdown.js `setRich`, which it calls at import (41).
- **Coupling**: document-level capture listeners for keydown, pointerdown, wheel, touchstart, and compositionupdate (45). A body-wide `MutationObserver` with subtree (275). A `data-theme` observer on `<html>` (277). `pointermove`/`pointerout` on document (278–279). It injects `<link>`/`<script>` for `js/vendor/katex/` and dynamically imports `js/vendor/mermaid/mermaid.esm.min.mjs`. It reads CSS tokens `--ink --ink-2 --ink-3 --line-strong --fill-1 --fill-2 --canvas`. It removes Mermaid's scratch box `#d<id>`.
- **State**: `MATH`, `DIAGRAMS`, `FAILED` (capped), `INFLIGHT`, the serial Mermaid `queue`, `lastInput`, `running`/`again`, `started`.
- **Subtle**: the cache read through `setRich` is what makes a streamed message redraw to the *same* HTML. Without it, every chunk would flicker back to source and redraw.js would see changes. It never draws while typing (see memory "page is never idle").
- **Proposed home**: `core/ui/markdown/rich.js` (a page service, started once by the kernel). The chart hover moves with chart.js.

### js/chart.js (176 lines)
- **Purpose**: turns a ```chart JSON spec into HTML+SVG synchronously, deterministically, and safely, including a screen-reader data table that the hover reads.
- **Exports**: `readChart`, `niceTicks`, `fmt`, `chartHtml`. **Imported by** markdown.js:36. Test: rich-markdown.
- **Imports**: util.js `esc`. **Coupling**: CSS roles `--viz-1..8` and the `.mc-*` classes (css/rich.css). **State**: none.
- **Proposed home**: `core/ui/markdown/chart.js` (or `core/ui/viz`), together with its hover from rich.js:236–265.

### js/highlight.js (149 lines)
- **Purpose**: a small sticky-regex tokenizer that colours code (js, py, sh, json, yaml, html, css, sql, md, diff). Its output is escaped and only spans are added.
- **Exports**: `langOf`, `highlight`. **Imported by** markdown.js:34 and decide.js:23. Test: logic.
- **Imports**: util.js `esc`. **Coupling**: classes `tk-*` themed by `--code-*`. **State**: none.
- **Proposed home**: `core/ui/markdown/highlight.js`.

### js/media.js (609 lines)
- **Purpose**: every picture or file a message or turn carries. It provides the pure layout (fit, album, names), item adapters, HTML, and a browser part: lazy loading, a blob cache, keeping decoded pixels across redraws, the slow and failed states, a web picture that fails becoming a link, tone detection for hover veils, and drag-out.
- **Exports**: `LIMITS`, `TINY`, `LONG`, `BANNER`, `GAP`, `MAX_TILES`, `FRAME`, `dim`, `safeTint`, `fitImage`, `albumLayout`, `madeIds`, `dedupeByMade`, `TAIL`, `splitExt`, `midName`, `midNameHtml`, `labelOf`, `isPicture`, `mediaItemOf`, `mediaItem`, `fromWebImage`, `webLinkHtml`, `webGone`, `markWebGone`, `webImagesHtml`, `fromAttachment`, `fromSharedFile`, `viewerFile`, `mediaHtml`, `cachedSrc`, `loadSrc`, `PICTURE_FACE`, `pictureTone`, `hydrateMedia`, `retryMedia`, `galleryOf`, `slotOf`, `wireDragOut`. **Imported by** app.js:27, turnview.js:12, lightbox.js:26, recordview.js:33 (`midName`, `midNameHtml`). Tests: media, reduced-motion, press-reach, flows.
- **Imports**: util.js, fileicons.js, ui.js `ICON`, api.js (`api.projectImage`, `attachmentUrl`), attach.js (`fmtSize`, `typeWord`, `titleOf`), motion.js, markdown.js (`ARROW_OUT`, `outText`).
- **Coupling**: document-level listeners `error` in capture (486) and `pointerover` in capture (517), both registered at import. It finds `.closest(".scroller")` for an IntersectionObserver root per scroller (399). `settle` reads `.scroller, .home, .arts`. `document.querySelector(img[src=...])` during eviction. API: `/api/xo-projects/<p>/image` via `api.projectImage`, and attachment URLs. Markup hooks: `data-mx` (click → app.js `openMedia` 3657), `data-mx-img`, `data-mx-keys`, `data-mx-web`, `data-tone`.
- **State**: module-global `REG` (key → item; **never pruned**), `blobs` (LRU 200, URLs revoked), `shown` (LRU 200 decoded imgs), `watchers` (per scroller), `gone` (failed web URLs), `TONE`.
- **Subtle**: the box size is reserved before pixels arrive (w/h/tint from the server, else a fixed 16:10 frame), so the conversation never jumps. `settle()` changes height only when the picture is not above the reader (434–437). A redraw moves the old decoded `<img>` into the new slot (555–557). hydrateMedia must run right after every reconcile.
- **Smells**: `REG` grows unbounded. The import-time document listeners are a hidden side effect. The `REG` key namespace is shared page-wide (fine for one gallery, but `galleryOf` depends on it).
- **Proposed home**: `modules/conversation/media/` (layout, items, html, hydrate). The pure layout could live in `core/ui/media`, since recordview (artifacts) and markdown pictures also use it. `wireDragOut` must be wired per mounted conversation (today it is only `#msgs`, app.js:259).

### js/lightbox.js (384 lines)
- **Purpose**: a picture opens over the page, grows from its slot, steps through the conversation's pictures with ←→ and swipes, closes back into its slot, and offers Open in Files, Download, and Open original. It traps focus and supports reduced motion.
- **Exports**: `createLightbox`. **Imported by** app.js:30 (`LB`, 258). Tests: xoicons, flows.
- **Imports**: util, markdown (`ARROW_OUT`), ui, api (`projectDownload`, `attachmentUrl`), attach, motion, media.
- **Coupling**: builds `.lbx` on `document.body` lazily. `body.lbx-open`. A window `resize` listener. Tokens `--d-move --d-in --d-out --d-hover-in --ease --r-lg --r-xs`. Keydown on its element stops propagation (the app's keys wait). app.js consults `LB.isOpen` in its Escape/back chain (4628, 4639).
- **State**: `L` (open, items, i, root, returnTo, frame, busy, drag).
- **Smells**: the gallery root is decided by the caller. app.js `openMedia` uses `msgsEl` (the main chat) unless the picture's own `.mx-stack` parent is used (3296). On the Thread page, ←→ therefore walks only that one message's pictures.
- **Proposed home**: `core/ui/lightbox.js` (a generic overlay), with the conversation passing its own gallery root.

### js/attach.js (270 lines)
- **Purpose**: files on the unsent message. It holds the pure rules (size, kind, paste-as-file, names, error words, `attachmentsOf` for stored rows) and `createTray`, which holds per-conversation upload chips.
- **Exports**: `MAX_BYTES`, `MAX_FILES`, `PASTE_CHARS`, `PASTE_LINES`, `extOf`, `fmtSize`, `refusal`, `sortFiles`, `isLargePaste`, `pasteExt`, `pasteName`, `pasteLabel`, `attachmentsOf`, `titleOf`, `picDims`, `kindOf`, `typeWord`, `uploadErrorText`, `FINAL`, `createTray`. **Imported by** app.js:51, media.js, lightbox.js, viewer.js (`kindOf`, `typeWord`), create.js (`fmtSize`), timeline.js (`attachmentsOf`). Test: attach (and logic).
- **Imports**: none. **Coupling**: none (`upload` is injected: `api.uploadAttachment`). `Blob` and `TextEncoder` only.
- **State**: in `createTray`: `trays` Map conv → chips, plus counters. **One tray is shared by all composers** (app.js:2102), keyed by view.
- **Proposed home**: `modules/composer/attachments.js` (tray and rules). Move `attachmentsOf`, `picDims`, and `titleOf` to `core/services/world/normalise.js`, and `fmtSize`/`typeWord` to `core/platform/util`.

### js/drafts.js (61 lines)
- **Purpose**: **not the composer's drafts.** These are unsaved edits to *files* (Files › Edit), kept in localStorage `xo-draft:<project>|<path>` with the index `xo-drafts` (max 20, 2 MB).
- **Exports**: `draftKey`, `getDraft`, `putDraft`, `dropDraft`. **Imported by** docs.js:22 only. Test: drafts, docs.
- **Imports**: none (the store is injected). **State**: none.
- **Note for the ledger**: the conversation composer's drafts live in **app.js** (`S.drafts`, `saveDraft`/`loadDraft` 2365–2366, localStorage `cv-drafts:live`, `DRAFTS` const app.js:110).
- **Proposed home**: `modules/files/drafts.js` (or `core/services/drafts` as a generic keyed store, with the composer drafts moved in beside it as a second namespace).

### js/decide.js (1104 lines)
- **Purpose**: the Decisions feature. It builds the needs-you list (ranked, paced), the decision card shared by the panel and the conversation's dock, the 3 s commit queue with Undo, the global decision panel (rail, count, skip, allow-all-routine, vigilance break, "That's everything"), the Undo toast, and all card keys.
- **Exports**: `riskLabel`, `createDecisions`. **Imported by** app.js:18 (`D`, created at 166–192 with callbacks `render`, `back`, `onOpenThread`, `onNotSent`, `onAllClear`, `onUndone`, `onBreak`, `onSent`). The API it returns: `needItems`, `decisions`, `notSent`, `failedNote`, `isOpen`, `current`, `open`, `close`, `sync`, `undo`, `decide`, `decideNow`, `laterNow`, `bringIn`, `cardHtml`, `wireCard`, `queued`, `pendingKey`, `cardKeys`. Tests: focus-back, stopped-on-purpose, press-keeps-node, xoicons, flows.
- **Imports**: world.js (`esc`, `WAITING`), kit.js (asks, keys, commit queue, hold button, teach sentence), keys.js, content.js, ui.js, focusview.js, markdown.js, highlight.js, review.js, api.js `clientId`, keynav.js `radioKeys`, runtimes.js, paidview.js, redraw.js.
- **Coupling**: DOM it owns but which is declared in index.html: `#panel`, `#pn-stage`, `#pn-h`, `#pn-rail`, `#pn-count`, `#pn-foot`, `#pn-x`, `#toast`, and `#card` (created in the stage). `body.panel-open`. Writes via `world.act.resolve/reply/decideItem` and `Kit.answer`. Sounds. Keyboard: `K.is(e, "allow"|"back"|"reply"|"done"|"details"|"rule"|"undo"|"open"|"allowAll"|"later"|"next"|"prev")` and digits 1–9. Timers: wait/morph sequences, `F.autoT` 1.4–2 s auto-close, and the 3 s commit window in Kit. Element ids `card-h-N`, `card-why-N`, `dt-N`, `c-note-N` come from a module counter.
- **State**: `firstSeen`, `seq`, `sentKeys`, `stoppedDone`, `log` (the decisions made, also shown in project conversations, app.js:943–944), `teach`, `noSecret`, `queue`, `F` (the panel's state), `toastItem`. It also reads the shared `later` Set and `waitSince` Map passed in from app.js.
- **Responsibilities**: needs list 56–101 (→ `core/services/needs`); failure words 103–132; commit queue wiring 134–190; panel open/close/sync/advance 192–306; deciding 308–401; card HTML 403–608 (storm items 482–541, limits 535–541); panel card swap 610–656; details expand 664–674; `wireCard` 676–866 (note, teach, scopes, question form, hold button, quiet-keys guard); vigilance 868–897; finish 899–930; rail/footer 932–994; toast 996–1015; `cardKeys` 1017–1074; panel keys 1076–1101.
- **Smells**: a god factory that owns both data (needItems, log) and two surfaces (panel and toast). The card's quiet-keys guard and the hold state are stored as expando props on the frame element (`_quiet`, `_allow`, `_n`, `_hold`, …), which is an implicit API that app.js's dock relies on (`D.cardKeys(e, card, {})`, app.js:1867). `chrome()` calls `render()` (955), which re-enters the app render.
- **Subtle**: focus always lands on the card, never on an answer (653). A refused key pauses letter keys until a deliberate reset (1035–1039). Key repeat never decides (1030). Carrying `_quiet` to the next card when an item vanishes mid-typing (619–620, 740). There is a 300 ms read-before-act guard (`Kit.READ_MS`). The decision log entries feed the project conversation's event rows.
- **Proposed home**: `modules/decisions/` split into `needs.js` (list, rank, pacing, so it can be a service other modules read), `queue.js` (commit/undo), `card.js` (cardHtml, wireCard, cardKeys: registered as the renderer for a `decision.card` slot with surfaces "panel" and "dock"), `panel.js` (a `panel.page` or overlay), and `toast.js`. The dock (app.js createDock) becomes `modules/conversation/dock.js`, which consumes `decisions.card`.

### js/review.js (153 lines)
- **Purpose**: maps storm review items to card places: the primary yes, the back/no, scopes, hold, questions, request body, effort, evidence, host, and who asked. It is pure.
- **Exports**: `VERB`, `itemParts`, `holdWords`, `questionsOf`, `itemBody`, `isNo`, `itemEffort`, `fromWords`, `evidenceOf`, `hostOf`, `askedBy`. **Imported by** decide.js, app.js (`itemParts`), kit.js (`itemBody`), storm.js (`hostOf`, `askedBy`). Tests: paid, storm.
- **Imports**: none. **State**: none.
- **Proposed home**: `modules/decisions/items.js`. `hostOf`/`askedBy` are used by storm normalisation, so they can stay importable from there or move to `core/services/world`.

### js/content.js (72 lines)
- **Purpose**: the effort labels, leverage estimate, ranking, why line, estimate line, and evidence for asks. Its suggestion stub (`suggestFor`) returns null.
- **Exports**: `EFFORT`, `effortOf`, `leverageOf`, `fmtMin`, `estLine`, `fmtAgent`, `bidOf`, `rank`, `suggestFor`, `whyLine`, `evidenceFor`. **Imported by** decide.js and app.js (`EFFORT`, `estLine`, `evidenceFor`). No tests reference it directly.
- **Imports**: kit.js. **State**: none.
- **Smells**: `suggestFor` is dead (always null), so the `n.sug` code paths in decide.js are unreachable today. `fmtMin`, `fmtAgent`, and `bidOf` are partly unused outside this file.
- **Proposed home**: `modules/decisions/rank.js`.

### js/pacing.js (67 lines)
- **Purpose**: invisible attention rules. It holds small asks, decides when an ask may ping, and runs the 25-minute vigilance cap.
- **Exports**: `SMALL_MIN`, `PING_MIN`, `createPacing`. **Imported by** app.js:19 (`P`, 165; it takes `params`, which is unused). Its methods are used by decide.js (`classify`, `bringIn`, `reviewStart/Stop/Min`, `tired`, `keepGoing`, `rested`) and app.js `pings()` (`mayPing`, 513).
- **Imports**: none. **State**: `S` (brought, pinged, review timer).
- **Proposed home**: `modules/decisions/pacing.js`.

### js/paid.js (152 lines)
- **Purpose**: the wire reader for paid-usage modes and accounts: held modes, the effective mode, account rows, the request body, and the paid item shape. It is pure.
- **Exports**: `MODES`, `MODE_NAME`, `MODE_SUB`, `DEFAULT_MODE`, `known`, `poolId`, `heldModes`, `effectiveMode`, `poolWords`, `creditsWords`, `accountRows`, `onPaid`, `paidBody`, `paidItem`. **Imported by** rtsettings.js, storm.js, paidview.js. Test: paid.
- **Imports**: runtimes.js `humanize`. **State**: none.
- **Proposed home**: `core/services/world/paid.js` (normalisation), reused by `modules/settings` (runtimes section) and `modules/decisions`.

### js/paidview.js (21 lines)
- **Purpose**: the facts block for a paid-usage question (account, used %, reset time, credits, reach).
- **Exports**: `paidHtml`. **Imported by** decide.js (card) and app.js (Home's next card).
- **Imports**: world.js `esc`, ui.js `ICON`, runtimes.js `resetWords`, paid.js `creditsWords`.
- **Proposed home**: `modules/decisions/cards/paid.js`, registered as a `decision.detail` renderer for `kind: "usage"`. The same applies to `limitHtml` (decide.js:536).

### js/runtimes.js (179 lines)
- **Purpose**: runtime naming, marks, health words, usage windows, policy (allowed, default, move targets, errors), time words (`clockWords`, `untilWords`, `resetWords`), and limit items. It is pure.
- **Exports**: `rtName`, `markOf`, `rtMark`, `windowName`, `isInstalled`, `manyRuntimes`, `findRt`, `untilWords`, `clockWords`, `resetWords`, `healthOf`, `usable`, `windowsOf`, `allowedOf`, `defaultOf`, `policyWords`, `moveTargets`, `canMove`, `policyErrors`, `errorField`, `isLimitItem`, `humanize`, `limitItem`. **Imported by** app.js, intel.js, decide.js, paid.js, paidview.js, rtsettings.js, storm.js, timeline.js (`clockWords`). Tests: runtimes, agent-marks.
- **Imports**: util.js `esc`. **State**: none.
- **Smells**: its naming duplicates timeline.js `cliName` (different words). `clockWords` is a general time formatter living in a runtime module.
- **Proposed home**: `core/services/runtimes.js` (shared by settings, intel, decisions, threads). The time words go to `core/platform/words` (time).

### js/intel.js (743 lines)
- **Purpose**: the "Intelligence" chip and popover for a conversation (Workspace, project coordinator, or thread). It chooses runtime, then model, then effort, plus routing. It has a simple Auto/Deep mode, a thread's "continue on another runtime" move, and ordered PATCHes with a record line and a 3 s Undo.
- **Exports**: `sessionOrder`, `createIntel`. **Imported by** app.js:20 (`IQ`, 193–200). Tests: lp-intel-order, lp-phone-links, xoicons, picker-keys. The API it returns: `current`, `chipHtml`, `chipTitle`, `open`, `close`, `routed`, `spawnSetup`, `set`, `setRouting` (the last four are stubs), `isOpen`, `movedHere`, `runtimeChoice`, `session`, `kindOf`, `scopeWord`.
- **Imports**: keys.js, world.js, util.js, redraw.js, pending.js `once`, ui.js, api.js (`models`, `routerModels`, `patchThread`, `patchChat`, `continueThread`), timeline.js `mainRuntime`, runtimes.js.
- **Coupling**: it owns `#iq-pop`. A **document `pointerdown`** closes the popover unless the target is inside it or `#iq` (730). The Thread page's chip is `#tiq`, so pressing `#tiq` while the popover is open closes it on pointerdown, and the click then re-opens it (app.js:2734 toggles on `IQ.isOpen`). That is a likely toggle bug for the second composer. A window `resize`. world: `world.act.coordinatorAgent/policyFor/setPolicy/refresh/fetchThread`, `world.state.router/policy/chatPolicy/runtimes`. Callbacks: `record` → app.js `recordLine` (writes a local "rec" row into `S.local[session]`), `onMoved` → `go()`.
- **State**: `P` (popover), `catalogs`, `reads`, `reading`, `movedHere`, `failed`, `asked`, `order` (the per-conversation write queue).
- **Subtle**: writes per conversation are serialised (`sessionOrder`, 36–45). Reads are generation-numbered so stale catalogs are dropped (74–82, 467–470). The picker redraws in place with keyed sections so focus is never lost (344–347). Esc steps out of a move before closing.
- **Proposed home**: `modules/intelligence/`, registered as a `composer.tool` (the chip) with its popover as an overlay. A conversation's composer instance supplies `session` and its anchor, which removes the `#iq` hard-code.

### js/comms.js (173 lines)
- **Purpose**: renders an agent's XO comms tool calls in plain words ("Sent to “X”", "Asking a question"), plus group headers, server text with comms calls, lease-busy detection, and the self-pause reason.
- **Exports**: `nameWith`, `commsTool`, `commsBusy`, `commsLine`, `commsHeader`, `commsText`, `commsPause`. **Imported by** turnview.js, storm.js, map.js, and app.js (`nameWith` at 341, whose `here()` reads `S.view`).
- **Imports**: none. **State**: the module-global `names` hooks.
- **Smells**: `names.here()` reads the main view, so a turn drawn on the Thread page names "here" from the main chat's project (it gets it right only when ctx.project is passed, which turnview never does).
- **Proposed home**: `modules/conversation/blocks/comms.js` (a words provider). This is a natural extension point: a `conversation.toolWords` keyed slot so other tool families (MCP servers, apps) can describe their calls.

### js/runsview.js (138 lines)
- **Purpose**: pure HTML for sub-agents: the strip under the checklist, the list sheet, one run's transcript view, stop-undo rows, and "said" lines.
- **Exports**: `runsStripHtml`, `runsListHtml`, `saidHtml`, `stopsHtml`, `pathHtml`, `transcriptHtml`, `runViewHtml`. **Imported by** app.js:32 only (the runs sheet controller is app.js 1484–1708: `RS`, `openRuns`, `readTranscript`, stop with Undo). Test: runs-stop-receipt.
- **Imports**: world.js, ui.js, markdown.js. **Coupling**: markup `data-runs`, `data-run`, `data-run-stop`, `data-runs-stop`, `data-runs-back`, `data-runs-retry`, `data-runs-undo`, `data-tb="rt:…"` (shares `S.tbOpen`).
- **Smells**: the controller is in app.js. `#thead [data-run]` (app.js:3595) is main-only, so the run chips on the Thread page's strip (`#tpthead`) do not open their run (only `[data-runs]` is matched for both).
- **Proposed home**: `modules/threads/runs/` (view + the app.js controller), registered as a `thread.header.strip` provider and a sheet overlay.

### js/imagechange.js (120 lines)
- **Purpose**: shows a binary image change in Changes or Files: before beside now, read via `api.projectImage` / `api.projectVersion`, with abort and URL cleanup.
- **Exports**: `isImageChange`, `imageWords`, `noRoute`, `drawImageChange`. **Imported by** changesframe.js, viewer.js. Test: imagechange.
- **Imports**: util.js `esc`, api.js. **State**: the module-global `missingAt` (a 5-minute back-off for a missing version route).
- **Note**: this is not conversation code. It was in my scope list but belongs to Changes and Files.
- **Proposed home**: `modules/changes/imagechange.js`.

### Conversation code still inside js/app.js (for the ledger; not a file in my scope, but it must move with this domain)
| app.js lines | What | Proposed home |
|---|---|---|
| 84–94 | `setWebImages` hook (shape `xo:conversation/webpics`, fileRoute), `startRich()` | conversation/media + kernel start |
| 338–382 | `convThread`, `convProject`, `sessionOf`, `nameWith({...})`, `setThreadInfo` | conversation/model (view-key helpers), comms words |
| 850–1168 | `chatOf`, `convOfChat`, `convHost`, `messagesOf` (rows + optimistic + turns segmented + relays + hops + controls + limits + merge by seq/time), `proseHtml`, `threadCardHtml`, `queuedMeta`, `nameOf`, `moveBannerHtml`, `HIST_SKEL`, `answeredAfter`, `passedTo`, `startHtml`/`startDraft` | conversation/source (the item model) |
| 1170–1297 | `msgItems`/`msgItemsOf`: item → HTML per `who` (you, coord/agent, turn, card, system variants, control, limit, asked, note, start, hist, event, rec) | conversation/rows: a `conversation.row` keyed slot by `who` |
| 1439–1483 | `checklistRender(needs, th, view, listId)` (already instance-aware) | threads/checklist |
| 1484–1708 | sub-agents sheet controller `RS` | threads/runs |
| 1710–1874 | `createDock` | conversation/dock |
| 1876–1959 | `openAsk`, `typingRender(C)`, `tickElapsed` (global 1 s interval) | conversation/typing |
| 2028–2075 | `recordLine` (local "rec" rows into `S.local`), `undoRecord`, `chipRender(fade,K)` | conversation (rec rows); intelligence chip |
| 2077–2700 | the composer: MK, wireComposer, tray, drop veil, @ list, target line, placeholder, drafts, Stop (`stopLive` with 3 s Undo, `stopsHerald`), send gate (`liveBlock`, `blockFor`, `refuse`, `composerDest`), `sendLive`/`deliverLive`/`postLive`/`postWithFiles`, `send`, `retry`, `putBack`, `editFailed` | modules/composer (+ composer/gate, composer/stop) |
| 2700–2816 | the Thread page (TP, tpMount/Show/Unmount, tpHead, tpMenuHtml, drawThreadPage, openFromPanel) | threads/panel-page (mounts a conversation instance) |
| 2818–3069 | `createConv`, MAIN, `render()` conv parts, `loadAhead`, `loadOlderNow`, `drawConv`, `readingPlace`, `holdPlace`, `stirred`, `foldsBefore`, `workMotion` | conversation/core |
| 3070–3090 | main scroller rAF (loadAhead + `#top.is-scrolled`), `#dock` RO (`--dock-h`, `is-stacked`, `heraldRoom`), `initFollow()` | conversation/core (per instance) + shell (header edge) |
| 3148–3191 | `returnPill` (main only), `liveReady` | conversation/core |
| 3192–3222 | `follow()` (which streams to watch), `loadChatHops`, `ensureRoot` | conversation/source |
| 3249–3322 | `showMsg` (main only), `fwdSource`, `reactionsHtml`, `reactorName`, `openMedia`, `fileRoute` + the `drawing` global, `openSharedFile` | conversation/rows, media |
| 3533–3700 | the document click switch: data-older, data-tb, data-retry, data-edit, data-interrupt, data-chat-*, data-run-call, data-mx, .tb-cf, data-file, data-copy, data-rec-undo, data-ck … | each module's own delegated handler on its mount root |

---

## 2. Domain summary

### 2.1 Proposed module boundaries
- **`modules/conversation`**, the mountable unit. `mountConversation(host, { source, view, composer?, dock?, header?, onView })` → `{ C, follow, decor, destroy() }`. Inside it:
  - `core.js`: createConv, drawConv, readingPlace/holdPlace, foldsBefore/workMotion, loadAhead/loadOlder, liveReady, returnPill, showMsg (instance-scoped).
  - `follow.js`: today's follow.js, instance only.
  - `decorate.js`, `working.js`, `actions.js`, `gestures.js`, `latest-button.js`: msgx split, each with `destroy`.
  - `rows/`: the row renderers by `who` (from msgItemsOf) and `blocks/` (turnview + comms words).
  - `media/`: media.js, plus a per-instance gallery root and drag-out.
  - `typing.js`: typingRender, per-instance timers (not `S.heldT`/`S.askT`).
  - `dock.js`: createDock, consuming `decisions.card`.
  - `model.js`: messagesOf/item model plus timeline's conversation helpers.
- **`modules/composer`**: the K object as a real factory `createComposer(host, { view, conv, features })`. It owns the field, Send/Stop, target line, placeholder, drafts (namespace `cv-drafts:live`), the attachment tray (one tray service, keyed by view), the reply chip and quote (from msgx), and the send gate. The @ list, line refs, and "send now" become **composer tools and providers**, not main-only code.
- **`modules/decisions`**: needs (service), queue, card, panel, toast, pacing, rank, items (review.js), the paid/limit detail renderers.
- **`modules/chats`**: chats.js, as a conversation *source* plus its setup popover.
- **`modules/intelligence`**: intel.js as a composer tool.
- **`modules/threads`**: the Thread panel page (a host that mounts conversation + composer + dock + checklist + runs), and the runs sheet (runsview + RS).
- **`core/ui/markdown`**: markdown, rich, chart, highlight (with a render context instead of global hooks). **`core/ui/lightbox`**.
- **`core/services/world`**: blocks.js (turns), timeline normalisers, paid.js, review `hostOf`/`askedBy`. **`core/services/runtimes`**: runtimes.js. **`modules/files/drafts`**: drafts.js. **`modules/changes`**: imagechange.js.

### 2.2 Places (slots) this domain needs
| Slot | Kind | Scope | Who registers / what for |
|---|---|---|---|
| `conversation.source` | keyed by view prefix (`ws`, `p:`, `t:`, `c:`, `chats`) | app | Coordinator chats, threads, plain chats: items(view), liveReady, loadOlder, watch/unwatch, header |
| `conversation.row` | keyed by item `who` | app | you/coord/agent/turn/card/system/control/limit/asked/hist/event/rec renderers (third parties can add item kinds) |
| `conversation.block` | keyed by storm block `type` | app | thinking/activity/plan/shared_files/narration/text/answer (turnview) |
| `conversation.toolWords` | priority-chain (first non-null wins) | app | comms.js words; others for MCP/app tools |
| `message.action` | list (ordered) | conversation | Copy, Reply, Good, Bad (msgx action row/bar); later "Open in…", "Pin" |
| `message.decorator` | list | conversation | tails/naming, quote card, emoji, project marks (msgx decorate) |
| `conversation.overlay` | list | conversation | back-to-latest button, return pill, select-to-reply popover |
| `composer.tool` | list (ordered) | conversation (per composer) | paperclip, intelligence chip, "send now", @-target |
| `composer.targetLine` | priority-chain | conversation | Chats' target line, the send gate's paused line, thread target, project/ws |
| `composer.sendGate` | priority-chain (first refusal wins) | app | `sendBlock` (connection, routing off), chat ended, files busy |
| `composer.chip` (above field) | list | conversation | reply chip, line-ref chip, attachment tray |
| `conversation.dock` | single per conversation | conversation | docked decision card or Chats confirm |
| `decision.card` | single renderer, surface param `panel`/`dock`/`home` | app | decisions card |
| `decision.detail` | keyed by item kind (`usage`, limit, permission, question, create_project…) | app | paidHtml, limitHtml, itemDetailsHtml, waitingDetailsHtml |
| `thread.header.strip` | list | conversation (thread) | checklist, sub-agent strip |
| `panel.page` | keyed (`thread`) | app | the Thread page (already `STAGE.page(...)`, app.js:2761) |
| `settings.section` | list | app | Chat bubbles (cv-bubbles), web pictures (shape), work mode (shape) |
| `keys.action` | keyed | app | intel, allow/back/reply/done/details/rule/undo/allowAll/later/next/prev |

### 2.3 Public API the domain should expose
- `conversation.mount(host, opts)` → `{ draw(needs), view, follow: {toLatest, unpin(row), toRow(el, smooth), isPinned, fromLatest, fromTop}, showMessage(id), destroy() }`. Other modules **never** scroll a conversation themselves. They call `unpin(row)` before an action that resizes the column (the panel opening from a file chip, app.js:3669) or `toRow`.
- `conversation.at(el)` → the instance owning an element (replaces `convAt`).
- `composer.create(host, { view, conversation })` → `{ say, focus(), putBack(text), insert(text), draft:{save,load}, destroy() }`, plus `composer.at(el)`.
- `decisions`: `needItems()`, `open(key, opts)`, `close()`, `undo()`, `card.render(n, surface)` / `card.wire(frame, el, n, ctx)` / `card.keys(e, card)`, `onChange`.
- Events on the kernel bus: `conversation:opened {view}`, `conversation:viewChanged`, `message:sent {view, cid}`, `decision:made/undone {key}`, `turn:ended {key}`.

### 2.4 Risks in moving it: subtle behaviour that is easy to lose
1. **Scroll anchoring**: `#msgs` must stay a normal-flow list inside a real scrolling element, so the browser anchors older pages that land above. No `column-reverse`, windowing/virtualisation, `content-visibility`, or transforms on the list (follow.js header; app.js:2835–2838; memory "chat scroll anchoring traps").
2. **One owner of scrollTop**: only follow.js writes it, plus holdPlace in drawConv and keepPlace. msgx's quote jump (`scrollIntoView`, msgx.js:705) and lightbox focus restore with `preventScroll` are the exceptions to watch. A new module that calls `el.focus()` without `{preventScroll:true}` inside the scroller moves the view.
3. **Order of operations in drawConv** (§0.3): measure folds and place → reconcile → hydrateMedia → holdPlace sync **and** microtask → workMotion → typing → toLatest-if-opening. Reordering, or making decoration async (rAF), breaks focus continuity and place holding.
4. **Same-task decoration**: msgx runs from MutationObserver and the `redrawn` event (microtask/sync). The `data-own` contract with redraw.js keeps decorations through in-place redraws (redraw.js:80–82; ui.js:296–325). The pressed-node rule in reconcile (ui.js:280) is what keeps clicks working while live data redraws (commit f7498dc today).
5. **Resize handling before paint**: pinned growth and the width-change hold run in `ResizeObserver` callbacks (follow.js:128–135). The `--dock-h` writes are also in ROs (app.js:2738, 3083–3088). Moving any of these to rAF shows a frame of drift.
6. **Width-change scroll events** are not "you scrolled" (follow.js:114–115). This must hold for every place a conversation is mounted (a panel opening, a chat beside a file).
7. **Opening lands at the latest; filling doesn't move you**: `rendered` vs `filled` (app.js:2961–2966, 2982). The Thread page resets both when it switches thread (2745). A new host must do the same.
8. **Ended-turn ordering and height hold** are CSS rules keyed by `#<msgs.id>` and gated on `:root[data-msgx]`, which is set **only when bubbles are on**. In the default document look they are inert (msgx.js:337–352). Decide whether that is intended before porting, and keep list ids unique per instance.
9. **Hidden globals that are not per instance**: `S.tbOpen` (folds are shared across conversations by block id, which is intentional for Chats via `world.ui`), `S.tbToggled`, `S.heldT`/`S.askT` (typing timers clobber across instances, app.js:1913, 1927), `drawing` (app.js:3308), turnview `WORDS`, comms `names.here()` (main view only), markdown hooks, media `REG`, the shared attachment `tray`, the main-only `TD.undone` in `D.onUndone` (app.js:186).
10. **Thread page gaps today** (things a reusable module would fix, and must not regress further): no `wireDragOut` on `#tmsgs` (app.js:259); the lightbox gallery root falls back to one message (3296); `#thead [data-run]` is main-only (3595); `returnPill` and `showMsg` are main-only; the `#tiq` vs `#iq` pointerdown exclusion in intel.js:730; msgx, dock, and tpMount listeners/observers are **never torn down** on unmount, so they accumulate on each mount (msgx.js:324–325, 591, 670–733, 885–898; app.js:1773–1774, 1855–1869, 2738–2739).
11. **Composer defaults that read the main field**: `liveBlock(view, text = say.value)` and `composerDest(view, text = say.value)` (app.js:2529, 2551), and `connDest()` (2548). A second composer that forgets to pass its text is gated on the main composer's draft.
12. **Quote-on-send** relies on capture-phase keydown/submit rewriting `say.value` and `setTimeout(0)` restoring it (msgx.js:662–677), so `send()` must read the field synchronously in the same task.
13. **Decision card expando API** (`frame._quiet/_allow/_hold/_n/_openNote/_dis/_teach`) is what the dock's keydown (`D.cardKeys`) uses. Keep it, or replace it with an explicit card controller object. Key-repeat and quiet-keys guards (decide.js:1030–1039) protect against typing landing as approvals.
14. **Import-time side effects** that a loader must preserve or make explicit: msgx decorates the main chat at import, also via index.html:291; follow.js creates MAIN; media.js adds document `error` and `pointerover` capture listeners; rich.js `setRich` at import; app.js calls `setWebImages`, `startRich`, `nameWith`, `setThreadInfo`, and `setWorkMode`.
15. **Two "drafts"**: composer drafts (`S.drafts`, `cv-drafts:live`, in app.js) vs file drafts (drafts.js, `xo-draft:*`). Don't merge them by name in the ledger.
16. **Storage keys owned by this domain**: `cv-drafts:live`, `cv-chat-prefs`, `xo-msg-rating`, `cv-bubbles` (read in index.html before paint), and the shape keys `xo:conversation/webpics`, `xo:thread/work`, `xo:thread/hops`, `xo:composer/intel`. File drafts: `xo-draft:*`, `xo-drafts`.
17. **Timing constants worth carrying verbatim**: the 2.5 s working-label hold, the 140 ms wheel-swipe idle, swipe thresholds 56/72/64 px, back-to-latest at 240 px or half a viewport, the 600 ms quiet before KaTeX/Mermaid, the 3 s commit/Undo (Kit.COMMIT_MS), `Kit.READ_MS` before a card acts, 20 min for an open ask, picture "Loading…" after 3 s, and the 800 px IntersectionObserver margin.
