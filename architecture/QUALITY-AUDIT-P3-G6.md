# Code-quality audit: modular codebase at `modular-gate-P3-group-06`

Tree: `bb4fef4d9629d24448eb09a6ab8183e7912a3662` (read from `git rev-parse`). Read-only; no code changed.
Bar: a production codebase, plus the rules in `AGENTS.md` and the owner's standing rules.
Cross-checked against `architecture/FIX-PLAN.md` on `modular/fix-a` (packages A–G). Each finding is marked **NEW**, **EXTENDS <id>** (the plan has it, but the scope found here is wider), or listed in §4 as already covered.

Counts are from scripted sweeps over `core/ shell/ modules/ apps-host/ js/app.js css/` (sources only, vendor and tests excluded unless stated). They're good enough to rank by, not exact.

## 1. Headline

| Severity | New | Extends the fix plan | Total |
|---|---|---|---|
| High | 6 | 1 | 7 |
| Medium | 6 | 3 | 9 |
| Low | 4 | 2 | 6 |
| **All** | **16** | **6** | **22** |

The good parts are real. The kernel (`core/kernel`) is small and has a clear contract. The `layers` and `ratchets` checks run on every commit. `@ts-check` is on all but 3 files. `follow.js` is the one owner of scroll. `core/platform/http.js` and `pending.js` are sound. `apps-host/` is the cleanest area in the tree.

Most of what's left is not inside modules. It sits **between** them and **under** the checks:

1. **Modules are wired together by hand in the app entry.** That wiring gets past the layer check. (H1, H3)
2. **The tests pin source text rather than behaviour.** That makes every fix package expensive. (H2)
3. **The style system has tokens, but most CSS doesn't use them, and nothing enforces it.** (H4, H5, H6)
4. **Several checks can be passed in letter while their intent is missed.** Long lines get past the line limit, `any` gets past types, and changelog-style comments get past the comments rule. (H7, M2, M3)

## 2. Findings, ranked

### High

**H1. Modules are coupled through hand-wired dependency bags and one shared, untyped, mutable `S`.** NEW (the `activate(ctx)` migration in package G is the end state for the wiring part; the state part is not in the plan)
- Where:
  - `js/app.js` builds about 95 `createX({...})` factories and passes functions from one module into another. `createShellRenderer` (`js/app.js:1248`) takes 35 dependencies, `createThreadPage` (`js/app.js:675`) 31, `createConversationHeader` 25 and `createDelivery` 24.
  - `const S = {...}` at `js/app.js:187` is one mutable bag of about 30 fields. It is written by 27 files across 8 modules and the shell: `modules/launchpad/*`, `modules/home/*`, `modules/conversation/*`, `shell/navigation.js`, `shell/panel/panel.js` and others.
  - Each consumer declares its own partial shape of `S`, for example `modules/conversation/notices.js:7` (`_her`) and `modules/threads/delete-view.js:7` (`tDel`). Fields are added by consumers and never appear at the declaration, so no single type for `S` exists.
- Why it matters:
  - `AGENTS.md` says modules never import each other and talk through services, places and the bus. Injection gets past that rule: `layers.json` reports the tree as clean while modules call each other's internals through app.js.
  - With `S`, any module can change state another module reads, with no owner and no change event. This is how "fixed here, broken there" happens.
- Root fix:
  - Give each piece of state one owner: a typed store in its module, exposed as a kernel service (`ctx.provide` / `ctx.use`), with change notification through the bus.
  - Delete `S`.
  - Replace dependency bags with services, one module at a time, as part of the `activate(ctx)` migration in G.
  - Add a check that counts the keys of the object a `create*({...})` call receives in the app entry, as a ratchet that may only go down, and that forbids a parameter named `S` under `modules/`.

**H2. About 570+ unit-test assertions read source text instead of testing behaviour.** NEW
- Where: 93 unit-test files call `readFileSync` on a `.js`, `.css` or `.html` source and `assert.match` against it (a scripted lower bound; helper indirection hides more). The worst:
  - `tests/thread-page.test.mjs` (59). Lines 6–31 assert exact statements, such as `/TP\.follow = createFollow\(els\);/` and `/if \(!t\) \{ STAGE\.closePage\("thread"\); return; \}/`.
  - `tests/chats-list.test.mjs` (46).
  - `tests/panel-parity.test.mjs` (28). Lines 19–26 assert app.js code verbatim.
  - `tests/pack-where-it-fits.test.mjs` (26), `tests/stage-pages.test.mjs` (22).
  - `tests/row-insets.test.mjs:13–18` asserts whole CSS rule strings.
- Why it matters:
  - These tests pass when behaviour is broken, as long as the text is unchanged.
  - They fail when correct code is restructured. Every FIX-PLAN package (A–F) touches code these assertions pin, so each fix will also have to rewrite tests that never tested anything.
  - They violate the owner's rule of tests that check behaviour.
- Root fix:
  - Replace each one with a DOM test through the module's public factory. The linkedom pattern already exists, for example `modules/*/tests`.
  - Replace each CSS-text assertion with a conformance test that parses the stylesheet (rule to declarations) and checks token use, not spelling.
  - Add a `source-reading` ratchet to `tools/check.mjs`: count `readFileSync` of non-fixture sources per test file, with a baseline that may only go down.

**H3. Logic lives inside 46 large factory closures, and that is why tests read source.** NEW
- Where: 46 top-level functions run past 150 lines, most of them a whole file. Examples:
  - `modules/files/viewer.js:23` `createFileViewer` (372 lines)
  - `modules/map/map.js:26` `createMap` (371)
  - `modules/files/files.js:38` `createFiles` (361)
  - `modules/chats/chats.js:19` `createChats` (355)
  - `core/services/shape/store.js:24` (332), `core/ui/lightbox.js:36` (329), `shell/panel/panel.js:32` `createStage` (328), `modules/launchpad/actions.js:8` (326)
- Why it matters:
  - Inner functions can't be imported, so they can only be tested through the DOM or by reading the source (H2).
  - Private state is shared by everything in the closure.
  - The file limit pushes these to just under 400 lines (M3) instead of splitting them.
- Root fix: in each closure, split the pure model and view functions into their own files and keep only wiring and state inside the factory. `modules/decisions/rank.js` and `modules/files/version-time.js` already follow this pattern. Do it per module while that module is being fixed, and test the extracted functions directly.

**H4. The light theme is about 130 per-component overrides with raw colours, not role tokens.** NEW
- Where:
  - Rules starting with `:root[data-theme="light"] .x {…}` outside `tokens.css` and `flavours.css`: `css/light.css` 45, `css/flavour-swatches.css` 30, `css/panel.css` 24 (for example `:61–62`, `:290`, `:302–303`, `:316`), `css/app.css` 12, `css/diffs.css` 6, `shell/sidebar.css` 4, `core/ui/components/xo-select.css` 4, and others.
  - 64 hex or `rgba()` literals outside the token files, for example `css/light.css` (`rgba(0,0,0,.07)` and `.12` on sidebar icons) and `css/foundation.css:22`.
- Why it matters: a component's light look is defined in a second file from its dark look, and both have to be edited together. That is the "fixed here, broken there" risk the owner named, and it breaks "every visual change via shared tokens, app-wide".
- Root fix:
  - Add the missing role tokens per theme in `core/ui/tokens.css`: line-soft and line-strong, hover and selected fills, contact shadow, knob shadow.
  - Point the components at the roles and delete the per-component light rules.
  - Add a `style-literals` ratchet to `check.mjs`: colour literals and `data-theme` selectors per file outside `tokens.css` and `flavours.css`, with a baseline that may only go down.

**H5. About 1,960 literal spacing values in pixels sit beside an existing spacing scale.** NEW
- Where: scale values (2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32 px) appear 925 times in `css/`, 710 in `modules/`, 222 in `shell/` and 102 in `core/ui/`. `css/app.css` alone has 724 px literals. Meanwhile `--s-1…--s-12` exist (`core/ui/tokens.css:168`) and are used only 383 times. Type sizes are fully tokenized (1 literal `font-size` left).
- Why it matters: `AGENTS.md` says "tokens only, no literal colours or sizes". Nothing checks it, so the rule holds for type and fails for spacing. Changing the spacing rhythm today means editing about 2,000 places.
- Root fix:
  - Run a mechanical codemod that maps values on the scale to `var(--s-n)`, and give hairlines a `--hair` token.
  - Values off the scale (3, 5, 9, 10, 14, 18, 22 px) are design decisions: either add them to the scale or snap them, with the owner's eye on a screenshot pair.
  - Add the same `style-literals` ratchet, counting px literals other than 0 and 1.
  - This is a no-look-change move first, then a separate snapping pass.

**H6. The phone breakpoint is hard-coded in 58 places, in three spellings.** NEW
- Where:
  - 49 CSS `@media (max-width:760px)` queries, for example `core/ui/tokens.css:289–290` and `core/ui/markdown/rich.css:101`.
  - 9 JS sites:
    - `js/app.js:177` and `:814`
    - `shell/panel/panel.js:175` (`innerWidth <= 760`)
    - `shell/panel/width.js:24` (`innerWidth > 760`)
    - `core/ui/lightbox.js:70` (`W <= 760`)
    - `modules/chats/setup.js:124`
    - `modules/chats/intel.js:106`
    - `modules/map/map.js:87` (`"(max-width:760px)"`)
    - `modules/shells/dock-input.js:103`
- Why it matters: `innerWidth` and `matchMedia` disagree near the edge, because of scrollbars and zoom. Changing the breakpoint, or adding a tablet one, means editing 58 places, and no rule exists for it.
- Root fix:
  - Create `core/platform/viewport.js`, exporting one `PHONE` MediaQueryList plus a subscription; every JS site uses it.
  - CSS can't put a variable in `@media`. If package E's serve-time flattening lands, add an `@custom-media --phone` substitution to that same step. Until then, a check that every `@media` width query uses exactly the one breakpoint string.

**H7. Types are nominal in places: 829 `any`, and 3 sources unchecked.** NEW
- Where:
  - `any` per file:
    - `modules/files/markdown-page.js` 42. Plain strings are typed `any` (`:43` `rowLine(/** @type {any} */ list)`, `:47`, `:50`).
    - `modules/files/documents.js` 30, `modules/files/editor.js` 26, `core/ui/lightbox.js` 23, `modules/artifacts/store.js` 22, `modules/create-project/create.js` 21, `modules/runtimes/settings.js` 20, `modules/artifacts/page.js` 20.
    - `core/services/shape/store.js:6` types its whole sync state with `any` fields.
  - Without `// @ts-check`: `modules/launchpad/page.js`, `modules/launchpad/window.js`, and `js/app.js` (P4's).
  - `jsconfig.json` has `checkJs: false`.
- Why it matters: the owner asked for real types. `@ts-check` plus `any` satisfies the checker while checking nothing. The CodeMirror surface (`editor.js`, `markdown-page.js`) is typed `any` end to end, though `@codemirror/*` ships its own `.d.ts` files.
- Root fix:
  - Add an `any` ratchet per file in `check.mjs`.
  - Type CodeMirror from its own declarations through one `modules/files/cm-types.d.ts`.
  - Add `@ts-check` to the two launchpad files.
  - Set `checkJs: true` once the opt-outs are zero.

### Medium

**M1. Three redraw helpers, keyed by a DOM expando.** EXTENDS C5 and N2
- Where:
  - `core/ui/redraw.js` is the real one.
  - `core/ui/patch.js:6–18` runs `redraw` and then guesses the focused node again from `data-*` attributes. If `redraw` keeps nodes, this second guess shouldn't be needed.
  - `core/ui/motion.js:76` `setHtml` is `innerHTML` with a cache, living in the motion module.
  - All three key on `el._h`, written 66 times. There are 177 expando writes across 55 files, far more than the five N2 lists.
  - There are 192 `innerHTML =` assignments.
- Why it matters: three ways to repaint, and different focus behaviour depending on which one a surface picked.
- Root fix:
  - One `redraw(el, html)` that skips unchanged HTML through a `WeakMap`, not `_h`.
  - Delete `patch.js` and `setHtml`. Where `patch` restores focus, that is a redraw bug to fix in `redraw.js`.
  - N2's WeakMap rule then covers the rest.

**M2. About 115 comments are a changelog: they cite reviewer IDs, commit hashes, QA numbers, plan steps and owner timestamps.** NEW
- Where:
  - Review IDs and hashes:
    - `js/app.js:617` ("Astra C058 on 517af1c")
    - `js/app.js:651` (Astra H26), `:582`, `:594`, `:865`, `:957`, `:978`, `:1011`, `:1029`, `:1037`
    - `js/app.js:377` ("Launchpad grader on 842a6d1")
    - `css/foundation.css:164` ("on 8aa58d3, S135")
  - Plan and QA references:
    - `js/app.js:825` ("P1 step 8")
    - `js/app.js:380` ("the owner's choice B")
    - `js/app.js:706` (QA #9)
    - `css/phone.css:4` (QA #22) and `:24` (QA #23)
    - `css/panel.css:555` ("P2")
  - Owner provenance:
    - `css/docs.css:9`, `:42`, `:132`
    - `modules/files/documents.js:9` and `:151`
    - `core/ui/tokens.css:151` and `:156`
    - `css/panel.css` (12 of them)
  - By scripted count: 80 cite reviewers, hashes or QA numbers, and 34 cite the owner with dates.
- Why it matters: it breaks the owner's comment rule ("never one that points at a plan… or a doc"). The comments ratchet's `REF` pattern (`tools/check.mjs:108`) misses all of these. They also go stale as soon as the code moves.
- Root fix:
  - Rewrite each as a present-tense "why" in one line, or delete it.
  - Extend `REF` with `Astra|grader|Codex|QA #\d|\b(on|at) [0-9a-f]{7,}\b|\bP\d\b|the owner|\d{1,2} Nov`, and add `css/` and `serve.py` to the refs baseline at 0.

**M3. The 400-line limit is passed by packing lines; six files sit at 391–399.** NEW
- Where:
  - Over 30 source files have more than 18 lines longer than 160 characters.
  - `shell/panel/panel.js:57` is an 845-character template.
  - `modules/launchpad/views.js` has 62 lines over 160 characters, one of them 721 (`:250`).
  - `core/services/shape/store.js:6` and `shell/gestures.js:12` are 600+ character typedef lines.
  - At the limit: `modules/files/files.js` (399), `modules/map/map.js` (397), `modules/files/viewer.js` (395), `core/ui/icons/xoicons.js` (392), `core/services/shape/store.js` and others.
- Why it matters: the size rule exists for readability, and a 400-line file that is really 700 lines' worth of code defeats it. Reviews and diffs on 800-character lines are unreadable.
- Root fix:
  - A line-length limit (for example 140) on hand-written sources, generated files exempt (`modules/changes/diffthemes.js`, `core/ui/icons/xoicons.js`), as a ratchet per file.
  - Move multi-type typedefs into the module's `*-types.d.ts`; the pattern already exists.
  - Split HTML templates into small view functions (follows H3).

**M4. Time and number wording is implemented about six times.** NEW
- Where:
  - `core/platform/time.js:12–21` caches its formatters because building one per call costs 25 ms per redraw (its own comment).
  - These sites build them per call anyway, or repeat the same rule:
    - `core/services/runtimes.js:53–61` `clockWords`
    - `core/services/world/held.js:10–19` repeats runtimes' "within 6 days → weekday" rule at `:18`
    - `core/services/world/list-time.js:2`
    - `modules/files/version-time.js:3`
    - `modules/launchpad/words.js:29` `ago`
    - `modules/artifacts/cards.js:56`
  - `DAY = 86400000` is defined four times: `modules/github/page.js:10`, `modules/since/model.js:8`, `modules/artifacts/model.js:7`, `core/services/world/list-time.js:2`.
  - `plural` is defined four times with two signatures: `js/app.js:180`, `core/services/git-state.js:8`, `modules/since/model.js:11`, `modules/runs/view.js:64`.
- Why it matters: "4 min ago" in one place and "4m" in another is the visible symptom, and the performance fix in `time.js` applies to only one of the six.
- Root fix: `core/platform/time.js` owns clock, day, relative, until and `DAY`, all on cached formatters. `core/platform/words.js` (new) owns `plural` and `count`. Delete the copies.

**M5. The conversation is a two-instance component built on global IDs.** NEW
- Where:
  - The main chat uses `#msgs`, `#say` and `#scroller`. The panel's thread page copies them with a `t` prefix (`#tmsgs`, `#tsay`, `#tscroller`) in `modules/conversation/thread-page-html.js`, about 20 IDs.
  - `modules/conversation/thread-page.js:31–40` builds its composer from `$("#t…")`.
  - 51 CSS selectors of the form `:is(#msgs,#tmsgs)`: `modules/conversation/msgx.css` 28 and `core/ui/markdown/rich.css` 19.
- Why it matters: a third surface (a split view, a pop-out) would mean editing about 50 selectors and a second set of lookups. Specificity from ID selectors also forces overrides.
- Root fix:
  - Mount the conversation and the composer as instances on a root element.
  - Style by class (`.conv`, `.composer`).
  - Query relative to the root. `createConv` already takes its elements as arguments, so most of the change is in the markup and the CSS.

**M6. Timing workarounds wait for the DOM, and delays are bare numbers.** EXTENDS C6 and N1
- Where:
  - Focusing after a double `requestAnimationFrame`, or a `requestAnimationFrame` plus `setTimeout`:
    - `shell/panel/panel.js:231`
    - `js/app.js:811`
    - `modules/decisions/conversation-actions.js:16`
    - `modules/home/view.js:106`
    - `modules/conversation/thread-page.js:72`
    - `modules/map/after-pause.js:12`
  - `js/app.js:628–643` adds a `held` class to the composer from `pointerdown` until `click`, so that a blur-driven shrink doesn't move the target under the pointer. This patches a layout jump instead of removing it.
  - 37 `setTimeout` calls with literal milliseconds, for example `shell/back.js:19–21`, `modules/conversation/navigation.js:16–21`, `modules/create-project/create.js:119`, `:122` and `:182`.
- Why it matters: frame-counting breaks under load (this page is never idle), and each delay is a guess no one can tune from one place.
- Root fix:
  - `redraw` returns once the new nodes are committed, and the caller focuses through C6's `focusEntry` in the same task.
  - The composer keeps its size on blur when a press is in flight, so `held` can go: decide the empty composer's shrink in CSS on `:focus-within` with a transition delay token.
  - Name delays in one `core/ui/durations.js` that reads the tokens (N1).

**M7. CSS is not modular yet: 2,000 lines of module rules in two global sheets.** EXTENDS F28 (package E)
- Where:
  - `css/app.css` has 1,377 lines. It holds module rules (prefix counts: `.rn-` runs 101, `.tb-` 87, `.shd-` shells 75, `.dg-` 65, `.vw-` viewer 60, `.rt-` runtimes 58, `.fl-` files 58, `.md-` made 55) and pulls in 18 module sheets by `@import` (`css/app.css:1–18`).
  - `css/panel.css` has 632 lines.
  - `shell/kernel.js:12` `addModule` links a module's own `manifest.styles` but is never called (L1).
- Why it matters: a module's look is not owned by the module, so removing or changing a module means editing global sheets. F28 fixes the request waterfall but not ownership.
- Root fix:
  - Move each prefix's rules into its module's sheet.
  - Declare sheets in each module's manifest and link them through `addModule`, keeping the cascade order with `@layer`. Package E's flattening then serves them as one request.
  - Ratchet `css/app.css` and `css/panel.css` downward to zero.

**M8. Lint is minimal.** NEW
- Where: `.oxlintrc.json:4` sets `"categories": { "correctness": "off" }`, and only eight rules are on.
- Why it matters: oxlint's correctness set catches real bugs: unused expressions, `await` in loops, bad `typeof` comparisons, self-comparisons, duplicate `case`. It is the floor in production codebases.
- Root fix: turn on `correctness`, plus `suspicious` at warn. Baseline today's hits in `lint.json`, which already exists for this, and let it only go down.

**M9. `serve.py` is a 736-line monolith outside the size and refs rules.** NEW
- Where:
  - `serve.py` puts static serving, the API proxy, the WebSocket tunnel and route rules in one file, with a 36-line module docstring at `:2–37`.
  - `SOURCE_DIRS` (`tools/check.mjs:13`) covers JS and CSS only, so the 400-line limit never applies to it.
  - Package E (F27 and F28) adds the CSS rewriting and flattening here.
- Why it matters: the next change to this file is a medium-risk one.
- Root fix:
  - Before E: split into `serve/static.py`, `serve/proxy.py`, `serve/ws.py` and `serve/css.py`, and cut the docstring to one line per module.
  - Add `.py` to the size ratchet.

### Low

**L1. Dead code.** NEW
- Where:
  - Exported and used nowhere:
    - `modules/decisions/rank.js:37` `fmtMin` and `:45` `fmtAgent`
    - `modules/changes/store.js:12` `FILE_MARK`
    - `core/platform/dom.js:6` `$$`
    - `shell/kernel.js:12` `addModule` (see M7)
  - 36 more exports are used only inside their own file. 53 are used only by tests, for example `core/ui/a11y/ring.js` `REGIONS` and `shell/panel/lists.js` `matchesQ`'s test-only siblings.
- Root fix: delete or un-export. Add an `exports` step to `check.mjs` that flags an export with no importer outside tests, with a baseline.

**L2. Thread search is implemented twice, with different fields.** NEW
- Where: `shell/panel/lists.js:17` `matchesQ` searches title, sub, summary and branch. `modules/threads/all.js:28` repeats it without `sub`.
- Why it matters: the same query finds different threads in the panel and in All threads.
- Root fix: one matcher in `core/services/world`, used by both.

**L3. The easing curve is defined twice.** EXTENDS N1
- Where: `core/platform/motion.js:4` `EASE` and `core/ui/tokens.css:188` `--ease`. `core/ui/motion.js` also hard-codes a 40 ms stagger, a 60 ms delay, a 6 px rise and a 320 ms default.
- Root fix: read both from the tokens once at boot, together with N1's durations.

**L4. Names are cryptic.** NEW
- Where:
  - `js/app.js` has about 30 globals of one to four capital letters: `S`, `D`, `P`, `CH`, `MK`, `IQ`, `TP`, `FP`, `LP`, `LPP`, `LW`, `SV`, `TD`, `VW`, `SETF`, `SETS` and others. They are passed on as dependency keys (`thread-page.js:22–25`).
  - CSS class prefixes such as `.stg-`, `.fr-`, `.tb-`, `.shd-` and `.dg-` don't say what they style.
- Why it matters: a new reader needs a glossary.
- Root fix: rename at the service boundary as H1 moves each module (`decisions`, `chats`, `composer`, `threadPage`). Rename CSS prefixes per module when M7 moves its rules.

**L5. Tests are not next to the modules they test.** NEW
- Where: 213 unit-test files in top-level `tests/` against 85 in module `tests/` folders, for example `tests/thread-page.test.mjs` for `modules/conversation/`.
- Root fix: move each test file to its module as the module is fixed. `tests/run.mjs` already discovers both.

**L6. DOM expandos are far more widespread than N2 lists.** EXTENDS N2
- Where: 177 writes in 55 files, among them `_h` (66), `_sel` (9), `_seeded` (7), `_built` (7) and `_shut` (4, `js/app.js:612`).
- Root fix: N2's WeakMap rule. Add an expando count to the `lifecycle` step's ratchet.

## 3. Shims and bridges, expected to go in P4 (not findings)

- `js/*.js`: 48 one-to-37-line re-export shims.
- `js/app.js`: 1,388 lines, no `@ts-check`, 168 extra comment lines in its baseline.
- `tools/baselines/layers.json`: 10 allowed imports into `js/world.js`, `js/ui.js` and `js/attach.js` from `modules/create-project`, `routing`, `rules`, `runtimes`, `search`, `settings` and `worktrees`.

Note for P4: the composer's `@`-mention controller (`js/app.js:602–669`: `atKeys`, `atShut`, `wireAt`, `aimAt`) and the `held` workaround (M6) are feature logic, not overlay or shortcut wiring. They belong in `modules/conversation/` and shouldn't simply stay in the entry when P4 empties it.

## 4. Already covered by FIX-PLAN, confirmed at this tag and not repeated

C1 lifecycle (and F2, F7, F12, F17, F22), C2 bounded caches (F3), C3 reads (F4, F8, F14, F15), C4 errors and storage (including `js/app.js:175` `/* private mode */`), C5 per-surface redraw (F5), C6 focus policy (F6, F18, F19, F24; `shell/gestures.js:308` coarse-pointer check), C7 and F27/F28 static serving, F1, F10, F11, F13, F16, F20, F21, F23 (working-turn sizing), N1–N3.

## 5. Suggested order

1. **Before more fix packages land:**
   - Run the H2 ratchet, then rewrite the source-reading tests in each package's own files as part of that package. Otherwise A–F each rewrite them by hand.
   - Run M2's regex and M8's lint as baselines; both are cheap.
2. **With package A:** add the remaining ratchets to `check.mjs` — `style-literals` (H4, H5), `any` (H7), line length (M3), `exports` (L1) and expandos (L6) — so the baseline only goes down from here.
3. **With E:** split `serve.py` (M9), then the breakpoint (H6) and CSS ownership (M7).
4. **A new package after the P4 gate:**
   - Role tokens and the light theme (H4).
   - The spacing codemod (H5): a no-look-change move, then a snapping pass with one screenshot pair for the owner.
5. **With G's `activate(ctx)` migration:** H1 and H3 per module, which also retires L4 and L5 as each module is moved.
