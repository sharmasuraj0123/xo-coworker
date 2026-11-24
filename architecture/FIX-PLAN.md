# Fix plan for the modular codebase

Plan only. Nothing here is built until the owner approves its package. Round 1 (F1–F28, N1–N3) was read from `modular-gate-P3-group-05` (`0ef1bf97`), and Group 6's branch from `eda19fc3`. Round 2 folds in the independent quality audit (Q-…), rechecked on the integration head `0e9158f6`.

The owner's priority sets the bar: quality, system design and sound engineering before speed. Most findings are not separate bugs. They come from a few missing or unused contracts (C1–C6 in round 1, C8–C11 in round 2). The plan fixes each contract once, then moves each finding onto it, and adds a check so new code can't reintroduce the pattern.

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

Round 2 (the quality audit) shows four more patterns, between modules and under the checks rather than inside modules:

| Pattern | Audit findings | Contract |
|---|---|---|
| Written rules no check counts, so they hold in letter and fail in intent | H2, H5, H7, M2, M3, M8, L1, L6 | **C8 Conformance ratchets** |
| Modules wired through the app entry and one shared mutable `S` | H1, H3, L4 | **C9 Module boundaries and state ownership** |
| Tokens exist, but components restate values and themes per rule | H4, H5, H6, M7, L3 | **C10 Style system** |
| Tests pin source text, so they neither catch regressions nor allow refactors | H2, L5 | **C11 Tests test behaviour** |

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

Findings F27 and F28 move to the blazing-fast UI phase after P5. Use the [P3 measurements](HANDOFF.md#p3-exit-evidence) as the baseline.

### C8 Conformance ratchets (round 2)

**Rule.** Every written rule in `AGENTS.md` that a machine can count has a check. A check counts per file, keeps a baseline that may only go down, and fails on any new file above zero. A file a package touches leaves at zero on the rules listed for that package.

**Where.** `tools/conformance/`, grown from package A's `tools/lifecycle.mjs`: one runner, one parse per file, rule modules that each return counts, one baseline file per rule family in `tools/baselines/`. JS rules walk the `acorn` tree A already uses. CSS rules walk a parsed stylesheet (`postcss`, dev-only, the same kind of tool as `acorn`). Comment rules read comments from the same parse instead of the line scanner in `check.mjs:107–140`. `check.mjs` gains one `conformance` step.

**Rules it carries.** Source-reading tests (H2), `any` in JSDoc and `.d.ts` (H7), lines over 140 characters in hand-written sources (M3), top-level functions over 150 lines (H3), exports with no importer outside tests (L1), DOM expando writes (L6, N2), colour literals and `data-theme` selectors outside the token files (H4), px literals other than 0 and 1 by property class (H5), width media queries that aren't the one breakpoint (H6), changelog comments (M2), `.py` sources in the size ratchet (M9), dependency keys passed to `create*({…})` in the app entry and a parameter named `S` under `modules/` (H1).

**Rejected.** (a) One more ad-hoc step in `check.mjs` per rule: it already holds the line, `!important` and comment scans as separate text passes, and A deliberately kept the entry small. (b) Regex sweeps: the audit's own counts differ from mine by up to 4×, depending on the pattern (colours: 64 against 260). Counts from a parse are stable, so a baseline means something. (c) Turning rules on as hard errors at once: thousands of hits stop every package. Ratchets stop growth on day one and fall as packages touch files.

**Enforcement.** The runner is itself tested: each rule has a fixture that must count exactly N, and a deliberate break (a planted `any`, a planted `#fff`) must fail the step.

### C9 Module boundaries and state ownership (round 2)

**Rule.** Each piece of state has one owner module. Others read it through the owner's typed service and hear changes through the bus. Modules don't receive each other's functions through the app entry.

**Where.** The kernel already has `ctx.provide`, `ctx.use` and `ctx.on`. Add a typed service registry: an `interface Services` in `core/kernel/types.d.ts` that each module extends with its own entry (`declare module` merging), so `ctx.use("chats")` returns `ChatsService`, not `unknown`. Each owner keeps its state in a small typed store, `createStore<T>()` in `core/kernel/store.js`: `get`, `set(patch)`, `subscribe`, change published on the bus under the owner's topic.

**Rejected.** (a) Type `S` as one big interface: it would make shared mutable state official. (b) An app-wide store library: it brings back one central bag, under another name, plus a dependency. (c) Keep the dependency bags and type them: types don't stop module A from reaching into module B's internals.

**Enforcement.** C8's dependency-key and `S` ratchets. The kernel's conformance test (`live(id)` is 0 after disable) runs for every migrated module. The `layers` check stays, and with the bags gone it measures what it was meant to.

### C10 Style system (round 2)

**Rule.** Three tiers. Palette values live only in `core/ui/tokens.css` and `css/flavours.css`. Role tokens give each theme and flavour its meaning (`--sep`, `--edge-soft`, `--fill-hover`, `--fill-selected`, `--shadow-contact`). Components use roles only, and no component rule names a theme. Every length belongs to a token class by what it measures: spacing (`--s-*`) for padding, margin, gap and inset; control and icon sizes (`--h-*`, `--icon-*`); radii (`--r-*`); the hairline (`--hair`); elevation (`--e*`, `--lift-*`). JS reads durations, easing and the breakpoint from one module (`core/ui/tokens.js`, `core/platform/viewport.js`), never its own numbers. Where the owner's 21 November rule applies (size by content), a fixed width or height is removed, not tokenized.

**Why this and not the audit's codemod as written.** Mapping every 16 px to `--s-4` would tie an icon's width to the spacing rhythm. Changing the rhythm would then resize icons. The class of the property decides the token.

**Proof without a browser.** `tools/conformance/css-resolve.mjs` flattens the boot stylesheets in load order. It resolves every `var()` for each theme and flavour and writes one table: selector, property, layer, order and resolved value. A token-only commit must leave that table byte-identical. A move commit must leave the flattened sequence identical. Screenshot pairs then confirm each step once, as the coordinator asked, but a failure is caught before a browser runs.

**Rejected.** Screenshot pairs alone: they cover 20 views, not every rule, and each run is the heaviest thing this box does.

**Enforcement.** C8's style rules. A resolved-table test per step.

### C11 Tests test behaviour (round 2)

**Rule.** A unit test drives the module through its public factory or service and asserts on the DOM, the store or the API calls. A style test asserts on the parsed stylesheet or on C10's resolved table, never on source text. A test lives in its module's `tests/` folder.

**Where.** `core/ui/test-kit` gains `mountModule(def, fakes)` (kernel plus fake services) and `cssTable()` (C10's resolver). Existing linkedom patterns in `modules/*/tests` are the model.

**Enforcement.** C8's source-reading ratchet (175 test files read sources at `0e9158f6`). Each replaced assertion is proven by a deliberate break of the behaviour it now covers.

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
- When: after P5, with F28. Size S, risk low.

**F28. The startup stylesheet graph grew through `@import`s.**
- Facts: release and P3 both have 18 ordered links. Cold Chromium runs recorded 20 reachable stylesheets in release and 45 in P3. The P3 graph resolves without cycles, and the latest imports started at 371–458 ms against 64–110 ms in release. See [P3 exit evidence](HANDOFF.md#p3-exit-evidence).
- Options weighed:
  1. **Serve-time flattening in `serve.py`** (recommended): when serving a versioned stylesheet, inline its `@import`s in place, turning `@import url(x) layer(n)` into `@layer n { … }`, and apply the F27 URL rewrite. Sources stay one file per module; the browser gets the same one request per link as release. No build step, which keeps the project's "plain files" rule, and dev and production serve identically.
  2. Flatten into `index.html` links: index would have to know every module's sheet, against the module boundaries the modularization just drew.
  3. A build step (esbuild or lightningcss): fastest output but adds a build to a no-build app.
  4. Leave it: acceptable on warm loads, but keeps the waterfall and leaves F27 needing its own mechanism.
- Owner-visible: no; the cascade is unchanged when each import is inlined at its own position with its layer.
- Test: `serve.test.py` compares the flattened output against a hand-ordered fixture, with layer order, and checks no `@import` remains; one paired screenshot set (owner's permission) confirms rendering.
- When: after P5. Through P5, preserve stylesheet ownership, declared cascade and versioned static resolution. Size M, risk medium.

### New findings from this pass

- **N1.** Motion durations exist twice: `core/ui/motion.js:8–9` (`IN 280`, `MOVE 320`, `OUT 160`) and `core/ui/tokens.css:191` (`--dur-*`). JS should read the tokens once at boot. Also hard-coded durations in the dock (`300`, `360`) and Shells (`200`). After P4, with Group 6's code settled. Not visible if the values match.
- **N2.** DOM expandos hold state (`tdock._ch`, `el._mx`, `el._mxe`, `b._mxq`, `el._h` in `motion.js:76`). They escape types and survive redraws unpredictably. Replace with `WeakMap`s owned by each controller as each area is touched; add to the post-P4 audit.
- **N3.** Every storage access hand-wraps `try`/`catch` (43 references in 22 files); covered by C4.

### Audit findings (round 2)

Source: `QUALITY-AUDIT-P3-G6.md` (audit tree `bb4fef4d`, the Group 6 gate). Every finding was rechecked on the integration head `0e9158f6`, which adds package A. Line numbers are from `0e9158f6`. Counts come from my own sweeps; where they differ from the audit's, both are given.

**Q-H1. Hand-wired dependency bags and a shared untyped `S`.**
- Root cause, confirmed: `js/app.js:187` declares `S`; 28 files under `modules/` and `shell/` assign `S.*` (audit: 27). `js/app.js` has 92 `create*({…})` calls in 1,388 lines. Consumers type their own slice: `modules/threads/delete-view.js:7` declares `{ tDel, tDelLose }`, fields that never appear at the declaration.
- Fix: C9, module by module, together with the `activate(ctx)` migration (package K). For each module: give its slice of `S` an owner store, expose it as a typed service, move readers to `ctx.use`, delete the slice. `S` is gone when its last field is.
- Owner-visible: no. Regression check: C8's `S` and dependency-key ratchets; kernel conformance per migrated module.
- When: after the P4 gate (P4 is emptying `js/app.js`: 48 lines added and 208 removed on its branch). Size L, risk medium.

**Q-H2. Tests read source text.**
- Root cause, confirmed: 175 test files call `readFileSync` (audit: 93 that also `assert.match` on source). `tests/thread-page.test.mjs:6–10` reads `js/app.js`, `thread-page.js`, `message-items.js`, `thread-page-html.js` and `css/panel.css`.
- Fix: C11. Each package replaces the source-reading assertions about the files it changes, in its own commits. Package K replaces the rest module by module. Rejected: one big test-rewrite package. It would be written against code that packages B–F are still changing, and done twice.
- Owner-visible: no. Regression check: C8's source-reading ratchet.
- When: the ratchet now (H); the rewrites ride along with each package. Size L in total, S–M per package.

**Q-H3. Whole modules are one closure (46 functions over 150 lines).**
- Root cause, confirmed: `modules/files/files.js` 399 lines, `modules/map/map.js` 397, `modules/files/viewer.js` 395, `modules/chats/chats.js` 374, `shell/panel/panel.js` 360, each mostly one `create*` function.
- Fix: in K, for each module: pure model and view functions go into their own files (`modules/decisions/rank.js` is the pattern), and the factory keeps wiring and state. The extracted functions get direct unit tests. Rejected: splitting by line count alone; the result would be the same closure spread across files.
- Owner-visible: no. Regression check: C8 adds "top-level function over 150 lines" to the size ratchet.
- When: K, after P4. Size L, risk low per module.

**Q-H4. The light theme is per-component overrides.**
- Root cause, confirmed: `data-theme="light"` rules outside the token files: `css/light.css` 45, `css/flavour-swatches.css` 30, `css/panel.css` 24, `css/app.css` 12, `css/diffs.css` 6, `shell/sidebar.css` 4. `css/light.css:4–12` shows the cause. Dark separates with a fill step and light with a line, so each component restates its edge per theme. The structural intent has no role token.
- Fix: C10 role tokens for those intents, defined per theme and flavour, then delete the overrides. Rejected: moving the overrides into `tokens.css` unchanged; that relocates them without fixing anything.
- Owner-visible: no, proven by C10's resolved table, then one screenshot pair set.
- When: package J, step J2. Size M, risk medium (flavour-by-theme combinations).

**Q-H5. About 1,900 literal px values beside a spacing scale.**
- Root cause, confirmed: 1,907 on-scale px literals in `css/`, `shell/`, `modules/` and `core/ui/` (audit: about 1,960). `var(--s-*)` is used 639 times (audit: 383). The scale (`core/ui/tokens.css:168`) is 4, 8, 12 … 48 px. The values 2, 3, 5, 6, 10, 14 and 18 px aren't on it.
- Fix: C10 by property class, in two commits per area. First the token-only move, proven by an identical resolved table. Then a separate snapping and content-sizing pass that changes looks and goes to the owner.
- Owner-visible: the first step no; the second yes. **Owner decision** (see §5).
- When: package J, steps J3 and J4. Size L, risk medium.

**Q-H6. The phone breakpoint written in 61 places.**
- Root cause, confirmed: 52 CSS lines with `760` and 9 JS sites, in three forms: `matchMedia("(max-width: 760px)")` (`js/app.js:177`, `:814`; `modules/shells/dock-input.js:103`; `modules/chats/intel.js:106`; `modules/chats/setup.js:124`; `modules/map/map.js:87`), `innerWidth <= 760` (`shell/panel/panel.js:175`, `core/ui/lightbox.js:70`) and `innerWidth > 760` (`shell/panel/width.js:24`). The `innerWidth` form disagrees with CSS by the scrollbar's width.
- Fix: `core/platform/viewport.js` exports `PHONE` (one `MediaQueryList`) and `onViewport(fn)` through the scope. Every JS site uses it. CSS keeps one query string, enforced by C8, until package E can substitute `@custom-media`.
- Owner-visible: only at exactly the breakpoint, where JS and CSS now agree. No decision needed.
- When: the primitive in package I now. Each package converts its own sites (C: Chats and Shells; D: Map). The app entry and panel sites go after P4. Lightbox goes after B merges. Size S, risk low.

**Q-H7. 728 `any` (audit 829); three files unchecked.**
- Root cause, confirmed: `modules/files/markdown-page.js` has 42; `modules/launchpad/page.js` and `window.js` have no `// @ts-check`; `jsconfig.json:12` `checkJs: false`.
- Fix: C8 ratchet now. CodeMirror is typed from its own `.d.ts` files through `modules/files/cm-types.d.ts`. Each package clears `any` in the files it touches. `checkJs: true` goes in when the opt-outs are zero (end of K).
- Owner-visible: no. When: ratchet in H; CodeMirror types in K (Files). Size M.

**Q-M1. Three repaint helpers keyed by an expando.**
- Root cause, confirmed: `core/ui/patch.js:6–18` wraps `redraw` and then guesses focus again from `data-*` attributes. `core/ui/motion.js:76` `setHtml`. Both memo on `el._h`. Used by 8 files: `modules/conversation/notice-line.js`, `modules/artifacts/cards.js` and `page.js`, `modules/home/view.js` and `handled.js`, `shell/workspace-header.js`, `shell/top-header.js`, `core/ui/motion.js`. 196 expando writes in total.
- Fix: C5 completed. `redraw()` memoizes in a `WeakMap`, and any focus case `patch` rescued becomes a `redraw.js` test and fix. `patch.js` and `setHtml` are deleted. Rejected: keeping `patch` as a "safe" wrapper; two paths drift apart.
- Owner-visible: no. Regression check: the C8 expando ratchet; a DOM test per case `patch` handled.
- When: package D (none of those files are in P4's or B's diffs). Size S–M, risk low.

**Q-M2. About 115 changelog comments.**
- Root cause, confirmed: for example `js/app.js:617` ("Astra C058 on 517af1c"). `REF` (`tools/check.mjs:107`) has no pattern for reviewers, hashes, QA numbers or owner dates. My broad sweep finds 169 candidates, some of them false positives.
- Fix: C8's comment rule, with the audit's patterns, covering `css/` and `serve.py`, baselined. Each package rewrites the hits in the files it touches as one-line present-tense reasons, or deletes them. The `js/app.js` hits go with P4 or K.
- Owner-visible: no. When: rule in H; rewrites ride along. Size S per package.

**Q-M3. Lines packed to pass the 400-line limit.**
- Root cause, confirmed: `core/ui/icons/xoicons.js` has 331 lines over 160 characters (it is generated), `modules/launchpad/views.js` 62 (the longest is 721), `modules/conversation/conversation.css` 43.
- Fix: C8 line-length ratchet at 140, with generated files exempt. Typedefs move to `*-types.d.ts`; templates split into view functions in K.
- Owner-visible: no. When: rule in H; burn-down in K. Size M.

**Q-M4. Time and count wording implemented about six times.**
- Root cause, confirmed: `DAY = 86400000` in `core/services/world/list-time.js:2`, `modules/artifacts/model.js:7`, `modules/github/page.js:10` and `modules/since/model.js:8`. A "within six days" rule appears in both `core/services/runtimes.js:60` and `core/services/world/held.js:18`. `plural` appears in `core/services/git-state.js:8`, `modules/since/model.js:11` and `modules/runs/view.js:64` with one signature, and in `js/app.js:180` with another that returns only the word. `modules/decisions/rank.js:37,45` adds two more formatters.
- Fix: `core/platform/time.js` owns the clock, day, relative and until formats with named styles (for example `short` "4m" and `prose` "4 min ago"), on its cached formatters. `core/platform/words.js` owns `plural` and `count`. Each surface keeps the format it shows today by choosing the matching style, so the first step changes no text. Where a surface's output matches neither style, I list it for the owner instead of guessing. Rejected: one format everywhere; a visible change decided by a refactor.
- Owner-visible: no in the first step. Regression check: table tests of each style; C8 duplicate-constant rule (`86400000` outside `time.js`).
- When: package I for `core/`, Since and Artifacts; the GitHub, Runs and Decisions sites in D, C and F; `js/app.js` after P4. Size M, risk low.

**Q-M5. The conversation exists twice, through global IDs.**
- Root cause, confirmed: `modules/conversation/thread-page.js:31–40` looks up the panel copy by `#t…` IDs. There are 29 `:is(#msgs,#tmsgs)` selectors in `modules/conversation/msgx.css` and 19 in `core/ui/markdown/rich.css`.
- Fix: a conversation instance mounted on a root, looked up relative to the root and styled by class. `createConv` already takes its elements. Rejected: generating the `t` IDs from a prefix; still global, still ID specificity.
- Owner-visible: no, but switching from ID to class selectors changes specificity, so this needs C10's resolved table and a screenshot pair.
- When: package F (after P4; P4 touches `modules/conversation/main-decoration.js` and `lightbox.js`). Size M, risk medium.

**Q-M6. Focus after counted frames; the composer `held` workaround; bare delays.**
- Root cause, confirmed: `js/app.js:628–643` keeps an empty Home composer from shrinking under a press. It has its own capture listeners and a 600 ms touch allowance, which copies `core/ui/redraw.js:21–29` (`pressed`, the same 600 ms). There are 46 `setTimeout` calls with literal delays.
- Fix: C6 extended. Focus happens in the same task as the commit through `focusEntry`; no counted frames. The press tracker becomes one export of `core/ui/press.js`, used by `redraw.js` and the composer. The composer's shrink waits on `:focus-within` plus "no press in flight", so `held` and its listeners go. Delays become named durations in `core/ui/tokens.js` (N1).
- Owner-visible: no, if the shrink timing is kept. **Owner decision** if they'd rather the composer simply not shrink on blur.
- When: F (after P4). Size M, risk medium.

**Q-M7. 2,009 lines of module rules in two global sheets.**
- Root cause, confirmed: `css/app.css` has 1,377 lines and 18 `@import`s; `css/panel.css` has 632. `shell/kernel.js:12` `addModule` is never called.
- Fix: C10's order-preserving move. Cut `css/app.css` into consecutive chunks in its current order; each chunk goes to the owning module's sheet, and `css/app.css` becomes a pure import list in the same order. The flattened sequence is then identical by construction, and C10's tool proves it. Rejected: moving rules into sheets that are already imported at the top; that reorders the cascade.
- Owner-visible: no. Request count goes up until package E flattens at serve time, which the owner accepted (the speed work comes later).
- When: package J, step J1. Size M, risk low.

**Q-M8. Lint has correctness off.**
- Root cause, confirmed: `.oxlintrc.json:4`.
- Fix: correctness on, suspicious as warnings, today's hits baselined in `tools/baselines/lint.json`. Each package clears hits in its files.
- Owner-visible: no. When: H. Size S.

**Q-M9. `serve.py` is 736 lines and outside the size rule.**
- Root cause, confirmed: `tools/check.mjs:12` `SOURCE_DIRS` covers JS and CSS only.
- Fix: `.py` joins the size ratchet in H at today's size. Split into `serve/static.py`, `proxy.py`, `ws.py` and later `css.py` as the first step of E. Rejected: splitting now; E is deferred past P5 and nothing else changes the file.
- When: ratchet in H; the split in E. Size M.

**Q-L1. Dead exports.**
- Root cause, confirmed: `modules/decisions/rank.js:37` `fmtMin` and `:45` `fmtAgent` have no importer.
- Fix: C8 exports rule; deletions in the owning package (these two in F).

**Q-L2. Thread search written twice with different fields.**
- Root cause, confirmed: `shell/panel/lists.js:17` matches title, sub, summary and branch; `modules/threads/all.js:28` leaves out `sub`.
- Fix: one `matchThread(t, q)` in `core/services/world`, used by both.
- Owner-visible: All threads also matches the subtitle. Small; listed in §5. When: D. Size S.

**Q-L3. Easing defined twice.** `core/platform/motion.js:4` and `core/ui/tokens.css:188`. Fix with N1 through `core/ui/tokens.js` in package I. Not visible if the values match, proven by a test that compares the JS value with the token.

**Q-L4. Cryptic names** (`S`, `D`, `TP`, `LPP`, `.stg-`, `.shd-`). Renamed at the service boundary as K moves each module, and CSS prefixes as J moves each sheet. Not visible.

**Q-L5. Tests away from their modules** (213 in `tests/`, 85 in module folders). Moved as each package touches a module; K finishes. Not visible.

**Q-L6. 196 DOM expando writes.** C8 ratchet in H; N2's `WeakMap` rule as each area is touched.


## 4. Fix packages

Each package is one branch from the latest gate, in small commits: the contract or test first, then one finding per commit with its deliberate-break proof. New tests go in the module's own `tests/` folder (C11). Baselines and the ledger are regenerated by the integrator at merge, never merged by hand.

**Leave touched files clean.** From package H on, every file a package changes leaves at zero on these C8 rules: comment-only catch, changelog comments, `any`, source-reading assertions about that file, the breakpoint and expandos. Splitting oversized closures (Q-H3) is K's work, not every package's.

| # | Package | Findings | Owns (files) | When | Size | Risk | Visible |
|---|---|---|---|---|---|---|---|
| **A** | Contracts | C1–C4, `lifecycle` check | merged at `0e9158f6` | Done | M | — | No |
| **B** | Files and media | F1, F2, F3 | `modules/files/*`, `core/services/media/*`, `core/ui/lightbox.js` (as on `modular/fix-b`) | In progress. Scope unchanged; its lightbox breakpoint site goes to K | M | Medium | F1 (approved) |
| **H** | Conformance (new) | C8; the rules for Q-H1, H2, H3, H4–H7, M2, M3, M8, M9, L1, L6; C10's resolver `css-resolve.mjs` | `tools/conformance/*` (new, absorbs `tools/lifecycle.mjs`), `tools/check.mjs`, `tools/baselines/*.json` (new families), `.oxlintrc.json`, `package.json` and lock (`postcss`, dev-only), `AGENTS.md` | **Now**: tools only; the only overlap with P4 is regenerated baselines | M | Low | No |
| **I** | Platform wording and viewport (new) | Q-H6 primitive, Q-M4 (`core/`, Since, Artifacts) | `core/platform/viewport.js` (new), `core/platform/time.js`, `core/platform/words.js` (new), `core/services/runtimes.js`, `core/services/world/held.js`, `list-time.js`, `core/services/git-state.js`, `modules/since/model.js`, `modules/artifacts/model.js` | **Now**, after H | S–M | Low | No |
| **C** | Reads and timers, widened | F4, F7, F8, F11, F14, F15, F16; Q-H6 sites in Chats and Shells; Q-M4 in Runs | round 1 list plus `modules/chats/setup.js`, `modules/runs/view.js` | **Now**, after H and I | M | Medium | F4, F11, F16 (approved) |
| **D** | Redraw, focus and UI primitives, widened | F5, F6, F10, F12, F13, F17; Q-M1, Q-L2, Q-L3, N1; Q-H6 in Map; Q-M4 in GitHub; `core/ui/press.js` for Q-M6 | round 1 list plus `core/ui/redraw.js`, `core/ui/patch.js` (deleted), `core/ui/motion.js`, `core/platform/motion.js`, `core/ui/tokens.js` (new), `core/ui/press.js` (new), the 7 `patch`/`setHtml` callers, `shell/panel/lists.js`, `modules/threads/all.js`, `core/services/world` (matcher) | **Now**, after H and I. None of these files are in P4's or B's diffs | M | Low | F5, F10, F13 (approved); Q-L2 (§5) |
| **J** | Style system (new) | J1 Q-M7 order-preserving ownership; J2 Q-H4 role tokens; J3 Q-H5 token-only move; J4 Q-H5 snapping and content sizing; J5 the breakpoint check to zero | `css/*`, module and shell stylesheets, `core/ui/tokens.css`, `css/flavours.css`. The conversation sheets (`msgx.css`, `conversation.css`, `rich.css`) wait for F | J1–J3 **can start now** (P4's branch changes no CSS), after H, when the coordinator has a worker slot. J4 needs the owner | L | Medium | J1–J3 no, proven by the resolved table plus one screenshot pair set each. J4 yes |
| **F** | Conversation and decisions, widened | F18–F24, N2 for the dock; Q-M5, Q-M6, Q-L1 (`fmtMin`, `fmtAgent`), Q-M4 in Decisions | `modules/conversation/*`, `modules/decisions/*`, `js/decide.js`, `shell/overlays.js`, the conversation sheets | **After the P4 gate** (P4 changes `main-decoration.js`, `lightbox.js` and the app entry) | L | Medium | F18, F23, F24 (approved); Q-M6 (§5) |
| **K** | Module boundaries (new; takes over G's `activate(ctx)` migration) | Q-H1, Q-H3, Q-H7 (CodeMirror types, `checkJs: true`), Q-H2 and Q-M3 burn-down, Q-L4, Q-L5, the app-entry sites of Q-H6, Q-M2 and Q-M4 | one module per slice. Leaf modules first (Since, GitHub, Runs, Worktrees, Rules, Routing), Settings, Files, Map and Chats next, Conversation and Decisions last, then the app entry | **After the P4 gate, before P5**. Runs after F for Conversation and Decisions | L (days) | Medium | No |
| **G** | Measure | F9, F21's trace, F25, F26 | as measured | After the P4 gate, in the same browser session as J's screenshot pairs | S | Low | No; browser time needs the owner |
| **E** | Static serving, widened | F27, F28; Q-M9 split first; `@custom-media` for the breakpoint | `serve.py` → `serve/*`, `tests/serve.test.py` | **After P5** (blazing-fast UI phase, the owner's ruling) | M | Medium | No |

### Order and parallelism

1. **Now, beside P4's revision:** B finishes. Then H, which is small, tools-only and changes the baseline every later package is measured against. Then I. Then C and D in parallel: their files are disjoint from each other, from B and from P4's branch (`2c3c409b`). If the worker limit allows a third, J1–J3 can run, since no open branch touches CSS.
2. **After the P4 gate:** F. K starts with leaf modules in parallel with F and reaches Conversation and Decisions after F merges. G and J's screenshot pairs share one browser session under the lease. J4 waits for the owner's call.
3. **Before P5:** everything except E. The independent audit that HANDOFF requires before P5 runs on a tree where every C8 ratchet has been falling.
4. **After P5:** E.

**Why H goes first.** Without it, C and D would each fix their files and nothing would stop the next change from undoing it. With it, every package from here on is measured, and the ratchets show progress as numbers that only go down.

**Memory rule for the builders:** at most the coordinator's worker limit; one small test process each; the fast check while working and one full check per package at hand-off under the lease. Screenshot pairs only with the owner's permission, one browser project-wide.

### What changes nothing visible

No visible change (proven by tests; style steps by C10's resolved table, then a screenshot pair set): H, I, Q-H1, Q-H2, Q-H3, Q-H4 (J2), Q-H5's first step (J3), Q-H7, Q-M1, Q-M2, Q-M3, Q-M4's first step, Q-M5 (specificity risk, so table and screenshot pair), Q-M7 (J1), Q-M8, Q-M9, Q-L1, Q-L3, Q-L4, Q-L5, Q-L6.

Visible: Q-H5's second step (J4), Q-L2 (All threads also matches subtitles), and Q-M6 only if the owner chooses to drop the shrink. Q-H6 changes behaviour only at exactly 760 px, where JS and CSS now agree.

## 5. Decisions for the owner

**Round 1: approved** on 24 November 2026 (cmsg_7396f7976c094d49), all seven on the recommended options: F1, F4 with the Space title request, F10 keep for the session, F11 finish in the background, the small corrections (F5, F13, F16, F24), F18, and F23 with its screenshot pair.

**Round 2: new decisions**

1. **Spacing values off the scale** (J4: 2, 3, 5, 6, 10, 14 and 18 px). Recommended: snap to the 4 px scale and keep only named optical tokens for 1–3 px nudges, reviewed on screenshot pairs. The alternative is to add the frequent values to the scale.
2. **Size by content app-wide** (J4). Apply your 21 November rule wherever a fixed width or height can be replaced by content sizing, reviewed on screenshot pairs. Recommended: yes.
3. **The empty Home composer's shrink on blur** (Q-M6). Recommended: keep the shrink and rebuild it so a click can't miss, with no workaround and no visible change. The alternative is to stop shrinking.
4. **All threads search also matches the subtitle**, like the panel's search (Q-L2). Recommended: yes.
5. **Browser runs for proof.** One screenshot pair set for each of J1–J4, F's selector change (Q-M5) and F23, each under the lease, one at a time. Recommended: allow these. The alternative is to batch them into P5, which makes a mismatch hard to trace to its step.

**For the coordinator, not the owner:** H adds `postcss` as a dev-only tool next to `acorn`. The app still ships plain files with no build.
