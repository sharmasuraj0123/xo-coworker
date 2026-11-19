# Ledger: every file of xo-coworker at 5a2b078 and its new home

Generated from `tools/ledger/ledger.json` by `tools/ledger/ledger_md.py`; do not edit by hand. Statuses: **planned** (one home), **split** (several homes; the items inside carry their own), **vendor** (kept as-is), **decide** (waits for the owner), and once the move runs **moved**, **kept**, **deleted** (with a reason). `tools/ledger/check_ledger.py` fails if a file of the base commit is missing here or has no home; `--final` fails until nothing is planned or undecided.

| Status | Files |
|---|---:|
| planned | 618 |
| vendor | 367 |
| deleted | 238 |
| moved | 54 |
| split | 35 |
| kept | 1 |

Items inside first-party files: 2290 (planned 1006, moved 696, split-region 546, deleted 39, kept 2, split 1), in `ledger.json` as `path::kind::name`.

## root (7)

| File | Lines | Status | New home |
|---|---:|---|---|
| `.gitignore` |  | planned | .gitignore (updated) |
| `PR_DESCRIPTION.md` | 284 | planned | out of the repo: the design archive (owner D4) |
| `README.md` | 191 | planned | README.md (rewritten: architecture + module table generated) |
| `favicon.svg` | 6 | planned | core/ui/icons/favicon.svg, generated from the icon pack (owner D7: today a hand-made copy that differs) |
| `index.html` | 293 | split | shell/index.html (thin frame) + module-owned markup (analysis/1-app-index.md element table) · next: the hidden layers' markup is in shell/overlays.js; comments are gone; the visible frame (sidebar, main) stays for the first paint |
| `serve.py` | 540 | planned | serve.py (kept; apps-host routes added in phase 7) · next: the writer key now also covers app management (/api/apps writes) and app views (/api/coworker/apps/*), only for XO's own page |
| `start.sh` | 29 | planned | start.sh (kept) |

## js (79)

| File | Lines | Status | New home |
|---|---:|---|---|
| `js/api.js` | 428 | split | core/platform/http.js, per-module clients (routes declared in each module.json) · next: the transport is in core/platform/http.js; js/api.js keeps the route table (and re-exports the transport) until the routes go to their modules |
| `js/app.js` | 4840 | split | boot.js + core/* + shell + modules/* by region (analysis/1-app-index.md §2.6) · next: moved so far: the sidebar (SIDE) to shell/rail/side.js, the phone drawer to shell/phone.js, the tab favicon to shell/favicon.js |
| `js/attach.js` | 270 | split | modules/composer/attachments.js, core/services/world/rows.js + sessions.js + threads.js, core/platform/util.js · next: attachmentsOf, titleOf and picDims are in core/services/world/rows.js, re-exported here |
| `js/blocks.js` | 241 | moved | core/services/world/turns.js · next: nothing imports the old path, so it leaves with no re-export |
| `js/changes.js` | 194 | split | modules/changes/store.js, modules/conversation/refs.js (fileRef, lineRef), core/services/places.js |
| `js/changesframe.js` | 323 | split | modules/changes/frame.js, core/ui/components/counts.js |
| `js/chart.js` | 176 | moved | core/ui/markdown/chart.js · next: js/chart.js re-exports it until the shims go |
| `js/chats.js` | 452 | planned | modules/chats/ |
| `js/comms.js` | 173 | planned | modules/conversation/blocks/comms.js |
| `js/content.js` | 72 | planned | modules/decisions/rank.js |
| `js/create.js` | 364 | moved | modules/create-project/create.js |
| `js/decide.js` | 1104 | split | modules/decisions/needs.js, modules/decisions/queue.js, modules/decisions/card.js, modules/decisions/panel.js, modules/decisions/toast.js |
| `js/diffthemes.js` | 4 | planned | modules/changes/diff-renderer/themes.js (generated) |
| `js/diffview.js` | 421 | split | modules/changes/diff-renderer/ |
| `js/doceditor.js` | 290 | planned | modules/files/editor/doceditor.js |
| `js/docs.js` | 420 | planned | modules/files/documents/docs.js |
| `js/drafts.js` | 61 | planned | modules/files/documents/drafts.js |
| `js/dropdown.js` | 321 | moved | core/ui/components/xo-select.js · next: js/dropdown.js imports core/ui/components/xo-select.js until the shims go; css/dropdown.css follows with the stylesheets |
| `js/fileicons.js` | 83 | moved | core/ui/icons/fileicons.js · next: js/fileicons.js re-exports core/ui/icons/fileicons.js until the shims go |
| `js/files.js` | 940 | split | modules/files/tree, modules/files/ops, core/services/places.js, core/services/activity.js |
| `js/filespage.js` | 150 | planned | modules/files/page.js |
| `js/focusview.js` | 138 | moved | core/ui/a11y/focus.js · next: js/focusview.js re-exports core/ui/a11y/focus.js until the shims go |
| `js/follow.js` | 150 | moved | modules/conversation/follow.js |
| `js/fuzzy.js` | 118 | moved | core/platform/fuzzy.js · next: js/fuzzy.js re-exports core/platform until the shims go |
| `js/gestures.js` | 451 | split | core/platform/gestures.js, shell (the app's gestures: wireGestures, dockGestures, long press) · next: the drag primitive is in core/platform/gestures.js; the app's gestures stay in js/gestures.js until the shell takes them |
| `js/herald.js` | 92 | moved | core/services/notices.js · next: every importer points at the new home; the line is drawn by app.js's heraldShow, which the shell takes |
| `js/highlight.js` | 149 | moved | core/ui/markdown/highlight.js · next: js/highlight.js re-exports it until the shims go |
| `js/hopstate.js` | 13 | moved | core/services/world/hops.js · next: nothing imports the old path, so it leaves with no re-export |
| `js/icon.js` | 24 | moved | core/ui/icons/icon.js · next: js/icon.js re-exports core/ui/icons/icon.js until the shims go |
| `js/imagechange.js` | 120 | planned | modules/changes/imagechange.js |
| `js/intel.js` | 743 | planned | modules/intelligence/ |
| `js/keynav.js` | 109 | moved | core/ui/a11y/keynav.js · next: js/keynav.js re-exports core/ui/a11y/keynav.js until the shims go |
| `js/keys.js` | 176 | split | core/platform/keys.js, core/kernel (shortcut place), modules/settings/keyboard.js · next: the engine and its catalogue are in core/platform/keys.js; js/keys.js re-exports it until the shims go; the catalogue becomes the kernel's shortcut place when modules contribute their keys |
| `js/kit.js` | 270 | split | modules/decisions/kit.js, core/ui/components/hold.js · next: the hold button and its guard are in core/ui/components/hold.js (kit.js re-exports them); the rest goes to modules/decisions |
| `js/launchpad.js` | 1166 | planned | modules/launchpad/ (store, controller, views, section) |
| `js/lightbox.js` | 384 | split | core/ui/lightbox.js, modules/conversation (the pictures it lends the lightbox) · next: the lightbox is core/ui/lightbox.js; js/lightbox.js keeps only the conversation pictures it lends it, until the conversation module moves |
| `js/lpapi.js` | 239 | split | modules/launchpad/client.js, modules/launchpad/model.js, core/services/github.js |
| `js/map.js` | 1360 | split | modules/map, core/services/places.js, core/services/agent-activity.js · next: folderOf, placeOf, pathsInCommand are in core/services/places.js; activityOf in core/services/agent-activity.js; colorOf, layoutOf, edgePath in modules/map/layout.js; the standalone #map's code and CSS are deleted, its <aside> in index.html waits for the shell; the rest waits for modules/map |
| `js/markdown.js` | 519 | split | core/ui/markdown/markdown.js, core/ui/markdown/inline.js · next: blocks in markdown.js, inline text, links, pictures and the rich hooks in inline.js; js/markdown.js re-exports markdown.js until the shims go |
| `js/mdlive.js` | 331 | planned | modules/files/editor/markdown-page.js |
| `js/media.js` | 609 | split | modules/conversation/media/, core/ui/media (layout) |
| `js/merge.js` | 101 | moved | core/platform/diff.js · next: js/merge.js re-exports core/platform/diff.js until the shims go |
| `js/model.js` | 34 | planned | modules/threads/checklist.js |
| `js/motion.js` | 82 | moved | core/ui/motion.js · next: js/motion.js re-exports core/ui/motion.js until the shims go |
| `js/msgx.js` | 917 | split | modules/conversation/decorate.js, modules/conversation/working.js, modules/conversation/actions.js, modules/conversation/gestures.js, modules/conversation/latest-button.js, modules/composer (reply chip, quote) |
| `js/pacing.js` | 67 | moved | modules/decisions/pacing.js |
| `js/paid.js` | 152 | moved | core/services/world/paid.js · next: every importer points at the new home, so it leaves with no re-export |
| `js/paidview.js` | 21 | moved | modules/decisions/cards/paid.js |
| `js/paths.js` | 83 | moved | core/services/paths.js · next: every importer points at the new home, so it leaves with no re-export |
| `js/pending.js` | 22 | moved | core/platform/pending.js · next: js/pending.js re-exports core/platform until the shims go |
| `js/projicons.js` | 83 | moved | modules/projects/projicons.js |
| `js/quickopen.js` | 179 | moved | modules/search/quickopen.js |
| `js/record.js` | 340 | split | modules/artifacts/model.js, modules/since/model.js, core/services/git-state.js, core/ui/virtual.js · next: every piece has moved (modules/artifacts/model.js, modules/since/model.js, core/services/git-state.js, core/ui/virtual.js); record.js only re-exports them until the shims go |
| `js/recordview.js` | 855 | split | modules/artifacts, modules/since · next: Since you left (seen marks, the worktrees' git words, the line, Home's lines, Got it) is in modules/since/view.js; the preview queue in modules/artifacts/previews.js; the cards in modules/artifacts/cards.js; what was made (the backend's pages, the fallback, pins) in modules/artifacts/store.js; the dead Since card is deleted; the Made tab, Home's strip, the Artifacts page and ⌘K wait for modules/artifacts |
| `js/redraw.js` | 130 | moved | core/ui/redraw.js · next: js/redraw.js re-exports core/ui/redraw.js until the shims go |
| `js/review.js` | 153 | planned | modules/decisions/items.js |
| `js/rich.js` | 281 | moved | core/ui/markdown/rich.js · next: js/rich.js re-exports it until the shims go |
| `js/ring.js` | 65 | moved | core/ui/a11y/ring.js · next: js/ring.js re-exports core/ui/a11y/ring.js until the shims go; its two region selectors stay until files and changes contribute them |
| `js/rtsettings.js` | 296 | moved | modules/runtimes/settings.js · next: the whole page moved, Paid usage rows with it: they become modules/runtimes/paid when Paid is its own settings.section |
| `js/runsview.js` | 138 | planned | modules/threads/runs/ |
| `js/runtimes.js` | 179 | moved | core/services/runtimes.js · next: every importer points at the new home, so it leaves with no re-export |
| `js/settings.js` | 407 | split | modules/settings/host.js, modules/routing/page.js, modules/rules/page.js, modules/worktrees/page.js · next: js/settings.js keeps only the wiring until the shell's settings.section place takes it |
| `js/shape.js` | 731 | moved | core/services/shape/ · next: every importer points at the new home, so it leaves with no re-export |
| `js/shapeview.js` | 314 | moved | modules/settings/shape-page.js · next: whole file moved; the home thread takes homeOrder and the shell thread density (apply) from shape-page.js later |
| `js/shells/dock.js` | 704 | planned | modules/shells/dock.js |
| `js/shells/model.js` | 128 | planned | modules/shells/model.js |
| `js/shells/term.js` | 205 | planned | modules/shells/term.js |
| `js/skeleton.js` | 105 | split | modules/home/skeleton.js, core/ui/skeleton.js |
| `js/sse.js` | 190 | moved | core/platform/sse.js · next: js/sse.js re-exports core/platform until the shims go; storm.js still imports it there while core-services splits storm |
| `js/stage.js` | 870 | split | shell/panel (panel.js, pages.js, frames.js, width.js, lists.js), core/kernel (panel.page/panel.frame places), modules/threads (Threads frame), modules/changes (frame wiring), modules/map (frame wiring), modules/launchpad (cover), modules/shells (shell page) · next: moved into shell/panel/ whole; js/stage.js re-exports createStage until the shims go; lists.js (the frames' contents) and the shell page still go to their modules |
| `js/storm.js` | 1242 | split | core/services/storm/index.js, core/services/storm/config.js, core/services/storm/client.js, core/services/storm/stream.js, core/services/storm/load.js, core/services/storm/account.js, core/services/storm/history.js, core/services/storm/hops.js, core/services/storm/reducers/, core/services/storm/selectors/, core/services/storm/commands.js, core/services/storm/act.js, core/services/storm/types.d.ts · next: js/storm.js is a one-line re-export of core/services/storm until the shims go |
| `js/timeline.js` | 816 | split | core/services/world/rows.js + sessions.js + threads.js, modules/conversation/model.js, modules/threads, modules/decisions · next: its normalisers are in core/services/world (rows, sessions, threads), re-exported here; the rest is the views' |
| `js/turnview.js` | 331 | planned | modules/conversation/blocks/turn.js |
| `js/ui.js` | 397 | split | core/ui/icons, core/ui/motion, core/ui/redraw (reconcile), core/platform/dom, core/platform/time, core/services/sound · next: reconcile in core/ui/redraw.js, the motion in core/ui/motion.js, the icon names in core/ui/icons/names.js, the time words in core/platform; ui.js keeps $, $$, plain and the sounds, and re-exports the rest until the shims go |
| `js/util.js` | 112 | split | core/platform/util.js, core/platform/time.js, core/platform/clipboard.js · next: js/util.js re-exports core/platform until the shims go |
| `js/viewer.js` | 1157 | split | modules/files/viewer, modules/files/documents (external-change intake), modules/changes/file-diff |
| `js/words.js` | 48 | moved | modules/conversation/words.js |
| `js/world.js` | 56 | split | core/services/world/store.js, core/platform/util.js (esc) · next: js/world.js re-exports the store and the platform's esc until the shims go |
| `js/xoicons.js` | 390 | moved | core/ui/icons/xoicons.js · next: generated by tools/xoicons/build.mjs; js/xoicons.js re-exports it until the shims go |

## css (18)

| File | Lines | Status | New home |
|---|---:|---|---|
| `css/app.css` | 3154 | split | core/ui + shell + modules/* by region (analysis/6-css-tests-tools.md, app.css region map) |
| `css/artifacts.css` | 126 | moved | modules/artifacts/artifacts.css · next: css/artifacts.css imports it, and keeps the phone pin's background-image !important until the sheet gets its @layer |
| `css/base.css` | 52 | moved | core/ui/foundation.css |
| `css/diffs.css` | 245 | planned | modules/changes/diffs.css |
| `css/docs.css` | 141 | planned | modules/files/editor/docs.css |
| `css/dropdown.css` | 52 | moved | core/ui/components/xo-select.css |
| `css/foundation.css` | 267 | split | core/ui/foundation.css, modules/* (structure rules) |
| `css/launchpad.css` | 438 | planned | modules/launchpad/launchpad.css |
| `css/light.css` | 85 | split | core/ui/tokens.css (light roles), modules/* (light blocks) |
| `css/links.css` | 104 | planned | modules/conversation/links.css |
| `css/media.css` | 127 | planned | modules/conversation/media/media.css |
| `css/msgx.css` | 408 | planned | modules/conversation/msgx.css |
| `css/panel.css` | 645 | split | shell/panel.css, modules/threads, modules/changes, modules/map, modules/files |
| `css/phone.css` | 293 | split | shell/phone.css, modules/* (phone blocks) |
| `css/rich.css` | 232 | moved | core/ui/markdown/rich.css |
| `css/shape.css` | 74 | split | modules/settings/shape.css, core/ui (density) · next: Settings › Shape and its rail label moved to modules/settings/shape.css, which css/shape.css imports first (same cascade place); density and the two composer and thread rules stay for core/ui |
| `css/side.css` | 164 | planned | shell/sidebar.css |
| `css/tokens.css` | 245 | moved | core/ui/tokens.css |

## tests-unit (165)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tests/agent-marks.test.mjs` | 40 | planned | core/ui (agent marks)/tests/agent-marks.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/agent-tag.test.mjs` | 51 | planned | modules/map/tests/agent-tag.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/app-ctl-scale.test.mjs` | 55 | planned | core/ui (css guard)/tests/app-ctl-scale.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/artifacts-preview.test.mjs` | 62 | planned | modules/artifacts/tests/artifacts-preview.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/attach.test.mjs` | 208 | planned | modules/composer/tests/attach.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/busy.test.mjs` | 471 | planned | core/services (world/timeline)/tests/busy.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/card-ring.test.mjs` | 33 | planned | core/ui (css guard)/tests/card-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/changes.test.mjs` | 215 | planned | modules/changes/tests/changes.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/checklist-empty.test.mjs` | 27 | planned | modules/threads/tests/checklist-empty.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/codemirror-vendor.test.mjs` | 97 | planned | modules/vendor/tests/codemirror-vendor.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/conn-line.test.mjs` | 33 | planned | modules/composer/tests/conn-line.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/conv-ctl-scale.test.mjs` | 80 | planned | core/ui (css guard)/tests/conv-ctl-scale.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/conv-find-ring.test.mjs` | 21 | planned | core/ui (css guard)/tests/conv-find-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/conv-herald-resolve.test.mjs` | 73 | planned | modules/threads/tests/conv-herald-resolve.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/conv-sound.test.mjs` | 110 | planned | core/platform (sounds) + settings/tests/conv-sound.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/coord-colour.test.mjs` | 46 | planned | modules/conversation/tests/coord-colour.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/copy-path-fail.test.mjs` | 57 | planned | modules/files/tests/copy-path-fail.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/cover-inert.test.mjs` | 28 | planned | shell (panel host)/tests/cover-inert.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/create-busy-honest.test.mjs` | 33 | moved | modules/create-project/tests/create-busy-honest.test.mjs · next: still reads the source; its rewrite as a behaviour test is owed |
| `tests/create.test.mjs` | 51 | moved | modules/create-project/tests/create.test.mjs |
| `tests/css-wellformed.test.mjs` | 80 | planned | core/ui (css guard)/tests/css-wellformed.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/ctl-heights.test.mjs` | 25 | planned | core/ui (css guard)/tests/ctl-heights.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/ctl-scale.test.mjs` | 181 | planned | core/ui (css guard, all modules)/tests/ctl-scale.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/design-budget.test.mjs` | 159 | planned | core/ui (css guard)/tests/design-budget.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/diff-redraw-focus.test.mjs` | 43 | planned | modules/files/tests/diff-redraw-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/diffview.test.mjs` | 82 | planned | modules/files/tests/diffview.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/dock-focus.test.mjs` | 62 | planned | modules/decisions/tests/dock-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/docs.test.mjs` | 348 | planned | modules/files/tests/docs.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/drafts.test.mjs` | 77 | planned | core/services/tests/drafts.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/dropdown-held.test.mjs` | 27 | planned | core/ui/tests/dropdown-held.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/edge-ring.test.mjs` | 18 | planned | core/ui (css guard)/tests/edge-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/editor-caret.test.mjs` | 28 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6); this test read the source of that editor's caret handling; tests/diffview.test.mjs checks the adapter offers no editor |
| `tests/editor-exit.test.mjs` | 52 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6); this test tested diffview's exitKeys, which only that editor used; tests/diffview.test.mjs checks the adapter offers no editor |
| `tests/edits.test.mjs` | 50 | planned | modules/files/tests/edits.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/field-ring.test.mjs` | 42 | planned | core/platform/tests/field-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/file-cache.test.mjs` | 25 | planned | modules/files/tests/file-cache.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/files-stop-look.test.mjs` | 26 | planned | modules/composer/tests/files-stop-look.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/files-tree-scroll-fold.test.mjs` | 54 | planned | modules/files/tests/files-tree-scroll-fold.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/files.test.mjs` | 66 | planned | modules/files/tests/files.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/find-bar.test.mjs` | 38 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6); this test read that editor's find-bar stylesheet (FIND_CSS); tests/diffview.test.mjs checks the adapter offers no editor |
| `tests/find-race.test.mjs` | 38 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6); this test read that editor's find-key handling and its vendored source; tests/diffview.test.mjs checks the adapter offers no editor |
| `tests/focus-back.test.mjs` | 55 | planned | core/platform (focus) + decisions/tests/focus-back.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/focusview.test.mjs` | 151 | planned | core/platform/tests/focusview.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/follow-instance.test.mjs` | 30 | moved | modules/conversation/tests/follow-instance.test.mjs |
| `tests/gone-thread-composer.test.mjs` | 33 | planned | modules/composer/tests/gone-thread-composer.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/graph-focus.test.mjs` | 49 | planned | core/ui (css guard)/tests/graph-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/grip-ring.test.mjs` | 23 | planned | core/ui (css guard)/tests/grip-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/head-focus.test.mjs` | 26 | planned | modules/files/tests/head-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/head-narrow.test.mjs` | 33 | planned | modules/files/tests/head-narrow.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/head-redraw.test.mjs` | 37 | planned | modules/files/tests/head-redraw.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/herald.test.mjs` | 65 | planned | modules/conversation/tests/herald.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/hover-census.test.mjs` | 55 | planned | core/ui (css guard)/tests/hover-census.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/hover-inks.test.mjs` | 33 | planned | core/ui (css guard)/tests/hover-inks.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/icon-gap.test.mjs` | 24 | planned | core/ui (css guard)/tests/icon-gap.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/image-text-mode.test.mjs` | 28 | planned | modules/files/tests/image-text-mode.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/imagechange.test.mjs` | 34 | planned | modules/changes/tests/imagechange.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/inverse-toast.test.mjs` | 56 | planned | core/ui (css guard)/tests/inverse-toast.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/key-layer.test.mjs` | 20 | planned | shell (phone drawer)/tests/key-layer.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/keynav.test.mjs` | 185 | planned | core/platform/tests/keynav.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/keys-dispatch.test.mjs` | 87 | planned | core/platform/tests/keys-dispatch.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/keys.test.mjs` | 48 | moved | core/platform/tests/keys.test.mjs |
| `tests/launchpad.test.mjs` | 326 | planned | modules/launchpad/tests/launchpad.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/layout-reads.test.mjs` | 25 | planned | modules/conversation/tests/layout-reads.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/link-buttons.test.mjs` | 47 | planned | core/ui (css guard)/tests/link-buttons.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/links-css.test.mjs` | 44 | planned | modules/files/tests/links-css.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/logic.test.mjs` | 549 | planned | core/services + conversation (markdown)/tests/logic.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/lp-create-connect-focus.test.mjs` | 34 | moved | modules/create-project/tests/lp-create-connect-focus.test.mjs · next: still reads the source; its rewrite as a behaviour test is owed |
| `tests/lp-create-stop-focus.test.mjs` | 39 | moved | modules/create-project/tests/lp-create-stop-focus.test.mjs · next: still reads the source; its rewrite as a behaviour test is owed |
| `tests/lp-intel-order.test.mjs` | 74 | planned | modules/composer/tests/lp-intel-order.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/lp-phone-links.test.mjs` | 90 | planned | core/ui phone floor (launchpad, create, intel, shells)/tests/lp-phone-links.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/lp-stop-notice.test.mjs` | 171 | planned | modules/launchpad/tests/lp-stop-notice.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/main-clip.test.mjs` | 19 | planned | core/ui (css guard)/tests/main-clip.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map-focus-reveal.test.mjs` | 38 | planned | modules/map/tests/map-focus-reveal.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map-follow-cursor.test.mjs` | 26 | planned | modules/map/tests/map-follow-cursor.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map-follow.test.mjs` | 35 | planned | modules/map/tests/map-follow.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map-reach.test.mjs` | 33 | planned | modules/map/tests/map-reach.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map-tag-press.test.mjs` | 22 | planned | core/ui (css guard)/tests/map-tag-press.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/map.test.mjs` | 108 | planned | modules/map/tests/map.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/mdlive.test.mjs` | 108 | planned | modules/files/tests/mdlive.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/media.test.mjs` | 358 | planned | modules/conversation/tests/media.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/menu-focus-fill.test.mjs` | 34 | planned | core/ui (css guard)/tests/menu-focus-fill.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/menu-focus.test.mjs` | 33 | planned | modules/files/tests/menu-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/menu-one-active.test.mjs` | 45 | planned | core/ui (css guard)/tests/menu-one-active.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/menu-successor.test.mjs` | 42 | planned | core/ui (menus, all modules)/tests/menu-successor.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/merge.test.mjs` | 81 | planned | modules/files/tests/merge.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/names.test.mjs` | 24 | planned | modules/repo/tests/names.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/no-offedge.test.mjs` | 33 | planned | core/ui (css guard)/tests/no-offedge.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/notice-clear.test.mjs` | 67 | planned | shell (app.js)/tests/notice-clear.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/notice-kind.test.mjs` | 65 | planned | modules/conversation/tests/notice-kind.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/one-active.test.mjs` | 23 | planned | core/ui (lists)/tests/one-active.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/page-no-hover.test.mjs` | 28 | planned | core/ui (css guard)/tests/page-no-hover.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/paging.test.mjs` | 94 | planned | modules/conversation/tests/paging.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/paid.test.mjs` | 86 | planned | modules/settings/tests/paid.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/paint-a11y.test.mjs` | 40 | planned | modules/files/tests/paint-a11y.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/panel-shell.test.mjs` | 47 | planned | shells + shell (panel host)/tests/panel-shell.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/panel-threads.test.mjs` | 97 | planned | modules/threads/tests/panel-threads.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/path-copy-inline.test.mjs` | 24 | planned | modules/files/tests/path-copy-inline.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/pending.test.mjs` | 37 | planned | core/services/tests/pending.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/phone-cascade.test.mjs` | 27 | planned | core/ui (css guard)/tests/phone-cascade.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/phone-floor.test.mjs` | 140 | planned | core/ui (css guard)/tests/phone-floor.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/phone-hit-area.test.mjs` | 34 | planned | core/ui (css guard)/tests/phone-hit-area.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/phone-panel-go.test.mjs` | 40 | planned | shell (phone panel)/tests/phone-panel-go.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/picker-keys.test.mjs` | 34 | planned | modules/composer/tests/picker-keys.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/pierre-find-focus.test.mjs` | 36 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6); this test checked the local patch to the vendored edit.js; tests/diffview.test.mjs checks the adapter offers no editor |
| `tests/press-inks.test.mjs` | 57 | planned | core/ui (css guard)/tests/press-inks.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/press-keeps-node.test.mjs` | 231 | planned | core/platform (redraw)/tests/press-keeps-node.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/press-reach.test.mjs` | 114 | planned | core/ui (css guard, all modules)/tests/press-reach.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/project-find-escape.test.mjs` | 21 | planned | shell (sidebar)/tests/project-find-escape.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/project-icons.test.mjs` | 40 | planned | modules/projects/tests/project-icons.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/quickopen.test.mjs` | 95 | planned | modules/search/tests/quickopen.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/rail-order.test.mjs` | 49 | moved | modules/settings/tests/rail-order.test.mjs · next: re-pointed at shape-page.js; still reads the source, a behaviour rewrite is open |
| `tests/rec-undo-focus.test.mjs` | 26 | planned | modules/conversation/tests/rec-undo-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/reconcile-focus.test.mjs` | 32 | planned | core/platform (redraw/focus)/tests/reconcile-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/record.test.mjs` | 280 | planned | modules/artifacts/tests/record.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/reduced-motion.test.mjs` | 25 | planned | core/ui (css guard)/tests/reduced-motion.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/refusal-mark.test.mjs` | 26 | planned | modules/files/tests/refusal-mark.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/refused.test.mjs` | 57 | planned | modules/composer/tests/refused.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/region-focus.test.mjs` | 28 | planned | modules/files/tests/region-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/render-focus.test.mjs` | 22 | planned | modules/files/tests/render-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/retry-waiting.test.mjs` | 34 | planned | modules/files/tests/retry-waiting.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/reveal-focus.test.mjs` | 20 | planned | modules/changes/tests/reveal-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/rich-markdown.test.mjs` | 133 | planned | modules/conversation/tests/rich-markdown.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/ring-room.test.mjs` | 67 | planned | core/platform/tests/ring-room.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/ring.test.mjs` | 124 | planned | core/platform/tests/ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/routing-truth.test.mjs` | 45 | planned | modules/settings/tests/routing-truth.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/routing-words.test.mjs` | 26 | moved | modules/routing/tests/routing-words.test.mjs · next: still reads the source; its rewrite as a behaviour test is owed |
| `tests/rtsettings.test.mjs` | 81 | moved | modules/runtimes/tests/rtsettings.test.mjs |
| `tests/runs-stop-receipt.test.mjs` | 69 | planned | modules/threads/tests/runs-stop-receipt.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/runtimes.test.mjs` | 126 | planned | modules/settings/runtimes/tests/runtimes.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/saved-truth.test.mjs` | 43 | moved | modules/runtimes/tests/saved-truth.test.mjs · next: still reads the source; its rewrite as a behaviour test is owed |
| `tests/scroller-ring.test.mjs` | 171 | planned | core/ui (css guard)/tests/scroller-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/seg-fold.test.mjs` | 32 | planned | modules/files/tests/seg-fold.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/seg-ring.test.mjs` | 16 | planned | core/ui (css guard)/tests/seg-ring.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/send-gate.test.mjs` | 36 | planned | modules/composer/tests/send-gate.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/send-notice.test.mjs` | 36 | planned | modules/composer/tests/send-notice.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/serve.test.py` | 489 | planned | modules/root:/tests/serve.test.py  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/settings-css.test.mjs` | 20 | planned | core/ui (css guard)/tests/settings-css.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/shape-held.test.mjs` | 42 | moved | modules/settings/tests/shape-held.test.mjs · next: re-pointed at shape-page.js; still reads the source, a behaviour rewrite is open |
| `tests/shape-unkept.test.mjs` | 29 | moved | modules/settings/tests/shape-unkept.test.mjs · next: re-pointed at shape-page.js; still reads the source, a behaviour rewrite is open |
| `tests/shape.test.mjs` | 957 | planned | core/services/tests/shape.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/shell-grip.test.mjs` | 35 | planned | core/ui (css guard)/tests/shell-grip.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/shells.test.mjs` | 125 | planned | shells/tests/shells.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/side-bar.test.mjs` | 80 | planned | shell (sidebar)/tests/side-bar.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/side-fold.test.mjs` | 45 | planned | shell (sidebar)/tests/side-fold.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/side-spacing.test.mjs` | 17 | planned | core/ui (css guard)/tests/side-spacing.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/sidebar-hover.test.mjs` | 27 | planned | core/ui (css guard)/tests/sidebar-hover.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/stage-inplace.test.mjs` | 24 | planned | shell (panel host)/tests/stage-inplace.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/stage-pages.test.mjs` | 59 | planned | shell (panel host)/tests/stage-pages.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/stale-pass.test.mjs` | 47 | planned | core/ui (css guard)/tests/stale-pass.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/start-centred.test.mjs` | 16 | planned | core/ui (css guard)/tests/start-centred.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/state-hover.test.mjs` | 127 | planned | core/ui (css guard, all modules)/tests/state-hover.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/stopped-on-purpose.test.mjs` | 145 | planned | modules/decisions/tests/stopped-on-purpose.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/storm.test.mjs` | 401 | planned | core/platform (sse) + core/services (timeline)/tests/storm.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/target-bounded.test.mjs` | 26 | planned | core/ui (css guard)/tests/target-bounded.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/targets-css.test.mjs` | 74 | planned | core/ui (css guard)/tests/targets-css.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/thread-filter.test.mjs` | 55 | planned | modules/threads/tests/thread-filter.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/thread-menu.test.mjs` | 43 | planned | modules/threads/tests/thread-menu.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/thread-page.test.mjs` | 136 | planned | modules/threads/tests/thread-page.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/turnview.test.mjs` | 249 | planned | modules/conversation/tests/turnview.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/viewer-busy.test.mjs` | 43 | planned | modules/files/tests/viewer-busy.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/viewer-errors.test.mjs` | 25 | planned | modules/files/tests/viewer-errors.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/viewer-head-focus.test.mjs` | 18 | planned | modules/files/tests/viewer-head-focus.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/viewer-hooks.test.mjs` | 37 | planned | modules/files/tests/viewer-hooks.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |
| `tests/words.test.mjs` | 47 | moved | modules/conversation/tests/words.test.mjs · next: still reads the source for the two imports; its rewrite as a behaviour test is owed |
| `tests/xoicons.test.mjs` | 104 | planned | core/ui (icons) + tools/xoicons/tests/xoicons.test.mjs  (source-reading tests are rewritten as behaviour tests when their module moves) |

## tests-browser (10)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tests/browser/chat-read-order.test.cjs` | 100 | planned | e2e/specs/chat-read-order.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/conversation.test.cjs` | 1495 | planned | e2e/specs/conversation.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/coordinator-busy.test.cjs` | 80 | planned | e2e/specs/coordinator-busy.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/flows.test.cjs` | 4382 | planned | e2e/specs/flows.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/harness.cjs` | 444 | planned | e2e/lib (space.mjs, store.mjs, settle.mjs, browser.mjs) + e2e/run.mjs · next: its in-page mock world becomes the fake Space and seeds; it goes when the last suite is a case in e2e/specs |
| `tests/browser/held-contract.test.cjs` | 99 | planned | e2e/specs/held-contract.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/held-waiting.test.cjs` | 151 | planned | e2e/specs/held-waiting.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/lpshell.test.cjs` | 1008 | planned | e2e/specs/lpshell.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/settings.test.cjs` | 1464 | planned | e2e/specs/settings.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |
| `tests/browser/smoke.test.cjs` | 115 | planned | e2e/specs/smoke.spec.mjs · next: rewritten as cases: seeded store, settle barrier, ARIA snapshots |

## tests-lib (2)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tests/lib/cascade.mjs` | 248 | planned | core/ui/test-kit/cascade.mjs |
| `tests/lib/tokens.mjs` | 20 | planned | core/ui/test-kit/tokens.mjs |

## tests-fixtures (2)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tests/fixtures/plain-turn.sse` | 92 | planned | core/platform/tests/fixtures/plain-turn.sse |
| `tests/fixtures/storm-held-contract.json` | 307 | planned | e2e/fixtures/storm-held-contract.json |

## presets (2)

| File | Lines | Status | New home |
|---|---:|---|---|
| `presets/engineering.json` | 40 | planned | core/services/shape/presets/engineering.json |
| `presets/marketing.json` | 43 | planned | core/services/shape/presets/marketing.json |

## fonts (3)

| File | Lines | Status | New home |
|---|---:|---|---|
| `fonts/geist/Geist-Variable.woff2` |  | planned | core/ui/fonts/geist/Geist-Variable.woff2 |
| `fonts/geist/GeistMono-Variable.woff2` |  | planned | core/ui/fonts/geist/GeistMono-Variable.woff2 |
| `fonts/geist/LICENSE.txt` | 92 | planned | core/ui/fonts/geist/LICENSE.txt |

## vendor (371)

| File | Lines | Status | New home |
|---|---:|---|---|
| `js/vendor/agent-marks/README.md` | 13 | vendor | vendor/agent-marks/README.md |
| `js/vendor/agent-marks/antigravity.svg` | 1 | vendor | vendor/agent-marks/antigravity.svg |
| `js/vendor/agent-marks/claude.svg` | 1 | vendor | vendor/agent-marks/claude.svg |
| `js/vendor/agent-marks/openai.svg` | 1 | vendor | vendor/agent-marks/openai.svg |
| `js/vendor/codemirror/LICENSES.md` | 1347 | vendor | vendor/codemirror/LICENSES.md |
| `js/vendor/codemirror/c/apl-WDIZS52W.js` | 1 | vendor | vendor/codemirror/c/apl-WDIZS52W.js |
| `js/vendor/codemirror/c/asciiarmor-A6BLF7D6.js` | 1 | vendor | vendor/codemirror/c/asciiarmor-A6BLF7D6.js |
| `js/vendor/codemirror/c/asn1-2LBS3BUG.js` | 1 | vendor | vendor/codemirror/c/asn1-2LBS3BUG.js |
| `js/vendor/codemirror/c/asterisk-6BH5HWIH.js` | 1 | vendor | vendor/codemirror/c/asterisk-6BH5HWIH.js |
| `js/vendor/codemirror/c/brainfuck-MF2U6KRY.js` | 1 | vendor | vendor/codemirror/c/brainfuck-MF2U6KRY.js |
| `js/vendor/codemirror/c/chunk-2SNB6XH5.js` | 1 | vendor | vendor/codemirror/c/chunk-2SNB6XH5.js |
| `js/vendor/codemirror/c/chunk-AXLUAIDQ.js` | 1 | vendor | vendor/codemirror/c/chunk-AXLUAIDQ.js |
| `js/vendor/codemirror/c/chunk-CNYDTQZO.js` | 14 | vendor | vendor/codemirror/c/chunk-CNYDTQZO.js |
| `js/vendor/codemirror/c/chunk-GTGQDGOX.js` | 1 | vendor | vendor/codemirror/c/chunk-GTGQDGOX.js |
| `js/vendor/codemirror/c/chunk-IEYLUQ5L.js` | 13 | vendor | vendor/codemirror/c/chunk-IEYLUQ5L.js |
| `js/vendor/codemirror/c/chunk-LOZFZ4PT.js` | 6 | vendor | vendor/codemirror/c/chunk-LOZFZ4PT.js |
| `js/vendor/codemirror/c/chunk-NXZJL534.js` | 1 | vendor | vendor/codemirror/c/chunk-NXZJL534.js |
| `js/vendor/codemirror/c/chunk-PAEODHZI.js` | 1 | vendor | vendor/codemirror/c/chunk-PAEODHZI.js |
| `js/vendor/codemirror/c/chunk-XNKSJU5R.js` | 1 | vendor | vendor/codemirror/c/chunk-XNKSJU5R.js |
| `js/vendor/codemirror/c/clike-44CNEW4H.js` | 1 | vendor | vendor/codemirror/c/clike-44CNEW4H.js |
| `js/vendor/codemirror/c/clojure-IIAJUPDR.js` | 1 | vendor | vendor/codemirror/c/clojure-IIAJUPDR.js |
| `js/vendor/codemirror/c/cmake-S23PUUSN.js` | 1 | vendor | vendor/codemirror/c/cmake-S23PUUSN.js |
| `js/vendor/codemirror/c/cobol-27OFJMJ6.js` | 1 | vendor | vendor/codemirror/c/cobol-27OFJMJ6.js |
| `js/vendor/codemirror/c/coffeescript-YV2ROPI3.js` | 1 | vendor | vendor/codemirror/c/coffeescript-YV2ROPI3.js |
| `js/vendor/codemirror/c/commonlisp-SJOK7WCK.js` | 1 | vendor | vendor/codemirror/c/commonlisp-SJOK7WCK.js |
| `js/vendor/codemirror/c/crystal-W6YI6I77.js` | 1 | vendor | vendor/codemirror/c/crystal-W6YI6I77.js |
| `js/vendor/codemirror/c/css-4ZEXGIXX.js` | 1 | vendor | vendor/codemirror/c/css-4ZEXGIXX.js |
| `js/vendor/codemirror/c/cypher-NFR5ROM2.js` | 1 | vendor | vendor/codemirror/c/cypher-NFR5ROM2.js |
| `js/vendor/codemirror/c/d-6IEJ3FMV.js` | 1 | vendor | vendor/codemirror/c/d-6IEJ3FMV.js |
| `js/vendor/codemirror/c/diff-3STZBEJI.js` | 1 | vendor | vendor/codemirror/c/diff-3STZBEJI.js |
| `js/vendor/codemirror/c/dist-26R6JZ2H.js` | 1 | vendor | vendor/codemirror/c/dist-26R6JZ2H.js |
| `js/vendor/codemirror/c/dist-3AOFVSQZ.js` | 1 | vendor | vendor/codemirror/c/dist-3AOFVSQZ.js |
| `js/vendor/codemirror/c/dist-3H7VD3WU.js` | 1 | vendor | vendor/codemirror/c/dist-3H7VD3WU.js |
| `js/vendor/codemirror/c/dist-7WUD2ZJP.js` | 1 | vendor | vendor/codemirror/c/dist-7WUD2ZJP.js |
| `js/vendor/codemirror/c/dist-A2TA6P4M.js` | 1 | vendor | vendor/codemirror/c/dist-A2TA6P4M.js |
| `js/vendor/codemirror/c/dist-CU33U7BS.js` | 1 | vendor | vendor/codemirror/c/dist-CU33U7BS.js |
| `js/vendor/codemirror/c/dist-D746Q3ZJ.js` | 1 | vendor | vendor/codemirror/c/dist-D746Q3ZJ.js |
| `js/vendor/codemirror/c/dist-DQTN3QM4.js` | 1 | vendor | vendor/codemirror/c/dist-DQTN3QM4.js |
| `js/vendor/codemirror/c/dist-HEER3P65.js` | 1 | vendor | vendor/codemirror/c/dist-HEER3P65.js |
| `js/vendor/codemirror/c/dist-KVSB4JMY.js` | 3 | vendor | vendor/codemirror/c/dist-KVSB4JMY.js |
| `js/vendor/codemirror/c/dist-L2JPCDM4.js` | 1 | vendor | vendor/codemirror/c/dist-L2JPCDM4.js |
| `js/vendor/codemirror/c/dist-MHVEMUZ6.js` | 1 | vendor | vendor/codemirror/c/dist-MHVEMUZ6.js |
| `js/vendor/codemirror/c/dist-O5UVQZJV.js` | 1 | vendor | vendor/codemirror/c/dist-O5UVQZJV.js |
| `js/vendor/codemirror/c/dist-OH2W4WE6.js` | 1 | vendor | vendor/codemirror/c/dist-OH2W4WE6.js |
| `js/vendor/codemirror/c/dist-OV5CEEXA.js` | 2 | vendor | vendor/codemirror/c/dist-OV5CEEXA.js |
| `js/vendor/codemirror/c/dist-QSDUX6Y5.js` | 1 | vendor | vendor/codemirror/c/dist-QSDUX6Y5.js |
| `js/vendor/codemirror/c/dist-R5TFER2T.js` | 1 | vendor | vendor/codemirror/c/dist-R5TFER2T.js |
| `js/vendor/codemirror/c/dist-U3H2HL3W.js` | 1 | vendor | vendor/codemirror/c/dist-U3H2HL3W.js |
| `js/vendor/codemirror/c/dist-Y2MO5DJ2.js` | 1 | vendor | vendor/codemirror/c/dist-Y2MO5DJ2.js |
| `js/vendor/codemirror/c/dist-YTTGY25H.js` | 7 | vendor | vendor/codemirror/c/dist-YTTGY25H.js |
| `js/vendor/codemirror/c/dist-ZKMG3Y5C.js` | 1 | vendor | vendor/codemirror/c/dist-ZKMG3Y5C.js |
| `js/vendor/codemirror/c/dockerfile-PWBO6ACQ.js` | 1 | vendor | vendor/codemirror/c/dockerfile-PWBO6ACQ.js |
| `js/vendor/codemirror/c/dtd-22O4DOXQ.js` | 1 | vendor | vendor/codemirror/c/dtd-22O4DOXQ.js |
| `js/vendor/codemirror/c/dylan-77IVWD3V.js` | 1 | vendor | vendor/codemirror/c/dylan-77IVWD3V.js |
| `js/vendor/codemirror/c/ebnf-6IDCA4J7.js` | 1 | vendor | vendor/codemirror/c/ebnf-6IDCA4J7.js |
| `js/vendor/codemirror/c/ecl-WICAYUVQ.js` | 1 | vendor | vendor/codemirror/c/ecl-WICAYUVQ.js |
| `js/vendor/codemirror/c/eiffel-L53NJJEC.js` | 1 | vendor | vendor/codemirror/c/eiffel-L53NJJEC.js |
| `js/vendor/codemirror/c/elm-3RB5DGC7.js` | 1 | vendor | vendor/codemirror/c/elm-3RB5DGC7.js |
| `js/vendor/codemirror/c/erlang-Q2GQZNEX.js` | 1 | vendor | vendor/codemirror/c/erlang-Q2GQZNEX.js |
| `js/vendor/codemirror/c/factor-X2EE7H7B.js` | 1 | vendor | vendor/codemirror/c/factor-X2EE7H7B.js |
| `js/vendor/codemirror/c/fcl-CNDTWJXV.js` | 1 | vendor | vendor/codemirror/c/fcl-CNDTWJXV.js |
| `js/vendor/codemirror/c/forth-WDIU4MH2.js` | 1 | vendor | vendor/codemirror/c/forth-WDIU4MH2.js |
| `js/vendor/codemirror/c/fortran-V2AMY5K3.js` | 1 | vendor | vendor/codemirror/c/fortran-V2AMY5K3.js |
| `js/vendor/codemirror/c/gas-EQP3DVPM.js` | 1 | vendor | vendor/codemirror/c/gas-EQP3DVPM.js |
| `js/vendor/codemirror/c/gherkin-HLZMEF2L.js` | 1 | vendor | vendor/codemirror/c/gherkin-HLZMEF2L.js |
| `js/vendor/codemirror/c/groovy-EPBAGFEI.js` | 1 | vendor | vendor/codemirror/c/groovy-EPBAGFEI.js |
| `js/vendor/codemirror/c/haskell-JJSVL5US.js` | 1 | vendor | vendor/codemirror/c/haskell-JJSVL5US.js |
| `js/vendor/codemirror/c/haxe-RMBZECDX.js` | 1 | vendor | vendor/codemirror/c/haxe-RMBZECDX.js |
| `js/vendor/codemirror/c/http-TEJL4FRB.js` | 1 | vendor | vendor/codemirror/c/http-TEJL4FRB.js |
| `js/vendor/codemirror/c/idl-HMPKIHMH.js` | 1 | vendor | vendor/codemirror/c/idl-HMPKIHMH.js |
| `js/vendor/codemirror/c/javascript-BBKDC7FN.js` | 1 | vendor | vendor/codemirror/c/javascript-BBKDC7FN.js |
| `js/vendor/codemirror/c/julia-6UML5YQH.js` | 1 | vendor | vendor/codemirror/c/julia-6UML5YQH.js |
| `js/vendor/codemirror/c/livescript-Z5IUWFXF.js` | 1 | vendor | vendor/codemirror/c/livescript-Z5IUWFXF.js |
| `js/vendor/codemirror/c/lua-LNZZVBTV.js` | 1 | vendor | vendor/codemirror/c/lua-LNZZVBTV.js |
| `js/vendor/codemirror/c/mathematica-QSKPMNJE.js` | 1 | vendor | vendor/codemirror/c/mathematica-QSKPMNJE.js |
| `js/vendor/codemirror/c/mbox-5M24JXXG.js` | 1 | vendor | vendor/codemirror/c/mbox-5M24JXXG.js |
| `js/vendor/codemirror/c/mirc-WBSGLMUN.js` | 1 | vendor | vendor/codemirror/c/mirc-WBSGLMUN.js |
| `js/vendor/codemirror/c/mllike-LKVMBYHJ.js` | 1 | vendor | vendor/codemirror/c/mllike-LKVMBYHJ.js |
| `js/vendor/codemirror/c/modelica-L3UZRMGL.js` | 1 | vendor | vendor/codemirror/c/modelica-L3UZRMGL.js |
| `js/vendor/codemirror/c/mscgen-KSRWA5YQ.js` | 1 | vendor | vendor/codemirror/c/mscgen-KSRWA5YQ.js |
| `js/vendor/codemirror/c/mumps-M7J5AAYC.js` | 1 | vendor | vendor/codemirror/c/mumps-M7J5AAYC.js |
| `js/vendor/codemirror/c/nginx-5DWW4OHT.js` | 1 | vendor | vendor/codemirror/c/nginx-5DWW4OHT.js |
| `js/vendor/codemirror/c/nsis-LLAZ27CY.js` | 1 | vendor | vendor/codemirror/c/nsis-LLAZ27CY.js |
| `js/vendor/codemirror/c/ntriples-2CYIF6HC.js` | 1 | vendor | vendor/codemirror/c/ntriples-2CYIF6HC.js |
| `js/vendor/codemirror/c/octave-HMKHJROG.js` | 1 | vendor | vendor/codemirror/c/octave-HMKHJROG.js |
| `js/vendor/codemirror/c/oz-DUJOTWZ6.js` | 1 | vendor | vendor/codemirror/c/oz-DUJOTWZ6.js |
| `js/vendor/codemirror/c/pascal-EQQWMK2C.js` | 1 | vendor | vendor/codemirror/c/pascal-EQQWMK2C.js |
| `js/vendor/codemirror/c/perl-WQW535WL.js` | 1 | vendor | vendor/codemirror/c/perl-WQW535WL.js |
| `js/vendor/codemirror/c/pig-MTS6NLKZ.js` | 1 | vendor | vendor/codemirror/c/pig-MTS6NLKZ.js |
| `js/vendor/codemirror/c/powershell-NEEJC4LW.js` | 1 | vendor | vendor/codemirror/c/powershell-NEEJC4LW.js |
| `js/vendor/codemirror/c/properties-AXKDPFVG.js` | 1 | vendor | vendor/codemirror/c/properties-AXKDPFVG.js |
| `js/vendor/codemirror/c/protobuf-B24LGJB2.js` | 1 | vendor | vendor/codemirror/c/protobuf-B24LGJB2.js |
| `js/vendor/codemirror/c/pug-SCHR77TH.js` | 1 | vendor | vendor/codemirror/c/pug-SCHR77TH.js |
| `js/vendor/codemirror/c/puppet-CBBBRAYM.js` | 1 | vendor | vendor/codemirror/c/puppet-CBBBRAYM.js |
| `js/vendor/codemirror/c/python-EGTXQAYX.js` | 1 | vendor | vendor/codemirror/c/python-EGTXQAYX.js |
| `js/vendor/codemirror/c/q-SUULM3PC.js` | 1 | vendor | vendor/codemirror/c/q-SUULM3PC.js |
| `js/vendor/codemirror/c/r-HFZB5IIJ.js` | 1 | vendor | vendor/codemirror/c/r-HFZB5IIJ.js |
| `js/vendor/codemirror/c/rpm-5N7FBF4V.js` | 1 | vendor | vendor/codemirror/c/rpm-5N7FBF4V.js |
| `js/vendor/codemirror/c/ruby-QOBQUME4.js` | 1 | vendor | vendor/codemirror/c/ruby-QOBQUME4.js |
| `js/vendor/codemirror/c/sas-3KU6GFDV.js` | 1 | vendor | vendor/codemirror/c/sas-3KU6GFDV.js |
| `js/vendor/codemirror/c/scheme-K4AMW6A2.js` | 1 | vendor | vendor/codemirror/c/scheme-K4AMW6A2.js |
| `js/vendor/codemirror/c/shell-YGI2UXMW.js` | 1 | vendor | vendor/codemirror/c/shell-YGI2UXMW.js |
| `js/vendor/codemirror/c/sieve-VMKCDKWK.js` | 1 | vendor | vendor/codemirror/c/sieve-VMKCDKWK.js |
| `js/vendor/codemirror/c/smalltalk-2JJWJCY6.js` | 1 | vendor | vendor/codemirror/c/smalltalk-2JJWJCY6.js |
| `js/vendor/codemirror/c/solr-EOYGUCLJ.js` | 1 | vendor | vendor/codemirror/c/solr-EOYGUCLJ.js |
| `js/vendor/codemirror/c/sparql-2UNW6W4O.js` | 1 | vendor | vendor/codemirror/c/sparql-2UNW6W4O.js |
| `js/vendor/codemirror/c/spreadsheet-S4ITESQF.js` | 1 | vendor | vendor/codemirror/c/spreadsheet-S4ITESQF.js |
| `js/vendor/codemirror/c/sql-CYMBV4IL.js` | 1 | vendor | vendor/codemirror/c/sql-CYMBV4IL.js |
| `js/vendor/codemirror/c/stex-RG3QFSW2.js` | 1 | vendor | vendor/codemirror/c/stex-RG3QFSW2.js |
| `js/vendor/codemirror/c/stylus-MT75ZRUL.js` | 1 | vendor | vendor/codemirror/c/stylus-MT75ZRUL.js |
| `js/vendor/codemirror/c/swift-RUSJRN5T.js` | 1 | vendor | vendor/codemirror/c/swift-RUSJRN5T.js |
| `js/vendor/codemirror/c/tcl-SU3EVUZ4.js` | 1 | vendor | vendor/codemirror/c/tcl-SU3EVUZ4.js |
| `js/vendor/codemirror/c/textile-GJDHYNHQ.js` | 1 | vendor | vendor/codemirror/c/textile-GJDHYNHQ.js |
| `js/vendor/codemirror/c/tiddlywiki-MJF5G2CH.js` | 1 | vendor | vendor/codemirror/c/tiddlywiki-MJF5G2CH.js |
| `js/vendor/codemirror/c/tiki-2SAVLYI6.js` | 1 | vendor | vendor/codemirror/c/tiki-2SAVLYI6.js |
| `js/vendor/codemirror/c/toml-6AXEA3OY.js` | 1 | vendor | vendor/codemirror/c/toml-6AXEA3OY.js |
| `js/vendor/codemirror/c/troff-F6PHJ5G5.js` | 1 | vendor | vendor/codemirror/c/troff-F6PHJ5G5.js |
| `js/vendor/codemirror/c/ttcn-FZDXDCB5.js` | 1 | vendor | vendor/codemirror/c/ttcn-FZDXDCB5.js |
| `js/vendor/codemirror/c/ttcn-cfg-IMMX5NBJ.js` | 1 | vendor | vendor/codemirror/c/ttcn-cfg-IMMX5NBJ.js |
| `js/vendor/codemirror/c/turtle-CF4XY2NI.js` | 1 | vendor | vendor/codemirror/c/turtle-CF4XY2NI.js |
| `js/vendor/codemirror/c/vb-HIZYQHNB.js` | 1 | vendor | vendor/codemirror/c/vb-HIZYQHNB.js |
| `js/vendor/codemirror/c/vbscript-HKX7W2Z4.js` | 1 | vendor | vendor/codemirror/c/vbscript-HKX7W2Z4.js |
| `js/vendor/codemirror/c/velocity-M5NSSGPO.js` | 1 | vendor | vendor/codemirror/c/velocity-M5NSSGPO.js |
| `js/vendor/codemirror/c/verilog-ZBBFBS7R.js` | 1 | vendor | vendor/codemirror/c/verilog-ZBBFBS7R.js |
| `js/vendor/codemirror/c/vhdl-KLX4YS33.js` | 1 | vendor | vendor/codemirror/c/vhdl-KLX4YS33.js |
| `js/vendor/codemirror/c/webidl-2RLDUOE5.js` | 1 | vendor | vendor/codemirror/c/webidl-2RLDUOE5.js |
| `js/vendor/codemirror/c/xquery-2YVB7HFQ.js` | 1 | vendor | vendor/codemirror/c/xquery-2YVB7HFQ.js |
| `js/vendor/codemirror/c/yacas-TB6CIIEF.js` | 1 | vendor | vendor/codemirror/c/yacas-TB6CIIEF.js |
| `js/vendor/codemirror/c/z80-VRQRQAML.js` | 1 | vendor | vendor/codemirror/c/z80-VRQRQAML.js |
| `js/vendor/codemirror/cm.js` | 2 | vendor | vendor/codemirror/cm.js |
| `js/vendor/codemirror/manifest.json` | 581 | vendor | vendor/codemirror/manifest.json |
| `js/vendor/codemirror/merge.js` | 3 | vendor | vendor/codemirror/merge.js |
| `js/vendor/katex/LICENSE` |  | vendor | vendor/katex/LICENSE |
| `js/vendor/katex/README.md` | 3 | vendor | vendor/katex/README.md |
| `js/vendor/katex/fonts/KaTeX_AMS-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_AMS-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2 |
| `js/vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2 |
| `js/vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Main-Bold.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Main-Bold.woff2 |
| `js/vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2 |
| `js/vendor/katex/fonts/KaTeX_Main-Italic.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Main-Italic.woff2 |
| `js/vendor/katex/fonts/KaTeX_Main-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Main-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2 |
| `js/vendor/katex/fonts/KaTeX_Math-Italic.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Math-Italic.woff2 |
| `js/vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2` |  | vendor | vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2 |
| `js/vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2` |  | vendor | vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2 |
| `js/vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Script-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Script-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Size1-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Size1-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Size2-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Size2-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Size3-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Size3-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Size4-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Size4-Regular.woff2 |
| `js/vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2` |  | vendor | vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2 |
| `js/vendor/katex/katex.min.css` | 1 | vendor | vendor/katex/katex.min.css |
| `js/vendor/katex/katex.min.js` | 1 | vendor | vendor/katex/katex.min.js |
| `js/vendor/lucide/LICENSE` |  | planned | delete: no importer anywhere (owner D6) |
| `js/vendor/lucide/files.js` | 25 | planned | delete: no importer anywhere (owner D6) |
| `js/vendor/lucide/projects.js` | 38 | planned | delete: no importer anywhere (owner D6) |
| `js/vendor/mermaid/LICENSE` |  | vendor | vendor/mermaid/LICENSE |
| `js/vendor/mermaid/README.md` | 3 | vendor | vendor/mermaid/README.md |
| `js/vendor/mermaid/chunks/mermaid.esm.min/abnfDiagram-7WIW2FYK.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/abnfDiagram-7WIW2FYK.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/architecture-LC7QOZUM-5NGVVLDI.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/architecture-LC7QOZUM-5NGVVLDI.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/architectureDiagram-K7MV6ERW.mjs` | 36 | vendor | vendor/mermaid/chunks/mermaid.esm.min/architectureDiagram-K7MV6ERW.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/blockDiagram-O3Z2S55I.mjs` | 140 | vendor | vendor/mermaid/chunks/mermaid.esm.min/blockDiagram-O3Z2S55I.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/bpmnIcons-YJSSVMIT.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/bpmnIcons-YJSSVMIT.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/c4Diagram-7J26TYSL.mjs` | 38 | vendor | vendor/mermaid/chunks/mermaid.esm.min/c4Diagram-7J26TYSL.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-3DCBE5TA.mjs` | 62 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-3DCBE5TA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-3NO356PZ.mjs` | 10 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-3NO356PZ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-4J7XMMR5.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-4J7XMMR5.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-5LJW3EUZ.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-5LJW3EUZ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-6GTQGJNM.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-6GTQGJNM.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-767MNKTJ.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-767MNKTJ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-A3LLD7C6.mjs` | 15 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-A3LLD7C6.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-AD2K7U72.mjs` | 88 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-AD2K7U72.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-AEP47HME.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-AEP47HME.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-C7QCCU7L.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-C7QCCU7L.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-CG7VIXT6.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-CG7VIXT6.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-CPAW7BRR.mjs` | 339 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-CPAW7BRR.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-DJPHBUKM.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-DJPHBUKM.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-EB7S5WDG.mjs` | 2 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-EB7S5WDG.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-EKDPPX6U.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-EKDPPX6U.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-ETFDQZFQ.mjs` | 2 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-ETFDQZFQ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-FB4HB4A2.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-FB4HB4A2.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-FCGY7WDG.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-FCGY7WDG.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-FRYFDGAD.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-FRYFDGAD.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-G35KUZXD.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-G35KUZXD.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-H3Y7VZGV.mjs` | 14 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-H3Y7VZGV.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-IJTDMCXQ.mjs` | 32 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-IJTDMCXQ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-JENJ2NYI.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-JENJ2NYI.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-KNGDTZMA.mjs` | 70 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-KNGDTZMA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-MWUZ53VY.mjs` | 136 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-MWUZ53VY.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-N3CUNPOK.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-N3CUNPOK.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-NXZFCOWJ.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-NXZFCOWJ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-NYALJP3A.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-NYALJP3A.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-OO6OXEJO.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-OO6OXEJO.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-OWKPCAA4.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-OWKPCAA4.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-PHMQW7SG.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-PHMQW7SG.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-PNVTB6QF.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-PNVTB6QF.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-Q7AU6FSL.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-Q7AU6FSL.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-QQ4VTD2Z.mjs` | 2 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-QQ4VTD2Z.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-QQEUQRS4.mjs` | 2 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-QQEUQRS4.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-S2SV4DS7.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-S2SV4DS7.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-SQB72GJH.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-SQB72GJH.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-SVHOGJPR.mjs` | 213 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-SVHOGJPR.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-UCIVM6JH.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-UCIVM6JH.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-UGEUIIAL.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-UGEUIIAL.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-V3YWWTDH.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-V3YWWTDH.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-VHEAKMU3.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-VHEAKMU3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-VLFMOWSA.mjs` | 135 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-VLFMOWSA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-XU3RQ3PZ.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-XU3RQ3PZ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-XWQP5P3V.mjs` | 3 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-XWQP5P3V.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-Z2IEFKAF.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-Z2IEFKAF.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/chunk-ZJBQKVUR.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/chunk-ZJBQKVUR.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/classDiagram-v2-OX5G5VGB.mjs` | 217 | vendor | vendor/mermaid/chunks/mermaid.esm.min/classDiagram-v2-OX5G5VGB.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/cose-bilkent-U4P6ZWTA.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/cose-bilkent-U4P6ZWTA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/cynefin-SQZ4V6AE-EBUGBJB2.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/cynefin-SQZ4V6AE-EBUGBJB2.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/cynefinDiagram-IQ4ZJOH3.mjs` | 62 | vendor | vendor/mermaid/chunks/mermaid.esm.min/cynefinDiagram-IQ4ZJOH3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/dagre-75NMZP4T.mjs` | 4 | vendor | vendor/mermaid/chunks/mermaid.esm.min/dagre-75NMZP4T.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-5EDX5UH3.mjs` | 200 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-5EDX5UH3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-733GHHTT.mjs` | 41 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-733GHHTT.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-A5NIFI4L.mjs` | 3 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-A5NIFI4L.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-G5JTDQRA.mjs` | 24 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-G5JTDQRA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-KC4HS2L5.mjs` | 24 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-KC4HS2L5.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/diagram-LXLKFC5Q.mjs` | 30 | vendor | vendor/mermaid/chunks/mermaid.esm.min/diagram-LXLKFC5Q.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/ebnfDiagram-R2OZYWV5.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/ebnfDiagram-R2OZYWV5.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/elk-VW7CPVO3.mjs` | 25 | vendor | vendor/mermaid/chunks/mermaid.esm.min/elk-VW7CPVO3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/erDiagram-EZESABAN.mjs` | 99 | vendor | vendor/mermaid/chunks/mermaid.esm.min/erDiagram-EZESABAN.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/eventmodeling-QR7CT3BE-GD4POLK5.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/eventmodeling-QR7CT3BE-GD4POLK5.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/flowDiagram-MIYXRJYK.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/flowDiagram-MIYXRJYK.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/ganttDiagram-KOIEMFUK.mjs` | 292 | vendor | vendor/mermaid/chunks/mermaid.esm.min/ganttDiagram-KOIEMFUK.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/gitGraph-S4SDYQ5E-BX3VVCOW.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/gitGraph-S4SDYQ5E-BX3VVCOW.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/gitGraphDiagram-A2SMY64T.mjs` | 106 | vendor | vendor/mermaid/chunks/mermaid.esm.min/gitGraphDiagram-A2SMY64T.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/info-5BNCTR6C-ODGUMPAX.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/info-5BNCTR6C-ODGUMPAX.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/infoDiagram-CVPKPPGR.mjs` | 2 | vendor | vendor/mermaid/chunks/mermaid.esm.min/infoDiagram-CVPKPPGR.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/ishikawaDiagram-EMHLID2X.mjs` | 70 | vendor | vendor/mermaid/chunks/mermaid.esm.min/ishikawaDiagram-EMHLID2X.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/journeyDiagram-34ETIHJA.mjs` | 139 | vendor | vendor/mermaid/chunks/mermaid.esm.min/journeyDiagram-34ETIHJA.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/kanban-definition-3VVCP34E.mjs` | 89 | vendor | vendor/mermaid/chunks/mermaid.esm.min/kanban-definition-3VVCP34E.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/katex-HEAVHIDR.mjs` | 257 | vendor | vendor/mermaid/chunks/mermaid.esm.min/katex-HEAVHIDR.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/mindmap-definition-QGXWIBFW.mjs` | 98 | vendor | vendor/mermaid/chunks/mermaid.esm.min/mindmap-definition-QGXWIBFW.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/packet-FDJJNMMN-G7IL4JUV.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/packet-FDJJNMMN-G7IL4JUV.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/pegDiagram-TMXEBKVO.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/pegDiagram-TMXEBKVO.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/pie-BMGGJ4DP-PPLMLEAI.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/pie-BMGGJ4DP-PPLMLEAI.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/pieDiagram-A4ONI7YG.mjs` | 39 | vendor | vendor/mermaid/chunks/mermaid.esm.min/pieDiagram-A4ONI7YG.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/quadrantDiagram-SUBAGY5T.mjs` | 7 | vendor | vendor/mermaid/chunks/mermaid.esm.min/quadrantDiagram-SUBAGY5T.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/radar-4MYH26CV-J7F73TLN.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/radar-4MYH26CV-J7F73TLN.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/railroad-UC74YYTJ-NDW2JIG3.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/railroad-UC74YYTJ-NDW2JIG3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/railroad-abnf-63ZTAFXO-CNIYIKXO.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/railroad-abnf-63ZTAFXO-CNIYIKXO.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/railroad-ebnf-WVTJNEEQ-DSHHJI4S.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/railroad-ebnf-WVTJNEEQ-DSHHJI4S.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/railroad-peg-W4VBZIEU-7RBE7FRH.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/railroad-peg-W4VBZIEU-7RBE7FRH.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/railroadDiagram-LDGO7TFH.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/railroadDiagram-LDGO7TFH.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/requirementDiagram-AGPKMLJZ.mjs` | 84 | vendor | vendor/mermaid/chunks/mermaid.esm.min/requirementDiagram-AGPKMLJZ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/sankeyDiagram-BSWYR3MM.mjs` | 40 | vendor | vendor/mermaid/chunks/mermaid.esm.min/sankeyDiagram-BSWYR3MM.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/sequenceDiagram-7K4MKO6P.mjs` | 169 | vendor | vendor/mermaid/chunks/mermaid.esm.min/sequenceDiagram-7K4MKO6P.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/sizeCapture-56ELNSSC.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/sizeCapture-56ELNSSC.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/stateDiagram-v2-7EDNTZT3.mjs` | 291 | vendor | vendor/mermaid/chunks/mermaid.esm.min/stateDiagram-v2-7EDNTZT3.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/swimlanes-VL4ZZWC5.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/swimlanes-VL4ZZWC5.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/swimlanesDiagram-6D5TTVIN.mjs` | 8 | vendor | vendor/mermaid/chunks/mermaid.esm.min/swimlanesDiagram-6D5TTVIN.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/timeline-definition-RSFCTRKZ.mjs` | 120 | vendor | vendor/mermaid/chunks/mermaid.esm.min/timeline-definition-RSFCTRKZ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/treeView-OWB7PY5U-RUKUIZU4.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/treeView-OWB7PY5U-RUKUIZU4.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/treemap-B4MHVWJL-DHMOZ63S.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/treemap-B4MHVWJL-DHMOZ63S.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/usecaseDiagram-KXV27WTT.mjs` | 370 | vendor | vendor/mermaid/chunks/mermaid.esm.min/usecaseDiagram-KXV27WTT.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/vennDiagram-WTUZ5ZZJ.mjs` | 34 | vendor | vendor/mermaid/chunks/mermaid.esm.min/vennDiagram-WTUZ5ZZJ.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/wardley-ZOP5H4X3-LCQ4757O.mjs` | 1 | vendor | vendor/mermaid/chunks/mermaid.esm.min/wardley-ZOP5H4X3-LCQ4757O.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/wardleyDiagram-KARA5GED.mjs` | 78 | vendor | vendor/mermaid/chunks/mermaid.esm.min/wardleyDiagram-KARA5GED.mjs |
| `js/vendor/mermaid/chunks/mermaid.esm.min/xychartDiagram-IFGWRUGB.mjs` | 7 | vendor | vendor/mermaid/chunks/mermaid.esm.min/xychartDiagram-IFGWRUGB.mjs |
| `js/vendor/mermaid/mermaid.esm.min.mjs` | 14 | vendor | vendor/mermaid/mermaid.esm.min.mjs |
| `js/vendor/pierre-diffs/LICENSES.md` | 1044 | vendor | vendor/pierre-diffs/LICENSES.md |
| `js/vendor/pierre-diffs/c/c-E6GJF7NI.js` | 1 | vendor | vendor/pierre-diffs/c/c-E6GJF7NI.js |
| `js/vendor/pierre-diffs/c/chunk-44DXQCPQ.js` | 12 | vendor | vendor/pierre-diffs/c/chunk-44DXQCPQ.js |
| `js/vendor/pierre-diffs/c/chunk-4IOWYWJK.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-4IOWYWJK.js |
| `js/vendor/pierre-diffs/c/chunk-55MH5PQL.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-55MH5PQL.js |
| `js/vendor/pierre-diffs/c/chunk-5B225VTB.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-5B225VTB.js |
| `js/vendor/pierre-diffs/c/chunk-5EAMECPK.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-5EAMECPK.js |
| `js/vendor/pierre-diffs/c/chunk-6DRUME2C.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-6DRUME2C.js |
| `js/vendor/pierre-diffs/c/chunk-B5JCA7FL.js` | 6 | vendor | vendor/pierre-diffs/c/chunk-B5JCA7FL.js |
| `js/vendor/pierre-diffs/c/chunk-BK2WVYD3.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-BK2WVYD3.js |
| `js/vendor/pierre-diffs/c/chunk-C4WP6UCZ.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-C4WP6UCZ.js |
| `js/vendor/pierre-diffs/c/chunk-COQVLBQQ.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-COQVLBQQ.js |
| `js/vendor/pierre-diffs/c/chunk-CSVUL5XU.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-CSVUL5XU.js |
| `js/vendor/pierre-diffs/c/chunk-DMZPRWQH.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-DMZPRWQH.js |
| `js/vendor/pierre-diffs/c/chunk-FE5RNAGX.js` | 4 | vendor | vendor/pierre-diffs/c/chunk-FE5RNAGX.js |
| `js/vendor/pierre-diffs/c/chunk-GDS6EWX4.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-GDS6EWX4.js |
| `js/vendor/pierre-diffs/c/chunk-GH32RRK2.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-GH32RRK2.js |
| `js/vendor/pierre-diffs/c/chunk-GSLF6MYV.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-GSLF6MYV.js |
| `js/vendor/pierre-diffs/c/chunk-IZTSSURO.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-IZTSSURO.js |
| `js/vendor/pierre-diffs/c/chunk-JOVE6I5V.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-JOVE6I5V.js |
| `js/vendor/pierre-diffs/c/chunk-KTO25AQE.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-KTO25AQE.js |
| `js/vendor/pierre-diffs/c/chunk-KVYOQB5X.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-KVYOQB5X.js |
| `js/vendor/pierre-diffs/c/chunk-ODSXUJHG.js` | 4 | vendor | vendor/pierre-diffs/c/chunk-ODSXUJHG.js |
| `js/vendor/pierre-diffs/c/chunk-OLGIO5N2.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-OLGIO5N2.js |
| `js/vendor/pierre-diffs/c/chunk-PWFN676X.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-PWFN676X.js |
| `js/vendor/pierre-diffs/c/chunk-Q4NTYJPP.js` | 13 | vendor | vendor/pierre-diffs/c/chunk-Q4NTYJPP.js |
| `js/vendor/pierre-diffs/c/chunk-S2YDH2LV.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-S2YDH2LV.js |
| `js/vendor/pierre-diffs/c/chunk-SCIXL5K2.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-SCIXL5K2.js |
| `js/vendor/pierre-diffs/c/chunk-UFRYVWBF.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-UFRYVWBF.js |
| `js/vendor/pierre-diffs/c/chunk-USZMECQA.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-USZMECQA.js |
| `js/vendor/pierre-diffs/c/chunk-VWA6NOV4.js` | 5 | vendor | vendor/pierre-diffs/c/chunk-VWA6NOV4.js |
| `js/vendor/pierre-diffs/c/chunk-WRI3QP5R.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-WRI3QP5R.js |
| `js/vendor/pierre-diffs/c/chunk-XX3UT7DY.js` | 9 | vendor | vendor/pierre-diffs/c/chunk-XX3UT7DY.js |
| `js/vendor/pierre-diffs/c/chunk-YJIS2WGN.js` | 1 | vendor | vendor/pierre-diffs/c/chunk-YJIS2WGN.js |
| `js/vendor/pierre-diffs/c/chunk-ZJCWFOS4.js` | 2 | vendor | vendor/pierre-diffs/c/chunk-ZJCWFOS4.js |
| `js/vendor/pierre-diffs/c/core-VVROIH2Y.js` | 1 | vendor | vendor/pierre-diffs/c/core-VVROIH2Y.js |
| `js/vendor/pierre-diffs/c/cpp-RQHBHALA.js` | 1 | vendor | vendor/pierre-diffs/c/cpp-RQHBHALA.js |
| `js/vendor/pierre-diffs/c/csharp-MKRDPSCP.js` | 1 | vendor | vendor/pierre-diffs/c/csharp-MKRDPSCP.js |
| `js/vendor/pierre-diffs/c/css-6MBMU5OL.js` | 1 | vendor | vendor/pierre-diffs/c/css-6MBMU5OL.js |
| `js/vendor/pierre-diffs/c/dart-P3RGXNHQ.js` | 1 | vendor | vendor/pierre-diffs/c/dart-P3RGXNHQ.js |
| `js/vendor/pierre-diffs/c/diff-T7NG25EN.js` | 1 | vendor | vendor/pierre-diffs/c/diff-T7NG25EN.js |
| `js/vendor/pierre-diffs/c/docker-XIIWKV2C.js` | 1 | vendor | vendor/pierre-diffs/c/docker-XIIWKV2C.js |
| `js/vendor/pierre-diffs/c/dotenv-CMUSFK6V.js` | 1 | vendor | vendor/pierre-diffs/c/dotenv-CMUSFK6V.js |
| `js/vendor/pierre-diffs/c/elixir-DS2QBGHL.js` | 1 | vendor | vendor/pierre-diffs/c/elixir-DS2QBGHL.js |
| `js/vendor/pierre-diffs/c/engine-javascript-WGSM3T5S.js` | 141 | vendor | vendor/pierre-diffs/c/engine-javascript-WGSM3T5S.js |
| `js/vendor/pierre-diffs/c/go-5SB7NSJA.js` | 1 | vendor | vendor/pierre-diffs/c/go-5SB7NSJA.js |
| `js/vendor/pierre-diffs/c/graphql-PWCE6PFX.js` | 1 | vendor | vendor/pierre-diffs/c/graphql-PWCE6PFX.js |
| `js/vendor/pierre-diffs/c/haskell-BBSSOQDS.js` | 1 | vendor | vendor/pierre-diffs/c/haskell-BBSSOQDS.js |
| `js/vendor/pierre-diffs/c/highlights-CpZm9DAR-L5VU3M23.js` | 1 | vendor | vendor/pierre-diffs/c/highlights-CpZm9DAR-L5VU3M23.js |
| `js/vendor/pierre-diffs/c/highlights-MJMIXFLK.js` | 1 | vendor | vendor/pierre-diffs/c/highlights-MJMIXFLK.js |
| `js/vendor/pierre-diffs/c/html-5SOSCFNQ.js` | 1 | vendor | vendor/pierre-diffs/c/html-5SOSCFNQ.js |
| `js/vendor/pierre-diffs/c/ini-IF5UVB7F.js` | 1 | vendor | vendor/pierre-diffs/c/ini-IF5UVB7F.js |
| `js/vendor/pierre-diffs/c/java-NAPIS6UP.js` | 1 | vendor | vendor/pierre-diffs/c/java-NAPIS6UP.js |
| `js/vendor/pierre-diffs/c/javascript-ZCEZCRIC.js` | 1 | vendor | vendor/pierre-diffs/c/javascript-ZCEZCRIC.js |
| `js/vendor/pierre-diffs/c/json-SYS7OU3R.js` | 1 | vendor | vendor/pierre-diffs/c/json-SYS7OU3R.js |
| `js/vendor/pierre-diffs/c/jsonc-MFFBD67V.js` | 1 | vendor | vendor/pierre-diffs/c/jsonc-MFFBD67V.js |
| `js/vendor/pierre-diffs/c/jsx-UQ5BHUMN.js` | 1 | vendor | vendor/pierre-diffs/c/jsx-UQ5BHUMN.js |
| `js/vendor/pierre-diffs/c/kotlin-N5GQ32KB.js` | 1 | vendor | vendor/pierre-diffs/c/kotlin-N5GQ32KB.js |
| `js/vendor/pierre-diffs/c/langs-5KGCJDPZ.js` | 1 | vendor | vendor/pierre-diffs/c/langs-5KGCJDPZ.js |
| `js/vendor/pierre-diffs/c/latex-OQSUTTNG.js` | 1 | vendor | vendor/pierre-diffs/c/latex-OQSUTTNG.js |
| `js/vendor/pierre-diffs/c/loader-6BPACEYP.js` | 1 | vendor | vendor/pierre-diffs/c/loader-6BPACEYP.js |
| `js/vendor/pierre-diffs/c/lua-KXL4G3GA.js` | 1 | vendor | vendor/pierre-diffs/c/lua-KXL4G3GA.js |
| `js/vendor/pierre-diffs/c/make-CHGIBE4M.js` | 1 | vendor | vendor/pierre-diffs/c/make-CHGIBE4M.js |
| `js/vendor/pierre-diffs/c/markdown-DWIMHI7Z.js` | 1 | vendor | vendor/pierre-diffs/c/markdown-DWIMHI7Z.js |
| `js/vendor/pierre-diffs/c/nginx-SFYOZ5NK.js` | 1 | vendor | vendor/pierre-diffs/c/nginx-SFYOZ5NK.js |
| `js/vendor/pierre-diffs/c/oniguruma-IXU7JXLS.js` | 1 | vendor | vendor/pierre-diffs/c/oniguruma-IXU7JXLS.js |
| `js/vendor/pierre-diffs/c/perl-AI7KVWEH.js` | 1 | vendor | vendor/pierre-diffs/c/perl-AI7KVWEH.js |
| `js/vendor/pierre-diffs/c/php-2SGPQ4A5.js` | 1 | vendor | vendor/pierre-diffs/c/php-2SGPQ4A5.js |
| `js/vendor/pierre-diffs/c/powershell-GXXOQ3HP.js` | 1 | vendor | vendor/pierre-diffs/c/powershell-GXXOQ3HP.js |
| `js/vendor/pierre-diffs/c/proto-DI3CFL5G.js` | 1 | vendor | vendor/pierre-diffs/c/proto-DI3CFL5G.js |
| `js/vendor/pierre-diffs/c/python-XMBOHMX6.js` | 1 | vendor | vendor/pierre-diffs/c/python-XMBOHMX6.js |
| `js/vendor/pierre-diffs/c/r-SU5RVNXF.js` | 1 | vendor | vendor/pierre-diffs/c/r-SU5RVNXF.js |
| `js/vendor/pierre-diffs/c/ruby-JRIUYIIZ.js` | 1 | vendor | vendor/pierre-diffs/c/ruby-JRIUYIIZ.js |
| `js/vendor/pierre-diffs/c/rust-JNCTHA6A.js` | 1 | vendor | vendor/pierre-diffs/c/rust-JNCTHA6A.js |
| `js/vendor/pierre-diffs/c/scala-J7ONKWUX.js` | 1 | vendor | vendor/pierre-diffs/c/scala-J7ONKWUX.js |
| `js/vendor/pierre-diffs/c/scss-MP6KL4J4.js` | 1 | vendor | vendor/pierre-diffs/c/scss-MP6KL4J4.js |
| `js/vendor/pierre-diffs/c/shellscript-2QU7FDIP.js` | 1 | vendor | vendor/pierre-diffs/c/shellscript-2QU7FDIP.js |
| `js/vendor/pierre-diffs/c/shiki-Ci4cdHsM-U4UNITAV.js` | 1 | vendor | vendor/pierre-diffs/c/shiki-Ci4cdHsM-U4UNITAV.js |
| `js/vendor/pierre-diffs/c/shiki-HQIGNS47.js` | 1 | vendor | vendor/pierre-diffs/c/shiki-HQIGNS47.js |
| `js/vendor/pierre-diffs/c/sql-F4K6GFK6.js` | 1 | vendor | vendor/pierre-diffs/c/sql-F4K6GFK6.js |
| `js/vendor/pierre-diffs/c/svelte-R7ATBZQS.js` | 1 | vendor | vendor/pierre-diffs/c/svelte-R7ATBZQS.js |
| `js/vendor/pierre-diffs/c/swift-FUMICI7N.js` | 1 | vendor | vendor/pierre-diffs/c/swift-FUMICI7N.js |
| `js/vendor/pierre-diffs/c/terraform-JDOODVTS.js` | 1 | vendor | vendor/pierre-diffs/c/terraform-JDOODVTS.js |
| `js/vendor/pierre-diffs/c/themes-4UDBBRQT.js` | 1 | vendor | vendor/pierre-diffs/c/themes-4UDBBRQT.js |
| `js/vendor/pierre-diffs/c/toml-JQUNO2V7.js` | 1 | vendor | vendor/pierre-diffs/c/toml-JQUNO2V7.js |
| `js/vendor/pierre-diffs/c/tsx-MCB6U7AX.js` | 1 | vendor | vendor/pierre-diffs/c/tsx-MCB6U7AX.js |
| `js/vendor/pierre-diffs/c/typescript-Y4D3EEH2.js` | 1 | vendor | vendor/pierre-diffs/c/typescript-Y4D3EEH2.js |
| `js/vendor/pierre-diffs/c/vue-WTJ4E6DF.js` | 1 | vendor | vendor/pierre-diffs/c/vue-WTJ4E6DF.js |
| `js/vendor/pierre-diffs/c/wasm-SMWGFCOR.js` | 1 | vendor | vendor/pierre-diffs/c/wasm-SMWGFCOR.js |
| `js/vendor/pierre-diffs/c/xml-QIC37UDC.js` | 1 | vendor | vendor/pierre-diffs/c/xml-QIC37UDC.js |
| `js/vendor/pierre-diffs/c/yaml-5I454EOF.js` | 1 | vendor | vendor/pierre-diffs/c/yaml-5I454EOF.js |
| `js/vendor/pierre-diffs/diffs.js` | 157 | vendor | vendor/pierre-diffs/diffs.js |
| `js/vendor/pierre-diffs/edit.js` | 68 | deleted | Pierre's old file editor, unused since the Files editor moved to CodeMirror (owner D6): nothing imported it |
| `js/vendor/pierre-diffs/manifest.json` | 187 | vendor | vendor/pierre-diffs/manifest.json |
| `js/vendor/pierre-diffs/worker.js` | 1 | vendor | vendor/pierre-diffs/worker.js |
| `js/vendor/pierre/LICENSE.md` | 189 | vendor | vendor/pierre/LICENSE.md |
| `js/vendor/pierre/NOTICE.md` | 35 | vendor | vendor/pierre/NOTICE.md |
| `js/vendor/pierre/icons.js` | 5 | vendor | vendor/pierre/icons.js |
| `js/vendor/xterm/LICENSE-addon-fit` |  | vendor | vendor/xterm/LICENSE-addon-fit |
| `js/vendor/xterm/LICENSE-xterm` |  | vendor | vendor/xterm/LICENSE-xterm |
| `js/vendor/xterm/README.md` | 20 | vendor | vendor/xterm/README.md |
| `js/vendor/xterm/addon-fit.mjs` | 18 | vendor | vendor/xterm/addon-fit.mjs |
| `js/vendor/xterm/xterm.css` | 285 | vendor | vendor/xterm/xterm.css |
| `js/vendor/xterm/xterm.mjs` | 53 | vendor | vendor/xterm/xterm.mjs |

## assets (385)

| File | Lines | Status | New home |
|---|---:|---|---|
| `assets/icons/xo/a-places-and-the-frame/artifacts.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/artifacts.svg |
| `assets/icons/xo/a-places-and-the-frame/changes.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/changes.svg |
| `assets/icons/xo/a-places-and-the-frame/chat.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/chat.svg |
| `assets/icons/xo/a-places-and-the-frame/exit-full-size.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/exit-full-size.svg |
| `assets/icons/xo/a-places-and-the-frame/fold-to-rail.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/fold-to-rail.svg |
| `assets/icons/xo/a-places-and-the-frame/full-size.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/full-size.svg |
| `assets/icons/xo/a-places-and-the-frame/gear.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/gear.svg |
| `assets/icons/xo/a-places-and-the-frame/graph.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/graph.svg |
| `assets/icons/xo/a-places-and-the-frame/home.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/home.svg |
| `assets/icons/xo/a-places-and-the-frame/map.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/map.svg |
| `assets/icons/xo/a-places-and-the-frame/menu.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/menu.svg |
| `assets/icons/xo/a-places-and-the-frame/moon.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/moon.svg |
| `assets/icons/xo/a-places-and-the-frame/more.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/more.svg |
| `assets/icons/xo/a-places-and-the-frame/panel-right.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/panel-right.svg |
| `assets/icons/xo/a-places-and-the-frame/plus.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/plus.svg |
| `assets/icons/xo/a-places-and-the-frame/project.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/project.svg |
| `assets/icons/xo/a-places-and-the-frame/search.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/search.svg |
| `assets/icons/xo/a-places-and-the-frame/sidebar-left.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/sidebar-left.svg |
| `assets/icons/xo/a-places-and-the-frame/sun.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/sun.svg |
| `assets/icons/xo/a-places-and-the-frame/terminal.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/terminal.svg |
| `assets/icons/xo/a-places-and-the-frame/threads.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/threads.svg |
| `assets/icons/xo/a-places-and-the-frame/xo-mark.svg` | 1 | planned | core/ui/icons/source/xo/a-places-and-the-frame/xo-mark.svg |
| `assets/icons/xo/b-arrows-and-chevrons/arrow-down.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/arrow-down.svg |
| `assets/icons/xo/b-arrows-and-chevrons/arrow-left.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/arrow-left.svg |
| `assets/icons/xo/b-arrows-and-chevrons/arrow-right.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/arrow-right.svg |
| `assets/icons/xo/b-arrows-and-chevrons/chevron-down.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/chevron-down.svg |
| `assets/icons/xo/b-arrows-and-chevrons/chevron-left.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/chevron-left.svg |
| `assets/icons/xo/b-arrows-and-chevrons/chevron-right.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/chevron-right.svg |
| `assets/icons/xo/b-arrows-and-chevrons/external-link.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/external-link.svg |
| `assets/icons/xo/b-arrows-and-chevrons/next-move.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/next-move.svg |
| `assets/icons/xo/b-arrows-and-chevrons/send.svg` | 1 | planned | core/ui/icons/source/xo/b-arrows-and-chevrons/send.svg |
| `assets/icons/xo/c-actions/attach.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/attach.svg |
| `assets/icons/xo/c-actions/check.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/check.svg |
| `assets/icons/xo/c-actions/close.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/close.svg |
| `assets/icons/xo/c-actions/code.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/code.svg |
| `assets/icons/xo/c-actions/copy.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/copy.svg |
| `assets/icons/xo/c-actions/delete.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/delete.svg |
| `assets/icons/xo/c-actions/edit.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/edit.svg |
| `assets/icons/xo/c-actions/eye.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/eye.svg |
| `assets/icons/xo/c-actions/file-new.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/file-new.svg |
| `assets/icons/xo/c-actions/fit.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/fit.svg |
| `assets/icons/xo/c-actions/follow.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/follow.svg |
| `assets/icons/xo/c-actions/interrupt.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/interrupt.svg |
| `assets/icons/xo/c-actions/key.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/key.svg |
| `assets/icons/xo/c-actions/link.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/link.svg |
| `assets/icons/xo/c-actions/lock.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/lock.svg |
| `assets/icons/xo/c-actions/minimize.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/minimize.svg |
| `assets/icons/xo/c-actions/pin.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/pin.svg |
| `assets/icons/xo/c-actions/reply.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/reply.svg |
| `assets/icons/xo/c-actions/retry.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/retry.svg |
| `assets/icons/xo/c-actions/runs-code.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/runs-code.svg |
| `assets/icons/xo/c-actions/send-back.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/send-back.svg |
| `assets/icons/xo/c-actions/split-view.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/split-view.svg |
| `assets/icons/xo/c-actions/stop.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/stop.svg |
| `assets/icons/xo/c-actions/thumbs-down.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/thumbs-down.svg |
| `assets/icons/xo/c-actions/thumbs-up.svg` | 1 | planned | core/ui/icons/source/xo/c-actions/thumbs-up.svg |
| `assets/icons/xo/d-things-and-kinds/agent-cursor.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/agent-cursor.svg |
| `assets/icons/xo/d-things-and-kinds/agent.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/agent.svg |
| `assets/icons/xo/d-things-and-kinds/branch.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/branch.svg |
| `assets/icons/xo/d-things-and-kinds/clock.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/clock.svg |
| `assets/icons/xo/d-things-and-kinds/container.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/container.svg |
| `assets/icons/xo/d-things-and-kinds/deploy.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/deploy.svg |
| `assets/icons/xo/d-things-and-kinds/doc.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/doc.svg |
| `assets/icons/xo/d-things-and-kinds/folder-open.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/folder-open.svg |
| `assets/icons/xo/d-things-and-kinds/folder.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/folder.svg |
| `assets/icons/xo/d-things-and-kinds/github.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/github.svg |
| `assets/icons/xo/d-things-and-kinds/hourglass.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/hourglass.svg |
| `assets/icons/xo/d-things-and-kinds/image.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/image.svg |
| `assets/icons/xo/d-things-and-kinds/list.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/list.svg |
| `assets/icons/xo/d-things-and-kinds/pause.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/pause.svg |
| `assets/icons/xo/d-things-and-kinds/plug.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/plug.svg |
| `assets/icons/xo/d-things-and-kinds/question.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/question.svg |
| `assets/icons/xo/d-things-and-kinds/routing.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/routing.svg |
| `assets/icons/xo/d-things-and-kinds/rules.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/rules.svg |
| `assets/icons/xo/d-things-and-kinds/runtime.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/runtime.svg |
| `assets/icons/xo/d-things-and-kinds/server.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/server.svg |
| `assets/icons/xo/d-things-and-kinds/settings-general.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/settings-general.svg |
| `assets/icons/xo/d-things-and-kinds/shape.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/shape.svg |
| `assets/icons/xo/d-things-and-kinds/sound.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/sound.svg |
| `assets/icons/xo/d-things-and-kinds/step-dot.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/step-dot.svg |
| `assets/icons/xo/d-things-and-kinds/suggestion.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/suggestion.svg |
| `assets/icons/xo/d-things-and-kinds/thread.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/thread.svg |
| `assets/icons/xo/d-things-and-kinds/warning.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/warning.svg |
| `assets/icons/xo/d-things-and-kinds/web.svg` | 1 | planned | core/ui/icons/source/xo/d-things-and-kinds/web.svg |
| `assets/icons/xo/e-state-marks/alert.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/alert.svg |
| `assets/icons/xo/e-state-marks/badge-working.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/badge-working.svg |
| `assets/icons/xo/e-state-marks/effort-decide.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/effort-decide.svg |
| `assets/icons/xo/e-state-marks/effort-glance.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/effort-glance.svg |
| `assets/icons/xo/e-state-marks/effort-think.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/effort-think.svg |
| `assets/icons/xo/e-state-marks/stamp-allowed.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/stamp-allowed.svg |
| `assets/icons/xo/e-state-marks/stamp-sent-back.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/stamp-sent-back.svg |
| `assets/icons/xo/e-state-marks/state-done.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-done.svg |
| `assets/icons/xo/e-state-marks/state-failed.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-failed.svg |
| `assets/icons/xo/e-state-marks/state-held.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-held.svg |
| `assets/icons/xo/e-state-marks/state-idle.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-idle.svg |
| `assets/icons/xo/e-state-marks/state-needs-you.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-needs-you.svg |
| `assets/icons/xo/e-state-marks/state-paused.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-paused.svg |
| `assets/icons/xo/e-state-marks/state-resolved.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-resolved.svg |
| `assets/icons/xo/e-state-marks/state-stopped.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-stopped.svg |
| `assets/icons/xo/e-state-marks/state-working.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/state-working.svg |
| `assets/icons/xo/e-state-marks/step-doing.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/step-doing.svg |
| `assets/icons/xo/e-state-marks/undo-countdown.svg` | 1 | planned | core/ui/icons/source/xo/e-state-marks/undo-countdown.svg |
| `assets/icons/xo/f-keyboard-keys/key-command.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-command.svg |
| `assets/icons/xo/f-keyboard-keys/key-delete.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-delete.svg |
| `assets/icons/xo/f-keyboard-keys/key-down.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-down.svg |
| `assets/icons/xo/f-keyboard-keys/key-left.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-left.svg |
| `assets/icons/xo/f-keyboard-keys/key-option.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-option.svg |
| `assets/icons/xo/f-keyboard-keys/key-return.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-return.svg |
| `assets/icons/xo/f-keyboard-keys/key-right.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-right.svg |
| `assets/icons/xo/f-keyboard-keys/key-shift.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-shift.svg |
| `assets/icons/xo/f-keyboard-keys/key-up.svg` | 1 | planned | core/ui/icons/source/xo/f-keyboard-keys/key-up.svg |
| `assets/icons/xo/g-app-icon/favicon-progress.svg` | 1 | planned | core/ui/icons/source/xo/g-app-icon/favicon-progress.svg |
| `assets/icons/xo/g-app-icon/favicon.svg` | 1 | planned | core/ui/icons/source/xo/g-app-icon/favicon.svg |
| `assets/icons/xo/h-project-topics/project-agents.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-agents.svg |
| `assets/icons/xo/h-project-topics/project-automation.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-automation.svg |
| `assets/icons/xo/h-project-topics/project-backend.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-backend.svg |
| `assets/icons/xo/h-project-topics/project-code.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-code.svg |
| `assets/icons/xo/h-project-topics/project-data.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-data.svg |
| `assets/icons/xo/h-project-topics/project-deploy.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-deploy.svg |
| `assets/icons/xo/h-project-topics/project-design.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-design.svg |
| `assets/icons/xo/h-project-topics/project-finance.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-finance.svg |
| `assets/icons/xo/h-project-topics/project-games.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-games.svg |
| `assets/icons/xo/h-project-topics/project-hardware.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-hardware.svg |
| `assets/icons/xo/h-project-topics/project-health.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-health.svg |
| `assets/icons/xo/h-project-topics/project-interface.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-interface.svg |
| `assets/icons/xo/h-project-topics/project-learning.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-learning.svg |
| `assets/icons/xo/h-project-topics/project-legal.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-legal.svg |
| `assets/icons/xo/h-project-topics/project-marketing.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-marketing.svg |
| `assets/icons/xo/h-project-topics/project-media.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-media.svg |
| `assets/icons/xo/h-project-topics/project-messaging.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-messaging.svg |
| `assets/icons/xo/h-project-topics/project-mobile.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-mobile.svg |
| `assets/icons/xo/h-project-topics/project-music.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-music.svg |
| `assets/icons/xo/h-project-topics/project-people.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-people.svg |
| `assets/icons/xo/h-project-topics/project-pitch.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-pitch.svg |
| `assets/icons/xo/h-project-topics/project-research.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-research.svg |
| `assets/icons/xo/h-project-topics/project-security.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-security.svg |
| `assets/icons/xo/h-project-topics/project-shopping.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-shopping.svg |
| `assets/icons/xo/h-project-topics/project-space.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-space.svg |
| `assets/icons/xo/h-project-topics/project-swarm.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-swarm.svg |
| `assets/icons/xo/h-project-topics/project-travel.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-travel.svg |
| `assets/icons/xo/h-project-topics/project-video.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-video.svg |
| `assets/icons/xo/h-project-topics/project-web.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-web.svg |
| `assets/icons/xo/h-project-topics/project-work.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-work.svg |
| `assets/icons/xo/h-project-topics/project-writing.svg` | 1 | planned | core/ui/icons/source/xo/h-project-topics/project-writing.svg |
| `assets/icons/xo/i-file-types/file-archive.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-archive.svg |
| `assets/icons/xo/i-file-types/file-code-html.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-code-html.svg |
| `assets/icons/xo/i-file-types/file-database.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-database.svg |
| `assets/icons/xo/i-file-types/file-default.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-default.svg |
| `assets/icons/xo/i-file-types/file-font.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-font.svg |
| `assets/icons/xo/i-file-types/file-image.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-image.svg |
| `assets/icons/xo/i-file-types/file-json.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-json.svg |
| `assets/icons/xo/i-file-types/file-shell.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-shell.svg |
| `assets/icons/xo/i-file-types/file-svg.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-svg.svg |
| `assets/icons/xo/i-file-types/file-table.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-table.svg |
| `assets/icons/xo/i-file-types/file-text.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-text.svg |
| `assets/icons/xo/i-file-types/file-yaml.svg` | 1 | planned | core/ui/icons/source/xo/i-file-types/file-yaml.svg |
| `assets/icons/xo/j-new-in-the-pack/bell.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/bell.svg |
| `assets/icons/xo/j-new-in-the-pack/bookmark.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/bookmark.svg |
| `assets/icons/xo/j-new-in-the-pack/calendar.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/calendar.svg |
| `assets/icons/xo/j-new-in-the-pack/chat-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/chat-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/cloud.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/cloud.svg |
| `assets/icons/xo/j-new-in-the-pack/doc-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/doc-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/download.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/download.svg |
| `assets/icons/xo/j-new-in-the-pack/eye-off.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/eye-off.svg |
| `assets/icons/xo/j-new-in-the-pack/filter.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/filter.svg |
| `assets/icons/xo/j-new-in-the-pack/flag.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/flag.svg |
| `assets/icons/xo/j-new-in-the-pack/folder-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/folder-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/gear-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/gear-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/heart.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/heart.svg |
| `assets/icons/xo/j-new-in-the-pack/home-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/home-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/inbox.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/inbox.svg |
| `assets/icons/xo/j-new-in-the-pack/keyboard.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/keyboard.svg |
| `assets/icons/xo/j-new-in-the-pack/lightbulb.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/lightbulb.svg |
| `assets/icons/xo/j-new-in-the-pack/lock-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/lock-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/mic.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/mic.svg |
| `assets/icons/xo/j-new-in-the-pack/person.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/person.svg |
| `assets/icons/xo/j-new-in-the-pack/project-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/project-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/share.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/share.svg |
| `assets/icons/xo/j-new-in-the-pack/sparkles.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/sparkles.svg |
| `assets/icons/xo/j-new-in-the-pack/star.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/star.svg |
| `assets/icons/xo/j-new-in-the-pack/tag.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/tag.svg |
| `assets/icons/xo/j-new-in-the-pack/thread-fill.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/thread-fill.svg |
| `assets/icons/xo/j-new-in-the-pack/upload.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/upload.svg |
| `assets/icons/xo/j-new-in-the-pack/wand.svg` | 1 | planned | core/ui/icons/source/xo/j-new-in-the-pack/wand.svg |
| `assets/icons/xo/k-more-icons/archive.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/archive.svg |
| `assets/icons/xo/k-more-icons/arrow-up-right.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/arrow-up-right.svg |
| `assets/icons/xo/k-more-icons/at.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/at.svg |
| `assets/icons/xo/k-more-icons/bolt-fill.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/bolt-fill.svg |
| `assets/icons/xo/k-more-icons/bookmark-fill.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/bookmark-fill.svg |
| `assets/icons/xo/k-more-icons/chart-bar.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/chart-bar.svg |
| `assets/icons/xo/k-more-icons/chat-ai.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/chat-ai.svg |
| `assets/icons/xo/k-more-icons/check-circle.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/check-circle.svg |
| `assets/icons/xo/k-more-icons/checklist.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/checklist.svg |
| `assets/icons/xo/k-more-icons/chevron-up-down.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/chevron-up-down.svg |
| `assets/icons/xo/k-more-icons/compose.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/compose.svg |
| `assets/icons/xo/k-more-icons/delete-fill.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/delete-fill.svg |
| `assets/icons/xo/k-more-icons/grid.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/grid.svg |
| `assets/icons/xo/k-more-icons/hash.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/hash.svg |
| `assets/icons/xo/k-more-icons/heart-fill.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/heart-fill.svg |
| `assets/icons/xo/k-more-icons/history.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/history.svg |
| `assets/icons/xo/k-more-icons/info.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/info.svg |
| `assets/icons/xo/k-more-icons/more-circle.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/more-circle.svg |
| `assets/icons/xo/k-more-icons/paperplane.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/paperplane.svg |
| `assets/icons/xo/k-more-icons/play.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/play.svg |
| `assets/icons/xo/k-more-icons/plus-circle.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/plus-circle.svg |
| `assets/icons/xo/k-more-icons/power.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/power.svg |
| `assets/icons/xo/k-more-icons/quote.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/quote.svg |
| `assets/icons/xo/k-more-icons/rows.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/rows.svg |
| `assets/icons/xo/k-more-icons/sort.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/sort.svg |
| `assets/icons/xo/k-more-icons/star-fill.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/star-fill.svg |
| `assets/icons/xo/k-more-icons/stop-circle.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/stop-circle.svg |
| `assets/icons/xo/k-more-icons/timer.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/timer.svg |
| `assets/icons/xo/k-more-icons/wifi.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/wifi.svg |
| `assets/icons/xo/k-more-icons/x-circle.svg` | 1 | planned | core/ui/icons/source/xo/k-more-icons/x-circle.svg |
| `assets/icons/xo/l-navigation-and-arrows/arrow-down-left.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/arrow-down-left.svg |
| `assets/icons/xo/l-navigation-and-arrows/arrow-down-right.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/arrow-down-right.svg |
| `assets/icons/xo/l-navigation-and-arrows/arrow-right-circle.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/arrow-right-circle.svg |
| `assets/icons/xo/l-navigation-and-arrows/arrow-up-left.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/arrow-up-left.svg |
| `assets/icons/xo/l-navigation-and-arrows/arrow-up.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/arrow-up.svg |
| `assets/icons/xo/l-navigation-and-arrows/back-to-top.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/back-to-top.svg |
| `assets/icons/xo/l-navigation-and-arrows/checkbox.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/checkbox.svg |
| `assets/icons/xo/l-navigation-and-arrows/chevron-up.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/chevron-up.svg |
| `assets/icons/xo/l-navigation-and-arrows/chevrons-left.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/chevrons-left.svg |
| `assets/icons/xo/l-navigation-and-arrows/chevrons-right.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/chevrons-right.svg |
| `assets/icons/xo/l-navigation-and-arrows/collapse-vertical.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/collapse-vertical.svg |
| `assets/icons/xo/l-navigation-and-arrows/compass.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/compass.svg |
| `assets/icons/xo/l-navigation-and-arrows/cut.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/cut.svg |
| `assets/icons/xo/l-navigation-and-arrows/dashboard.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/dashboard.svg |
| `assets/icons/xo/l-navigation-and-arrows/drag-handle.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/drag-handle.svg |
| `assets/icons/xo/l-navigation-and-arrows/duplicate.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/duplicate.svg |
| `assets/icons/xo/l-navigation-and-arrows/expand-vertical.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/expand-vertical.svg |
| `assets/icons/xo/l-navigation-and-arrows/forward.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/forward.svg |
| `assets/icons/xo/l-navigation-and-arrows/layout-columns.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/layout-columns.svg |
| `assets/icons/xo/l-navigation-and-arrows/more-vertical.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/more-vertical.svg |
| `assets/icons/xo/l-navigation-and-arrows/move.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/move.svg |
| `assets/icons/xo/l-navigation-and-arrows/paste.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/paste.svg |
| `assets/icons/xo/l-navigation-and-arrows/redo.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/redo.svg |
| `assets/icons/xo/l-navigation-and-arrows/restore.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/restore.svg |
| `assets/icons/xo/l-navigation-and-arrows/sidebar-right.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/sidebar-right.svg |
| `assets/icons/xo/l-navigation-and-arrows/swap.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/swap.svg |
| `assets/icons/xo/l-navigation-and-arrows/sync.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/sync.svg |
| `assets/icons/xo/l-navigation-and-arrows/tabs.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/tabs.svg |
| `assets/icons/xo/l-navigation-and-arrows/undo.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/undo.svg |
| `assets/icons/xo/l-navigation-and-arrows/window.svg` | 1 | planned | core/ui/icons/source/xo/l-navigation-and-arrows/window.svg |
| `assets/icons/xo/m-editing-and-text/align-center.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/align-center.svg |
| `assets/icons/xo/m-editing-and-text/align-left.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/align-left.svg |
| `assets/icons/xo/m-editing-and-text/align-right.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/align-right.svg |
| `assets/icons/xo/m-editing-and-text/bold.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/bold.svg |
| `assets/icons/xo/m-editing-and-text/book.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/book.svg |
| `assets/icons/xo/m-editing-and-text/clipboard.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/clipboard.svg |
| `assets/icons/xo/m-editing-and-text/emoji.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/emoji.svg |
| `assets/icons/xo/m-editing-and-text/file-audio.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/file-audio.svg |
| `assets/icons/xo/m-editing-and-text/file-markdown.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/file-markdown.svg |
| `assets/icons/xo/m-editing-and-text/file-pdf.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/file-pdf.svg |
| `assets/icons/xo/m-editing-and-text/file-video.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/file-video.svg |
| `assets/icons/xo/m-editing-and-text/heading.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/heading.svg |
| `assets/icons/xo/m-editing-and-text/highlighter.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/highlighter.svg |
| `assets/icons/xo/m-editing-and-text/indent.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/indent.svg |
| `assets/icons/xo/m-editing-and-text/italic.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/italic.svg |
| `assets/icons/xo/m-editing-and-text/library.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/library.svg |
| `assets/icons/xo/m-editing-and-text/list-numbered.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/list-numbered.svg |
| `assets/icons/xo/m-editing-and-text/lock-open.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/lock-open.svg |
| `assets/icons/xo/m-editing-and-text/minus-circle.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/minus-circle.svg |
| `assets/icons/xo/m-editing-and-text/note.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/note.svg |
| `assets/icons/xo/m-editing-and-text/outdent.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/outdent.svg |
| `assets/icons/xo/m-editing-and-text/play-circle.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/play-circle.svg |
| `assets/icons/xo/m-editing-and-text/plus-square.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/plus-square.svg |
| `assets/icons/xo/m-editing-and-text/print.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/print.svg |
| `assets/icons/xo/m-editing-and-text/save.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/save.svg |
| `assets/icons/xo/m-editing-and-text/strikethrough.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/strikethrough.svg |
| `assets/icons/xo/m-editing-and-text/text-size.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/text-size.svg |
| `assets/icons/xo/m-editing-and-text/underline.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/underline.svg |
| `assets/icons/xo/m-editing-and-text/unlink.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/unlink.svg |
| `assets/icons/xo/m-editing-and-text/unpin.svg` | 1 | planned | core/ui/icons/source/xo/m-editing-and-text/unpin.svg |
| `assets/icons/xo/manifest.json` | 3081 | planned | core/ui/icons/source/xo/manifest.json |
| `assets/icons/xo/n-people-status-and-time/alarm.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/alarm.svg |
| `assets/icons/xo/n-people-status-and-time/app-badge.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/app-badge.svg |
| `assets/icons/xo/n-people-status-and-time/battery.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/battery.svg |
| `assets/icons/xo/n-people-status-and-time/bell-badge.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/bell-badge.svg |
| `assets/icons/xo/n-people-status-and-time/bell-off.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/bell-off.svg |
| `assets/icons/xo/n-people-status-and-time/calendar-add.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/calendar-add.svg |
| `assets/icons/xo/n-people-status-and-time/calendar-check.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/calendar-check.svg |
| `assets/icons/xo/n-people-status-and-time/chart-pie.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/chart-pie.svg |
| `assets/icons/xo/n-people-status-and-time/cloud-off.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/cloud-off.svg |
| `assets/icons/xo/n-people-status-and-time/comment.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/comment.svg |
| `assets/icons/xo/n-people-status-and-time/folder-add.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/folder-add.svg |
| `assets/icons/xo/n-people-status-and-time/folder-shared.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/folder-shared.svg |
| `assets/icons/xo/n-people-status-and-time/loading-dots.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/loading-dots.svg |
| `assets/icons/xo/n-people-status-and-time/location-arrow.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/location-arrow.svg |
| `assets/icons/xo/n-people-status-and-time/mail.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/mail.svg |
| `assets/icons/xo/n-people-status-and-time/mic-off.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/mic-off.svg |
| `assets/icons/xo/n-people-status-and-time/person-2.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/person-2.svg |
| `assets/icons/xo/n-people-status-and-time/person-add.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/person-add.svg |
| `assets/icons/xo/n-people-status-and-time/person-circle.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/person-circle.svg |
| `assets/icons/xo/n-people-status-and-time/person-remove.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/person-remove.svg |
| `assets/icons/xo/n-people-status-and-time/phone.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/phone.svg |
| `assets/icons/xo/n-people-status-and-time/photo-stack.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/photo-stack.svg |
| `assets/icons/xo/n-people-status-and-time/schedule-send.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/schedule-send.svg |
| `assets/icons/xo/n-people-status-and-time/shield-check.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/shield-check.svg |
| `assets/icons/xo/n-people-status-and-time/snooze.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/snooze.svg |
| `assets/icons/xo/n-people-status-and-time/spinner.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/spinner.svg |
| `assets/icons/xo/n-people-status-and-time/video-call.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/video-call.svg |
| `assets/icons/xo/n-people-status-and-time/wifi-off.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/wifi-off.svg |
| `assets/icons/xo/n-people-status-and-time/zoom-in.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/zoom-in.svg |
| `assets/icons/xo/n-people-status-and-time/zoom-out.svg` | 1 | planned | core/ui/icons/source/xo/n-people-status-and-time/zoom-out.svg |
| `assets/icons/xo/o-media-data-and-system/accessibility.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/accessibility.svg |
| `assets/icons/xo/o-media-data-and-system/bug.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/bug.svg |
| `assets/icons/xo/o-media-data-and-system/camera.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/camera.svg |
| `assets/icons/xo/o-media-data-and-system/captions.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/captions.svg |
| `assets/icons/xo/o-media-data-and-system/chart-area.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/chart-area.svg |
| `assets/icons/xo/o-media-data-and-system/contrast.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/contrast.svg |
| `assets/icons/xo/o-media-data-and-system/database.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/database.svg |
| `assets/icons/xo/o-media-data-and-system/fast-forward.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/fast-forward.svg |
| `assets/icons/xo/o-media-data-and-system/film.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/film.svg |
| `assets/icons/xo/o-media-data-and-system/fingerprint.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/fingerprint.svg |
| `assets/icons/xo/o-media-data-and-system/gauge.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/gauge.svg |
| `assets/icons/xo/o-media-data-and-system/kanban.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/kanban.svg |
| `assets/icons/xo/o-media-data-and-system/memory.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/memory.svg |
| `assets/icons/xo/o-media-data-and-system/percent.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/percent.svg |
| `assets/icons/xo/o-media-data-and-system/picture-in-picture.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/picture-in-picture.svg |
| `assets/icons/xo/o-media-data-and-system/qr-code.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/qr-code.svg |
| `assets/icons/xo/o-media-data-and-system/repeat.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/repeat.svg |
| `assets/icons/xo/o-media-data-and-system/rewind.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/rewind.svg |
| `assets/icons/xo/o-media-data-and-system/screen-share.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/screen-share.svg |
| `assets/icons/xo/o-media-data-and-system/shuffle.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/shuffle.svg |
| `assets/icons/xo/o-media-data-and-system/skip-back.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/skip-back.svg |
| `assets/icons/xo/o-media-data-and-system/skip-forward.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/skip-forward.svg |
| `assets/icons/xo/o-media-data-and-system/sliders-vertical.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/sliders-vertical.svg |
| `assets/icons/xo/o-media-data-and-system/table.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/table.svg |
| `assets/icons/xo/o-media-data-and-system/toggle.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/toggle.svg |
| `assets/icons/xo/o-media-data-and-system/translate.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/translate.svg |
| `assets/icons/xo/o-media-data-and-system/trend-down.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/trend-down.svg |
| `assets/icons/xo/o-media-data-and-system/trend-up.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/trend-up.svg |
| `assets/icons/xo/o-media-data-and-system/volume-low.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/volume-low.svg |
| `assets/icons/xo/o-media-data-and-system/volume-mute.svg` | 1 | planned | core/ui/icons/source/xo/o-media-data-and-system/volume-mute.svg |
| `assets/icons/xo/p-devices-development-and-everyday/agent-add.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/agent-add.svg |
| `assets/icons/xo/p-devices-development-and-everyday/api.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/api.svg |
| `assets/icons/xo/p-devices-development-and-everyday/award.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/award.svg |
| `assets/icons/xo/p-devices-development-and-everyday/brain.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/brain.svg |
| `assets/icons/xo/p-devices-development-and-everyday/cart.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/cart.svg |
| `assets/icons/xo/p-devices-development-and-everyday/cloud-upload.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/cloud-upload.svg |
| `assets/icons/xo/p-devices-development-and-everyday/coffee.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/coffee.svg |
| `assets/icons/xo/p-devices-development-and-everyday/commit.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/commit.svg |
| `assets/icons/xo/p-devices-development-and-everyday/credit-card.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/credit-card.svg |
| `assets/icons/xo/p-devices-development-and-everyday/diff.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/diff.svg |
| `assets/icons/xo/p-devices-development-and-everyday/display.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/display.svg |
| `assets/icons/xo/p-devices-development-and-everyday/fork.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/fork.svg |
| `assets/icons/xo/p-devices-development-and-everyday/gift.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/gift.svg |
| `assets/icons/xo/p-devices-development-and-everyday/git-compare.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/git-compare.svg |
| `assets/icons/xo/p-devices-development-and-everyday/globe-lock.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/globe-lock.svg |
| `assets/icons/xo/p-devices-development-and-everyday/laptop.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/laptop.svg |
| `assets/icons/xo/p-devices-development-and-everyday/layers.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/layers.svg |
| `assets/icons/xo/p-devices-development-and-everyday/leaf.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/leaf.svg |
| `assets/icons/xo/p-devices-development-and-everyday/location-pin.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/location-pin.svg |
| `assets/icons/xo/p-devices-development-and-everyday/logs.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/logs.svg |
| `assets/icons/xo/p-devices-development-and-everyday/merge.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/merge.svg |
| `assets/icons/xo/p-devices-development-and-everyday/milestone.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/milestone.svg |
| `assets/icons/xo/p-devices-development-and-everyday/pull-request.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/pull-request.svg |
| `assets/icons/xo/p-devices-development-and-everyday/receipt.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/receipt.svg |
| `assets/icons/xo/p-devices-development-and-everyday/secret.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/secret.svg |
| `assets/icons/xo/p-devices-development-and-everyday/tablet.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/tablet.svg |
| `assets/icons/xo/p-devices-development-and-everyday/test-flask.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/test-flask.svg |
| `assets/icons/xo/p-devices-development-and-everyday/trophy.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/trophy.svg |
| `assets/icons/xo/p-devices-development-and-everyday/webhook.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/webhook.svg |
| `assets/icons/xo/p-devices-development-and-everyday/wrench.svg` | 1 | planned | core/ui/icons/source/xo/p-devices-development-and-everyday/wrench.svg |
| `assets/icons/xo/q-keys-and-filled-variants/bell-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/bell-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/calendar-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/calendar-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/check-circle-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/check-circle-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/cloud-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/cloud-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/eye-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/eye-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/flag-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/flag-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/inbox-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/inbox-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-capslock.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-capslock.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-control.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-control.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-escape.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-escape.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-forward-delete.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-forward-delete.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-space.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-space.svg |
| `assets/icons/xo/q-keys-and-filled-variants/key-tab.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/key-tab.svg |
| `assets/icons/xo/q-keys-and-filled-variants/message-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/message-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/mic-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/mic-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/person-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/person-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/pin-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/pin-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/search-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/search-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/tag-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/tag-fill.svg |
| `assets/icons/xo/q-keys-and-filled-variants/x-circle-fill.svg` | 1 | planned | core/ui/icons/source/xo/q-keys-and-filled-variants/x-circle-fill.svg |

## ui-mockups (108)

| File | Lines | Status | New home |
|---|---:|---|---|
| `ui-mockups/create-project/README.md` | 43 | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-1440-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-320-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/dark-390-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-1440-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-320-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-home-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-home-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-home-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-home-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-home.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-side-active.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-side-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-side-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-side-rest.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/light-390-sidebar.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/craft-audit/measurements.json` | 536 | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-dark-create-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-dark-phone.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-dark-plus-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-dark-plus-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-light-create-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-light-phone.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-light-plus-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-light-plus-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/3400/built-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/A-dark-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/A-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/A-light-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/A-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/B-dark-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/B-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/B-light-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/B-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/C-dark-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/C-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/C-light-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/C-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/D-dark-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/D-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/D-light-side.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/D-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/base-live-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/base-live-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/base-sg-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/base-sg-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/base-sg-workspace-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-create-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-phone-320.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-phone-390.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-phone.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-plus-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark-plus-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-light-create-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-light-phone.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-light-plus-focus.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-light-plus-hover.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/shots/built-light.png` |  | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/tools/craft-audit.cjs` | 68 | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/tools/variants.cjs` | 63 | deleted | moved to the design archive (owner D4) |
| `ui-mockups/create-project/tools/verify.cjs` | 33 | deleted | moved to the design archive (owner D4) |

## design-research (127)

| File | Lines | Status | New home |
|---|---:|---|---|
| `design-research/2026-11-19-icons/ICONS.md` | 231 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/COVERAGE.md` | 73 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/1-project-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/2-project-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/3-thread-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/4-folded-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/5-arts-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/6-settings-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/after/7-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/1-project-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/2-project-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/3-thread-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/4-folded-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/5-arts-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/6-settings-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/before/7-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/empty-page/after-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/empty-page/after-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-icons/pack/empty-page/before-live-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/DELETE-SPEC.md` | 68 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/filter-and-counts/1-counts-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/filter-and-counts/2-again-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/filter-and-counts/3-filter-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/filter-and-counts/4-nothing-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/A-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/A-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/A-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/A-space-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/B-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/C-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/final-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/final-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/header-threads/final-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/home-colour/after-home-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/home-colour/after-home-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/home-colour/after-home-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/home-colour/before-live-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/outlines/recommended-mock.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/outlines/today-needs-you.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/outlines/today-working.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p1/folded-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p1/folded-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p1/more-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p1/open-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p1/open-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p2/panel-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p2/panel-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p2/panel-search-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p2/panel-thread-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p3/all-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p3/delete-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p3/menu-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p3/menu-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p3/project-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p4/shell-back-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p4/shell-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p4/shell-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5-colour/after-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5-colour/after-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5-colour/before-live-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5/all-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5/panel-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5/panel-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p5/panel-thread-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p6/arts-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p6/arts-docs-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p6/arts-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p7/head-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p7/head-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/p7/head-quiet-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/project-icons/1-picker-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/project-icons/2-chosen-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/project-icons/3-picker-keys-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/sidebar-edit/1-more-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/sidebar-edit/2-edit-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/sidebar-edit/3-edit-custom-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/sidebar-edit/4-bar-custom-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/build/sidebar-edit/5-folded-custom-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/CONV-MAP.md` | 94 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/THREAD-IN-PANEL.md` | 98 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/beside-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/beside-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/align-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/align-before-live.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/fold-before-live.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/fold-card-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/fold-line-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/fold-line-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/fold-main-line-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/gap-after-full.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/gap-after-page-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/gap-after-page.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/gap-before-live-full.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/gap-before-live-page.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/menu-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/menu-fixed.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/menu-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/one-menu-main-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/one-menu-page-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/one-menu-page-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p2-beside-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p2-beside-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p3-desk-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p3-desk-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p3-phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/p3-phone-light.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/title-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/built/title-before-live.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/files-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/focus-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/mock.cjs` | 71 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-19-threads-panel/thread-page/phone-dark.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/hardcoded-positioning-audit.md` | 309 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/shots-gaps/composer-gap-before-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/shots-gaps/coordinator-violet-before-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/shots-gaps/now-gap-before-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/shots-gaps/thread-strip-before-after.png` |  | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-chatview/showcase.cjs` | 151 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-lg/controls-ids.json` | 2686 | moved | e2e/fixtures/controls/controls-ids.json |
| `design-research/2026-11-lg/lp-shell/world.cjs` | 212 | moved | e2e/worlds/lp-shell.cjs |
| `design-research/2026-11-lg/tools/controls-md.cjs` | 761 | deleted | archived to the design archive: a generator whose inputs live outside the repo; the test's data is now e2e/fixtures/controls/link-rows.json |
| `design-research/2026-11-vision/canvas-editing/PLAN.md` | 215 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-vision/canvas-editing/README.md` | 444 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-vision/canvas-editing/SPACE-CONTRACT.md` | 244 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-vision/canvas-editing/files-as-editor.md` | 171 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-vision/canvas-editing/vscode-behaviours.md` | 177 | deleted | moved to the design archive (owner D4) |
| `design-research/2026-11-vision/launchpad/tools/mockspace.cjs` | 133 | moved | e2e/fixtures/mockspace-harness.cjs · next: Wave 4 Launchpad: fold the scenarios Launchpad's tests need into e2e/fixtures/mockspace-harness.cjs, then delete tools/launchpad/smoke.cjs (D6) and e2e/fixtures/mockspace.cjs together, after one browser run when the owner asks |

## tools/codemirror (1)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/codemirror/vendor.mjs` | 175 | planned | tools/codemirror/vendor.mjs (vendor hash manifests) |

## tools/diffview (22)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/diffview/astra-recheck.cjs` | 41 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/dlcopy.cjs` | 50 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/fake-changes.cjs` | 42 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/fake-preload.cjs` | 21 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/fileview-shots.cjs` | 58 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/lab.html` | 39 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/livecheck.cjs` | 47 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/measure.cjs` | 124 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p1measure.cjs` | 55 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p1shots.cjs` | 38 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p2ask.cjs` | 57 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p2measure.cjs` | 40 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p3flow.cjs` | 138 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/p3phone.cjs` | 52 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/panel.cjs` | 81 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/rows-long.cjs` | 59 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/rows-max.cjs` | 39 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/rows.cjs` | 50 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/sandbox-preview.cjs` | 61 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/sandbox.cjs` | 24 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/diffview/theme.mjs` | 155 | planned | tools/diffview/ (generates the diff themes) |
| `tools/diffview/vendor.mjs` | 132 | planned | tools/diffview/vendor.mjs (vendor hash manifests) |

## tools/files (2)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/files/space-e2e-reset.sh` | 6 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/files/space-e2e.mjs` | 156 | planned | delete: a one-off probe with machine paths (owner D6) |

## tools/filetree (6)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/filetree/README.md` | 17 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/filetree/bench.html` | 44 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/filetree/bench.js` | 7 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/filetree/lib.mjs` | 56 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/filetree/perf.mjs` | 51 | planned | delete: a one-off probe with machine paths (owner D6) |
| `tools/filetree/same.mjs` | 59 | planned | delete: a one-off probe with machine paths (owner D6) |

## tools/launchpad (2)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/launchpad/mockspace.cjs` | 164 | moved | e2e/fixtures/mockspace.cjs · next: Wave 4 Launchpad: fold the scenarios Launchpad's tests need into e2e/fixtures/mockspace-harness.cjs, then delete tools/launchpad/smoke.cjs (D6) and e2e/fixtures/mockspace.cjs together, after one browser run when the owner asks |
| `tools/launchpad/smoke.cjs` | 128 | planned | delete: a one-off probe with machine paths (owner D6) |

## tools/xoicons (1)

| File | Lines | Status | New home |
|---|---:|---|---|
| `tools/xoicons/build.mjs` | 91 | kept | tools/xoicons/build.mjs · next: writes core/ui/icons/xoicons.js |

