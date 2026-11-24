# Fix plan for the modular codebase

Plan only. Nothing here is built until the owner approves its package. Every path and line is read from the tree at `modular-gate-P3-group-05` (`0ef1bf97`) unless it says otherwise. Group 6's branch was read at `eda19fc3`.

The owner's priority sets the bar: quality, system design and sound engineering before speed. Most findings are not separate bugs. They come from six missing or unused contracts. The plan fixes each contract once, then moves each finding onto it, and adds a check so new code can't reintroduce the pattern.

## 1. What the findings have in common

| Pattern | Findings that show it | Contract that fixes it once |
|---|---|---|
| Things started without a way to stop them: observers, listeners, timers, polls | Files ResizeObserver, media observers, conversation observers, Map listeners and observer, Made's document listener, Shells polling, Accounts poll, intel fallback timer, Chats' 1500 ms timer | **C1 Lifecycle scope** |
| Module-level maps that only grow | media `REG`, scroll-root watchers, `TONE`, blob URLs evicted while on screen | **C2 Bounded caches** |
| Async reads with ad-hoc dedupe, ordering and timeouts | Chats titles, intel catalog race, Map folder retries, Runs strip retry, GitHub detail read | **C3 Reads** |
| Errors swallowed by a comment-only `catch`, and storage wrapped by hand in 22 files | 35 comment-only catches in modules, shell and the app entry, 20 of them `/* private mode */`; theme refusal | **C4 Errors and storage** |
| Regions repainted with `innerHTML` and focus lost | GitHub page, dock, Files tree | **C5 One redraw path** (exists: `core/ui/redraw.js`) |
| Focus and scroll decided at each call site | thread open on touch raises the keyboard, `#panel` focus fallback, radio Tab stop, quote jump outside follow | **C6 Focus and scroll policy** |

Static serving (masks, stylesheet graph) is its own design item, **C7**.

## 2. The contracts

### C1 Lifecycle scope

**Rule.** Anything a module starts (listener on a node it doesn't own, observer, timer, interval, frame, poll, stream subscription) is registered on a scope. A mountable surface returns `dispose()`; after it runs, the scope's live count is 0.

**Where.** The kernel already implements this for `activate(ctx)` modules: `ctx.listen`, `ctx.timeout`, `ctx.interval`, `ctx.frame`, `ctx.observe` over the undo bag in `core/kernel/undo.js`, with the conformance rule "after disable, `live(id)` is 0" (`core/kernel/README.md`). Only `apps-host/host.js` uses it. Feature modules are `createX()` factories wired in `js/app.js` and each invents its own disposal (`gone` arrays in `modules/conversation/working-turn.js:242`, `mount` returning an undo in `shell/panel/pages.js:127`, nothing at all in Files, media, Map and Made).

**Change.** Extract `createScope()` into `core/kernel/scope.js`: `listen`, `timeout`, `interval`, `frame`, `observe`, `effect`, `signal` (an `AbortSignal` aborted on dispose), `dispose`, `size`. Build the kernel's `ctx` lifecycle methods on it, so there is one implementation. Factories take a `scope` argument; `mount()` returns `scope.dispose`. This is the same shape modules will need when they move to `activate(ctx)`, so it is the step toward that, not a parallel mechanism.

**Rejected.** (a) Add a `disconnect()` call at each finding: fixes symptoms, leaves the next module free to repeat them. (b) Convert every feature module to `activate(ctx)` now: right end state, but it rewires boot for every module and collides with P4. Do it after P4, module by module; the scope makes it a swap of where the scope comes from.

**Enforcement.** A `lifecycle` step in `tools/check.mjs` counts, per file under `modules/`, `shell/` and the app entry: `new (Resize|Intersection|Mutation)Observer(`, `setInterval(`, `document|window.addEventListener(`. Like `layers.json`, it keeps a baseline that may only go down (21, 6 and 46 occurrences today). New code must use the scope. A shared test helper asserts `scope.size === 0` after `dispose()` for each mountable surface.

### C2 Bounded caches

**Rule.** No module-level `Map` or `Set` grows without bound. A cache has a size limit and an eviction hook; a registry of rendered things is pruned to what is on screen.

**Where.** `core/platform/cache.js`: `createLru({ max, onEvict })`. `hydrate.js` already hand-writes an LRU (`touch` and `evict`, lines 23–29) and a second cap for `shown` (line 83). Both move onto it.

**Rejected.** `WeakMap` everywhere: right for the scroll-root watchers (keyed by element) and used there, but `REG` and `TONE` are keyed by strings, so they need a limit.

**Enforcement.** Each cache gets a unit test that fills past `max` and checks eviction and `onEvict`. Review rule in `AGENTS.md`: a module-level collection needs a bound or a `WeakMap`.

### C3 Reads

**Rule.** A read is deduplicated by key, carries the scope's `signal`, uses the HTTP layer's own timeout, and only the latest request for a key may write its result.

**Where.** `core/platform/http.js` already has `timeout` and `signal` on `request()` (lines 41–65) and reports `ApiError` with a timeout code; `core/platform/pending.js` already has `once(key, work)`. Add `latest(key, work)` beside `once`: a newer call aborts the older one through its signal, so a late answer never wins. API wrappers pass `RequestOptions` through.

**Rejected.** `Promise.race` with a `setTimeout` (what intel does): the timer outlives success and duplicates the HTTP deadline. Per-module `reading` sets and `asked` maps: four copies of the same idea.

**Enforcement.** Unit tests for `latest` with reversed responses. The `lifecycle` step above already flags new bare timers.

### C4 Errors and storage

**Rule.** No comment-only `catch`. An expected failure is handled by name (for example `missingRoute(err)` in `http.js:117`); anything else is reported once through `core/services/notices` or rethrown. Storage goes through one module.

**Where.** `core/platform/storage.js`: `read(key, parse, fallback)` and `write(key, value)` returning `{ kept: boolean }`, for both local and session storage. It is the only file that touches `localStorage` or `sessionStorage` (43 references in modules, shell and the app entry today, each with its own `try`).

**Rejected.** Turning `no-empty` stricter: oxlint already has `allowEmptyCatch: false`, and a comment defeats it, which is how 35 of these got in.

**Enforcement.** The `lifecycle` step also counts comment-only catches and direct storage references per file, with a baseline that only goes down; `storage.js` is the one allowed file.

### C5 One redraw path

**Rule.** A region that is repainted while it can hold focus uses `redraw()` from `core/ui/redraw.js`, keyed by `id`, `data-key` or data hooks. `innerHTML =` is for first fill and for regions that never hold focus.

**Where.** Exists. Ten modules use it already.

**Enforcement.** Each fixed surface gets a DOM test that the focused control is the same node after a repaint. A repo-wide `innerHTML` ratchet (177 assignments) would be noise; the rule is enforced per surface by test.

### C6 Focus and scroll policy

**Rule.** (1) Entering a surface calls `focusEntry(field, landmark)` from `core/ui/a11y/focus.js`: the field on keyboard and fine pointers, a non-input landmark (`tabindex="-1"`) after a touch, so the phone keyboard never opens by itself. (2) Every programmatic focus target is focusable. (3) Only `follow.js` scrolls a conversation.

**Where.** `core/ui/a11y/focus.js` (exists: `usable`, `inSight`, `bringWhole`). It reads the last pointer type from one capture listener, the same way `redraw.js` tracks the pressed node.

**Rejected.** Checking `matchMedia("(pointer: coarse)")` at each call site (`shell/gestures.js:308` does this): wrong on touch laptops and repeated everywhere.

**Enforcement.** A test-kit helper fails a test if `.focus()` lands on `BODY` or on a non-focusable node. The `lifecycle` step also counts `scrollIntoView(` under `modules/conversation/` (allowed only in `follow.js`).

### C7 Static serving

See finding F27 and F28. One serve-time CSS step in `serve.py` handles both.

## 3. Findings

Format: **Root cause** (confirmed or not), **Fix** (with what was rejected), **Owner-visible**, **Test** (fails before, passes after; each proven by a deliberate break), **When**, **Size / risk**.

### Files and media

**F1. Files drag-and-drop never moves.**
- Root cause, confirmed: `modules/files/drag.js:36–38`. `drop` copies `dragging` to `d`, sets `dragging = null`, then calls `fits(to)`, which reads `dragging` (line 12) and returns false, so `moveTo` never runs. Same bug as release `js/files.js:822,841–843`.
- Fix: make `fits(item, to)` a pure function of the dragged item and the target, and call it with `d`. Rejected: reordering the two statements; it keeps the hidden coupling to mutable state that caused the bug.
- Owner-visible: yes. Dragging a file onto a folder starts moving it, as intended. **Needs the owner's OK.**
- Test: linkedom DOM test through `wireFileDrag`: dispatch `dragstart` on a file row, `dragover` and `drop` on a folder row; expect `moveTo(from, to)` once. Also no call when dropping on the item's own parent.
- When: now. Size S, risk low.

**F2. Files ResizeObserver and listeners have no disposal path.**
- Root cause, confirmed: `modules/files/files.js:332–335` creates the observer without keeping it; `mount` (338–357) also appends a menu to `document.body` and wires host listeners. It is not a growing leak today: `modules/files/page.js:35–38` mounts once per app life. It is a missing lifecycle contract that would leak on any remount.
- Fix: C1. `mount(host, scope)` registers the observer, the body menu removal and the listeners on the scope, and returns `dispose`. `page.js` keeps the scope.
- Owner-visible: no.
- Test: mount, dispose; scope size 0, menu gone from `body`, resize callback no longer repaints.
- When: now. Size S, risk low.

**F3. Media registry, scroll-root observers, tone cache and blob URLs grow forever.**
- Root cause, confirmed: `core/services/media/render.js:14,96` adds every rendered item to `REG` and never removes one. `hydrate.js:52–64` keys one `IntersectionObserver` per scroll root in a strong `Map` with no removal. `hydrate.js:148–163` caches tone by image URL without a bound, and blob URLs are revoked, so stale keys pile up. New: `hydrate.js:24–28` drops an evicted blob from the cache without revoking it when it is still on screen, so that object URL is never revoked.
- Fix: C2. Watchers move to a `WeakMap` keyed by the scroll root, with the observer disconnected when its scope disposes. `REG`, `TONE`, `blobs` and `shown` move onto `createLru`. `blobs` revokes in `onEvict`; a URL still on screen is stays in a small set of on-screen URLs and is revoked when its image is replaced or removed, instead of being forgotten. Rejected: clearing `REG` on conversation change; the lightbox opens items from the panel and from other conversations, so a time-based clear breaks it.
- Owner-visible: no.
- Test: render more than `max` items and check `REG.size`, then that the lightbox still resolves every item on screen; revoke spy proves every created URL is revoked once it is off screen and evicted; a garbage-collected scroll root leaves no watcher (checked through the scope).
- When: now. `core/services/media/` is not in Group 6's diff. Size M, risk medium (lightbox lookups).

### Panels and lists

**F4. Chats reads titles eagerly and holds the list until they finish.**
- Root cause, confirmed: `modules/chats/chats.js:47–48`. After the session read, up to 24 `observedMessages` reads run with `Promise.all`, and `loading` clears and `schedule()` runs only after all of them (50–51). A title failure is swallowed (`catch { /* stays untitled */ }`). Also `chats.js:134`: each turn-count increase schedules a history reread after a fixed `setTimeout(…, 1500)`.
- Fix, design level: the title is a property of the session, so Space should serve it once in `SessionListItem` (Space's `/openapi.json` on `:5002` has no title field today). Ask Space through the workspace coordinator. Client side, independent of that: paint the list as soon as sessions arrive; read titles for rows in view through C3 (`once` per session, at most four at a time, the scope's signal), each result redrawing its row through C5. Replace the 1500 ms timer with a reread on the stream event that already marks the turn finished (to confirm in `world` before building; if no such event exists, say so and keep the delay as a named constant on the scope). Rejected: lowering 24 to a smaller number; same shape, same wait.
- Owner-visible: yes. The list appears at once and titles fill in. **Needs the owner's OK**, and the Space change needs its own approval.
- Test: fake API with 100 sessions and slow history reads; the list renders before any history read resolves, history reads stay at or below the concurrency cap, and only rows in view are read.
- When: now. Size M, risk medium.

**F5. The GitHub page replaces its whole DOM on every redraw.**
- Root cause, confirmed: `modules/github/page.js:222–223`. `paint()` and `paintItem()` assign `innerHTML`. A fold click repaints the list and destroys the focused button, so focus falls to `BODY`. New: `page.js:229` swallows every detail-read error other than 404 and 405 (`return`), so the detail pane never says it failed.
- Fix: C5 for both panes, with `data-gh-*` keys already on the buttons. The detail read goes through C3 and shows a failure line through the page's existing announce path.
- Owner-visible: slight. Focus and scroll stay put on refresh and fold, and a failed read now says so. **Needs the owner's OK** for the failure line.
- Test: focus a fold button, click it, expect the same node focused; detail read rejects with 500, expect the failure line.
- When: now. Size S, risk low.

**F6. The selected permission row has no Tab stop.**
- Root cause, confirmed: `core/ui/a11y/keynav.js:33`. `rovingTab` returns `""` for the stop, which works only for elements that are focusable by default. `modules/chats/setup.js:115` uses it on `div role="radio"` rows, so they have no Tab stop at all.
- Fix: the helper's contract is "exactly one option is in the Tab order", so it emits `tabindex="0"` for the stop and `"-1"` for the rest, whatever the element. One change fixes every caller. Rejected: converting the rows to buttons at this one call site; the helper would still be wrong for the next `div`.
- Owner-visible: keyboard only. Tab now reaches the permission list. No look change.
- Test: render the picker; Tab from the header lands on the selected row; arrows move and choose.
- When: now. Size S, risk low.

**F7. Shells polls while the page is hidden; its listeners have no owner.**
- Root cause, confirmed: `modules/shells/dock.js:81–106`. `refresh` always reschedules (60 s idle, 15 s while the list shows), including while `document.hidden`; `visibilitychange` then refreshes again on return. `dock-input.js:130–135` adds `beforeunload` and media-query listeners. Space has no terminal stream event (checked `world` and the SSE code), so polling is the right model for now.
- Fix: the poll runs on the scope and is not rescheduled while hidden; the visibility listener resumes it. Listeners register on the dock's scope. Rejected: a push event; correct long term but a Space change, noted for the Space backlog.
- Owner-visible: no.
- Test: fake timers; hide the document, run past two intervals, expect no reads; show it, expect one read.
- When: now. Size S, risk low.

**F8. Intelligence warms catalogs during render and leaves a 20 s timer running.**
- Root cause, confirmed: `modules/chats/intel.js:144–146` races the catalog against `setTimeout(…, 20000)` and never clears it. `intel-catalog.js:52–56` starts a read from inside rendering and swallows its error (`() => {}`).
- Fix: C3. The catalog read uses the HTTP timeout and the picker's signal; the "slow" message keys off the timeout `ApiError`. Warming moves out of render into the picker's open path. A failed warm is recorded on the catalog entry so the picker shows the existing "can't be read now" line.
- Owner-visible: no.
- Test: fake timers; catalog resolves at once; no timer pending afterwards; a timeout error shows the slow line.
- When: now. Size S, risk low.

**F9. The Shells sidebar count drives a `:has()` selector.**
- Root cause: `shell/sidebar.css:54`. Cost not measured; needs a browser.
- Fix: measure first. If style recalculation is material, toggle a class from the same render that writes the count. Otherwise close it.
- Owner-visible: no. When: after P4, in the measurement batch (F24). Size S, risk low.

**F10. Theme refusal leaves the old theme selected while the notice says "Applied for now".**
- Root cause, confirmed: `modules/settings/appearance.js:20–26`. When `setItem` throws, `kept` is false, then `applyTheme(THEME.get())` rereads storage, which still has the old value, so the old theme is applied while the notice claims the new one.
- Fix: C4. The theme service holds the chosen value in memory and storage only persists it (`write` returns `{ kept }`). The UI then matches its notice. **Owner decision:** keep the new theme for this session and say it won't be remembered (recommended, it matches the existing notice), or revert and say it couldn't be saved.
- Test: storage that throws; choose Dark; expect dark applied and the session notice.
- When: now. Size S, risk low.

**F11. Accounts keeps polling the device sign-in after Settings closes.**
- Root cause, confirmed: `modules/settings/accounts.js:161–173`. The poll is tied to the flow, not to the page.
- Fix: keep it tied to the flow (the user may be finishing sign-in on GitHub in another tab), but own the timer by the Accounts module scope and announce the result through notices if Settings is closed. **Owner decision:** sign-in finishes in the background (recommended), or closing Settings cancels it.
- Test: start the flow, close Settings, resolve the poll; expect one notice and no further timers.
- When: now. Size S, risk low.

**F12. Map keeps a font listener, a ResizeObserver and the quiet scheduler's input listeners.**
- Root cause, confirmed: `modules/map/map.js:47` (fonts) and `337–339` (observer); HANDOFF's lines were from `82abf208` and have moved. Map mounts once today, so as with F2 it is a contract gap.
- Fix: C1 on Map's mount.
- Owner-visible: no. Test: mount, hide, dispose; scope size 0. When: now. Size S, risk low.

**F13. Inferred project icons stay stale after a rename.**
- Root cause, confirmed: `modules/projects/icon-choice.js:17–25` keys the memo by thread count and override, not by the inputs to `classify` (project name and thread titles).
- Fix: key by what `classify` reads: the project name plus a cheap signature of the titles. Rejected: dropping the memo; `projectIcon` runs on every sidebar paint.
- Owner-visible: yes, a renamed project's inferred icon updates. **Needs the owner's OK** (small).
- Test: rename a thread without changing the count; expect the new icon.
- When: now. Size S, risk low.

**F14. Explicit Map folder retries can overlap.**
- Root cause, confirmed: `modules/map/folders.js:20–21`. A refresh on an `ok` entry keeps it `ok`, so the guard lets a second refresh start, and whichever answer lands last wins.
- Fix: C3 `latest(dirKey)`; the older request is aborted.
- Owner-visible: no. Test: two refreshes with reversed responses; the second request's result stays. When: now. Size S, risk low.

**F15. The Runs strip never retries a failed automatic read at the same count.**
- Root cause, confirmed: `modules/runs/strip.js:28–30`. `runsAsked` is set before the read and the failure is swallowed (`() => {}`), so the same count never asks again.
- Fix: record the count only on success; a failure goes through C4 and the next render may ask again, deduplicated by C3 `once` so renders don't stampede.
- Owner-visible: no. Test: first read rejects, render again at the same count; expect a second read. When: now. Size S, risk low.

**F16. A thrown record Undo callback leaves the record active.**
- Root cause, confirmed: `modules/chats/record-lines.js:35–37`. `m.undo()` runs before `m.undo = null` and before the herald is cleared, so a throw leaves the record undoable and the herald stuck.
- Fix: clear the record's undo state first, then run the callback; on a throw, report it through notices and mark the line "couldn't undo". The kernel's `undo.js` already uses this order (clear, then call, then report).
- Owner-visible: only on failure, where the line now says so. **Needs the owner's OK** for the wording.
- Test: a callback that throws; the record is no longer undoable, the herald moves on, one notice.
- When: now (`record-lines.js` is not in Group 6's diff). Size S, risk low.

**F17. Made warms 48 thumbnails and adds a document click listener per creation.**
- Root cause, confirmed: `modules/artifacts/made.js:62` and `164`. `createMade` runs once (`js/recordview.js:14`), so the listener does not multiply today.
- Fix: the listener moves onto the record's scope (C1). Thumbnail warming stays, but through the same in-view queue Chats uses (F4), instead of a fixed 48.
- Owner-visible: no. Test: dispose the record; a click no longer reaches the handler. When: now. Size S, risk low.

### Conversation and decisions (Group 6's area)

**F18. Opening a thread from the side panel raises the phone keyboard.**
- Root cause, confirmed: `js/app.js:2049` and `2054` at the gate (`tpShow`) focus the composer field (`TP.K.say`) whenever `focus` is set, with no regard to how the thread was opened. The same function also waits with `requestAnimationFrame(() => setTimeout(…, 0))`.
- Fix: C6 `focusEntry(field, landmark)`: the field on desktop, the thread page's heading (`tabindex="-1"`) after a touch. This is the rule already written for the parked branch `xo/thread-7ea52a`. Rejected: dropping focus on phones; screen readers then lose their place.
- Owner-visible: yes on phones. **Needs the owner's OK** (it matches the rule they set on 19 November).
- Test: pointer type touch, open a thread; focus is on the heading, not a text field. Pointer type mouse; focus is on the field.
- When: wait for the Group 6 gate (`tpShow` moved in `0905bd84`). Size S for the call site, M with the policy. Risk low.

**F19. The decision panel's focus fallback targets a section with no `tabindex`.**
- Root cause, confirmed: `js/decide.js:239` focuses `#card` or else `#panel`; `#panel` is the `section` in `shell/overlays.js:11` with no `tabindex`, so focus silently stays where it was.
- Fix: C6 rule 2. The fallback targets the panel's heading `#pn-h` with `tabindex="-1"`, which also gives screen readers the panel's name. Rejected: `tabindex="-1"` on the whole section; a focus ring around the whole panel after a keyboard action.
- Owner-visible: no at rest; a screen reader announces the panel.
- Test: restore an open panel with no card; `document.activeElement` is `#pn-h`.
- When: wait for the Group 6 gate (`decide.js` is in its diff). Size S, risk low.

**F20. The dock renders and parses the card twice.**
- Root cause, confirmed: `js/app.js:1125` (Group 6: `modules/decisions/dock.js:60`) renders `D.cardHtml(n, "dock")` into a template only to read the `.c-h` text, then `1143` (`dock.js:78`) renders it again. In the open path the first result is unused.
- Fix: the card's title is data, not markup. Add `cardTitle(n)` to the decision card model and use it in both `cardHtml` and the folded bar; render once. Also replace the `tdock._ch` expando with state on the dock controller.
- Owner-visible: no. Test: spy on `cardHtml`; one call per dock render; the folded bar's text equals the card's heading.
- When: wait for the Group 6 gate. Size S, risk low.

**F21. Message decoration walks the conversation several times per change.**
- Root cause, partly confirmed: `modules/conversation/decoration.js:86–166` walks `msgs.children` and then runs further document-wide queries (lines 213, 238, 259) on every child-list mutation (line 270) and on every `redrawn` event (271–279). The cost isn't measured.
- Fix: decorate only the rows named in the mutation records and the `redrawn` target, and run whole-list passes (latest mark, avatars) once per frame through the kernel scheduler's `invalidate`. Measure before and after with a long thread in a unit benchmark (linkedom) and, if the owner allows, one browser trace.
- Owner-visible: no. Test: append one row to a 500-row list; the per-row decorator runs once.
- When: wait for the Group 6 gate. Size M, risk medium.

**F22. Conversation observers can outlive their decorator.**
- Root cause, confirmed: `decoration.js:266–270` and `latest-button.js:45–68` create observers that are not added to the existing `gone` list.
- Fix: C1. Replace the `gone` arrays in conversation with the scope.
- Owner-visible: no. Test: create and dispose a decorator; scope size 0. When: wait for Group 6. Size S, risk low.

**F23. Working turns size themselves with a probe and hard-coded numbers, and each decorator scans the whole document every second.**
- Root cause, confirmed: `modules/conversation/working-turn.js:221` computes `16 + probe.offsetWidth + 12 + max(64, …) + 16 + 2` px, against the owner's rule of no hard-coded sizes; `233` queries `document` for every `.mx-work`, from each decorator's own 1 s interval (`242`), so two conversations scan each other's rows twice a second. Lines `35` and `44` inject per-conversation `<style>` sheets.
- Fix: size the working pill by its content in CSS (`width: fit-content` with the existing motion tokens for the transition) and delete the probe; one ticker per decorator scoped to its own `msgs`. Rejected: moving the constants into tokens; still JS measuring layout that CSS can do.
- Owner-visible: possibly by a pixel. **Needs the owner's OK** and a before/after screenshot pair, which needs the owner's permission to run the browser.
- Test: two decorators; each tick touches only its own rows.
- When: wait for the Group 6 gate. Size M, risk medium.

**F24. A quote jump scrolls outside follow.js, and so does the dock's Answers pill.**
- Root cause, confirmed: `modules/conversation/message-reply.js:95` calls `scrollIntoView`, and finds the quoted message by text match, so it can jump to the wrong message. New: `js/app.js:1205` scrolls the dock's answers with `scrollIntoView`, which also moves every scrolling ancestor.
- Fix: C6 rule 3. The quote carries the source message's id and jumps with `follow.toRow(el, true)`. The dock scrolls its own scroller directly.
- Owner-visible: the quote jump now always lands on the quoted message and following stops, as with other jumps. **Needs the owner's OK.**
- Test: two messages with the same text; the jump lands on the quoted one and `isPinned()` is false.
- When: wait for the Group 6 gate. Size S, risk low.

### After P4

**F25. Map, navigation and theme read layout after writing.** `modules/map/drawing.js:65–74`, `shell/navigation.js:30`, `core/ui/theme.js:21`. Measure in one browser trace with F9 and F21, then batch reads before writes where it matters. Not visible. Size S each.

**F26. A browser test reads `js/map.js` for a palette that moved.** `tests/browser/flows.test.cjs:2171–2172`. Point the assertion at the rendered colours. Fix with the P5 browser harness. Size S.

**F27. `--mask-*` URLs lost release's immutable caching.**
- Root cause, confirmed: release used `url(../assets/…)` in `css/tokens.css:170`, which resolved under `/v/<hash>/` because every consumer sat in the same folder. Modular `core/ui/tokens.css:159–162` uses root-relative `/core/ui/icons/…`, which `serve.py:446–450` serves as `no-cache`. A relative URL doesn't work either: consumers now live in `css/`, `shell/`, `modules/launchpad/` and `core/ui/components/`, and Chromium resolves a custom property's `url()` where it is used.
- Fix: in `serve.py`, a versioned CSS response rewrites root-relative `url(/…)` to `/v/<hash>/…`, the same rewrite it already does for `index.html`. Sources keep one spelling. Rejected: relative URLs (break by consumer depth); inlining SVG as data URIs (bloats tokens, loses caching per icon).
- Owner-visible: no.
- Test: `tests/serve.test.py` fetches `tokens.css` under `/v/<hash>/` and expects every mask URL under the same prefix, and the SVG behind it served `immutable`.
- When: now, but see F28 for sequencing. Size S, risk low.

**F28. The stylesheet graph grew through chained `@import`s.**
- Facts: release had 18 links and 21 stylesheets with no chained imports. At the gate, index links 18 sheets and 12 `@import`s pull in more (`css/app.css`, `css/launchpad.css`, `core/ui/foundation.css` and others), two levels deep, 30 reachable at boot. Every file is under `/v/<hash>/` and immutable, so warm loads are unaffected; the cost is a cold-load waterfall of up to two extra round trips. The 45 count in the brief probably includes non-boot sheets; recount on the P4 tree.
- Options weighed:
  1. **Serve-time flattening in `serve.py`** (recommended): when serving a versioned stylesheet, inline its `@import`s in place, turning `@import url(x) layer(n)` into `@layer n { … }`, and apply the F27 URL rewrite. Sources stay one file per module; the browser gets the same one request per link as release. No build step, which keeps the project's "plain files" rule, and dev and production serve identically.
  2. Flatten into `index.html` links: index would have to know every module's sheet, against the module boundaries the modularization just drew.
  3. A build step (esbuild or lightningcss): fastest output but adds a build to a no-build app.
  4. Leave it: acceptable on warm loads, but keeps the waterfall and leaves F27 needing its own mechanism.
- Owner-visible: no; the cascade is unchanged when each import is inlined at its own position with its layer.
- Test: `serve.test.py` compares the flattened output against a hand-ordered fixture, with layer order, and checks no `@import` remains; one paired screenshot set (owner's permission) confirms rendering.
- When: P4 owns "static entry references" and versioned asset resolution. Either it lands before P4 starts (preferred, the serve change is self-contained), or it waits for the P4 gate. The coordinator sequences. Size M, risk medium.

### New findings from this pass

- **N1.** Motion durations exist twice: `core/ui/motion.js:8–9` (`IN 280`, `MOVE 320`, `OUT 160`) and `core/ui/tokens.css:191` (`--dur-*`). JS should read the tokens once at boot. Also hard-coded durations in the dock (`300`, `360`) and Shells (`200`). After P4, with Group 6's code settled. Not visible if the values match.
- **N2.** DOM expandos hold state (`tdock._ch`, `el._mx`, `el._mxe`, `b._mxq`, `el._h` in `motion.js:76`). They escape types and survive redraws unpredictably. Replace with `WeakMap`s owned by each controller as each area is touched; add to the post-P4 audit.
- **N3.** Every storage access hand-wraps `try`/`catch` (43 references in 22 files); covered by C4.

## 4. Fix packages

Each package is one branch from the latest gate, in small commits: the contract or test first, then one finding per commit with its deliberate-break proof. New tests go in new files so they don't collide with Group 6's 59 touched test files. Baselines (`ratchets.json`, `ledger.json`) are regenerated by the integrator at merge, never hand-merged.

| # | Package | Findings | Owns (files) | When | Size | Risk | Owner OK needed |
|---|---|---|---|---|---|---|---|
| **A** | Contracts | C1–C4 primitives, the `lifecycle` check | `core/kernel/scope.js` (new), `core/kernel/kernel.js`, `core/platform/cache.js` (new), `core/platform/storage.js` (new), `core/platform/pending.js`, `tools/check.mjs`, `tools/baselines/lifecycle.json` (new), `AGENTS.md` | **Now** | M | Low; no behaviour change | No |
| **B** | Files and media | F1, F2, F3 | `modules/files/drag.js`, `files.js`, `page.js`; `core/services/media/render.js`, `hydrate.js` | **Now**, after A | M | Medium (F3 lightbox) | F1 |
| **C** | Reads and timers | F4, F7, F8, F11, F14, F15, F16 | `modules/chats/chats.js`, `intel.js`, `intel-catalog.js`, `record-lines.js`; `modules/shells/dock.js`, `dock-input.js`; `modules/settings/accounts.js`; `modules/map/folders.js`; `modules/runs/strip.js` | **Now**, after A | M | Medium (F4) | F4, F11, F16 |
| **D** | Redraw, focus and small correctness | F5, F6, F10, F12, F13, F17, and `focusEntry` in `core/ui/a11y/focus.js` | `modules/github/page.js`, `core/ui/a11y/keynav.js`, `core/ui/a11y/focus.js`, `modules/settings/appearance.js`, `modules/map/map.js`, `modules/projects/icon-choice.js`, `modules/artifacts/made.js` | **Now**, after A | S–M | Low | F5, F10, F13 |
| **E** | Static serving | F27, F28 | `serve.py`, `tests/serve.test.py` | **Now if it merges before P4 launches**, else after the P4 gate | M | Medium | No (screenshot pair needs browser permission) |
| **F** | Conversation and decisions | F18–F24, N2 for the dock | `modules/conversation/*`, `modules/decisions/*`, `js/decide.js`, `js/app.js` call sites, `shell/overlays.js` (heading `tabindex`) | **Wait: Group 6 gate** (all are in Group 6's diff). Must also land before P4 starts or after its gate, since P4 edits the app entry | M–L | Medium | F18, F23, F24 |
| **G** | Measure and tidy | F9, F21's trace, F25, F26, N1, the `activate(ctx)` migration plan | as measured | **Wait: P4 gate** | M | Low | Browser runs need the owner's permission |

**In parallel with the remaining modularization:** A first (it is small and everything builds on it). Then B, C and D in parallel; their files are disjoint from each other and from Group 6's diff (`eda19fc3`) and P4's ownership. E in parallel too, if the coordinator can land it before P4 launches. F and G wait.

**Order by value and risk:** A, then B (the owner-noticed bug and the only unbounded growth), C, D, E, F, G.

**Memory rule for the builders:** one package worker at a time unless the coordinator says the box has room; each runs one small test process at a time and the fast check, with one full check per package at hand-off under the lease.

## 5. Decisions for the owner

1. **Files drag-and-drop works again** (F1). Recommended: yes.
2. **Chats list paints first, titles fill in** (F4), and ask Space to serve titles in the session list. Recommended: yes to both.
3. **Theme when the browser won't save** (F10): keep the new theme for this session and say it won't be remembered (recommended), or revert.
4. **GitHub sign-in after Settings closes** (F11): finishes in the background with a notice (recommended), or cancels.
5. **Small visible corrections:** GitHub detail failure line (F5), renamed project's inferred icon updates (F13), "couldn't undo" line (F16), quote jump lands on the right message and stops following (F24). Recommended: yes.
6. **Phone thread open focuses the heading, not the field** (F18). This is your 19 November rule; confirm.
7. **Working pill sized by CSS instead of JS** (F23), with one before/after screenshot pair, and permission for the small browser runs in E and G.
