# 5 — Files, documents and changes (snapshot /tmp/xo-6c73139 @ 6c73139)

Scope: js/files.js, js/filespage.js, js/viewer.js, js/docs.js, js/doceditor.js, js/mdlive.js, js/changes.js,
js/changesframe.js, js/diffview.js, js/diffthemes.js; plus js/vendor/ inventory and every worker script.
All ten first-party files were read in full. Line numbers refer to the snapshot.

Adjacent helpers this domain depends on but that are NOT in this scope (another analyst must cover them, or they
must be added to this domain's ledger): js/merge.js (101, 3-way line merge, pure), js/drafts.js (61, localStorage
"hot exit" drafts, pure), js/imagechange.js (120, image before/after for binary changes), js/paths.js (83, flat path
list per place for Find and ⌘P), js/map.js (folderOf, placeOf, activityOf), js/redraw.js, js/fuzzy.js,
js/fileicons.js, js/keynav.js, js/keys.js, js/focusview.js, js/attach.js, js/stage.js (the panel host, which owns
the Changes frame and the page model this domain plugs into). CSS for this domain lives in css/panel.css (fv-, cx-,
fl-), css/docs.css (xd-, cm-md-, cm-xo-), css/diffs.css (Pierre custom properties, vw-, cx-), plus slices of
css/app.css, css/foundation.css, css/phone.css: all prefixes (fl-, fv-, vw-, cx-, xd-, cm-md-, cm-xo-) are spread
over 3–6 stylesheets and must be gathered into the modules on the move.

---

## 1. Per file

### js/files.js (940 lines)

- **Purpose.** The panel's file browser: a lazily-read tree of the current place (a thread's worktree, a project's
  folder, or a project picker), with "Changed here"/"Touched by agents" sections, fuzzy Find, a per-row ⋯ menu
  (new file/folder, rename/move, delete+undo, copy path), drag-to-move, a fold-to-rail mode, and the README front
  page. It hosts the singleton `#viewer` element beside the tree.
- **Exports.** `FILES_ICON` (unused outside; grep finds no importer), `scopeOf(view, {thread, project})`,
  `fileScope(f, {threads, project})`, `localIn(scope, f)`, `newFileSay(n, dir, d, confirm)`, `createFiles({...})`.
  Importers: js/app.js:43 (`createFiles, fileScope, localIn, scopeOf as filesScopeOf`); tests/files.test.mjs
  (pure fns); tools/filetree/bench.js; several source-text tests (links-css, files-tree-scroll-fold,
  press-keeps-node, xoicons).
- **Imports.** util.js (esc, copyText, COPY_REFUSED, space), ui.js (ICON), redraw.js (redraw), api.js (api),
  map.js (activityOf, folderOf), fileicons.js (fileIcon, folderIcon — folderIcon unused), changesframe.js
  (countsHtml), viewer.js (RUNS), keynav.js (pointerFollows), fuzzy.js (rank, marked).
- **Coupling beyond imports.**
  - DOM outside its own markup: moves `document.getElementById("viewer")` into its `.fl-view` (L884-885) — the
    viewer element is defined in index.html and physically re-parented here; reads `#viewer` again at L410 to hand
    it focus. Appends its ⋯ menu `div.fl-menu` to `document.body` (L890-892). Document-level capture
    `pointerdown` listener to close the menu (L569), never removed.
  - localStorage: `xo-files-secs` (per-project folded sections, L321-329).
  - /api (via api.js): GET `/xo-projects/{p}/tree` (projectTree, L118), PUT `/file` with no base version =
    guarded create (saveProjectFile, L651; confirm "runs_code" on 428), POST `/files/mkdir` (L684), POST
    `/files/rename` (L685, L707), POST `/files/delete` (L723), POST `/edits/{id}/undo` (L739).
  - Reads `world.state.turns`, `world.state.threads`, `world.state.projects`, `world.thread(id)` directly.
  - Calls into `viewer` (open/close/hasFile/file), `changes` (of/activity/saved), `paths` (of/changed).
  - Keys handled on its host: ArrowUp/Down row nav, Enter/Escape in name field, ContextMenu / Shift+F10 (⋯),
    F2 (rename), Delete / ⌘Backspace (delete), Escape in Find clears (L847-866). Drag & drop (L820-846).
  - ResizeObserver on host (WIDE = 600 px, L867-870) switches side-by-side vs one-at-a-time.
  - Timers: menu "Copied" 600 ms (L558); focusout setTimeout to drop an empty new-file row (L816);
    requestAnimationFrame to scroll the revealed row (L462).
- **State it owns.** `F` (host, view, scope, pick, shown, dirs cache Map "project|apiPath" → {state, dirs, files,
  error, v}, open-folder Sets per scope, sel, fileView, auto, follow, viewKey, q, wide, folded, undo) L93-104;
  `T` tree-render cache (key, groups Map folder → {el, sig, open}, on, q, changed) L162; `M` ⋯ menu (btn, row,
  menu, from, dir, kind) L507; `NW` new/rename row (key, dir, el, busy, confirm, mode, from) L579; `secState`
  (folded sections) L322; module `VER` counter.
- **Responsibilities inside.**
  1. L47-90 pure scope maths: `scopeOf` (view → place), `fileScope` (file → place, worktree detection via
     `.xo/worktrees/<n>/`), `localIn`, `newFileSay` (name validation + runs-code rule). → **core/services/places**
     (shared "place" model: the same view→place rules are re-implemented in changes.js `scopeOf` L45-54 and
     `changes.at` L172-178, and in viewer.js `localPath` L308; one module should own them).
  2. L111-126 folder reading cache (`load`) → **modules/files/tree-store** (a store, no DOM).
  3. L129-177 agent-touched marks from turns (`touched`, `marksOf`) → **modules/files** (or a shared
     `services/activity` with changes.js `activityIn`, which computes a near-identical thing from the same turns).
  4. L181-294 incremental tree renderer (rowsHtml, flip, group, sigOf, refocus, drawAll, drawFound, sync): per-folder
     groups redrawn in place with `redraw()`, `data-own` nodes preserved → **modules/files/tree-view**.
  5. L296-336 head (crumb, Find, New file), "Changed here"/"Touched" sections, foldable section heads, project
     picker → **modules/files/tree-view**; the "Changed here" list is a *view onto the changes service* and the
     only cross-feature render (it calls `changes.of/activity` and `countsHtml`).
  6. L338-420 `paintTree`/`paint`: layout classes (is-wide, is-folded, is-file, has-file), rail badge, narrow
     back bar, focus hand-offs (C033, S061) → **modules/files/page-layout** (merge with filespage.js).
  7. L423-479 opening, README front page, `reveal` (walk folders down to a file opened elsewhere), `setScope`
     (follow/pick) → **modules/files**.
  8. L483-501 fold-to-rail and `unfoldTo` → **modules/files/page-layout**.
  9. L507-570 the one floating ⋯ button and its menu (positioning with `space()` tokens, keyboard roving) →
     should use **core/ui/menu** (it is a hand-rolled menu; viewer.js has another one, L144-184, L1067-1074).
  10. L579-743 file operations: new file, new folder, rename/move, drag-move, delete + undo, error words
      (`makeWords` L628-638) → **modules/files/ops** (a service: `createFile`, `mkdir`, `move`, `remove`, `undo`)
      with the words in **core/platform/words**.
  11. L746-874 input wiring (click delegation by data-fl-* hooks, input, pointerover/out for ⋯, focusin/out,
      drag/drop, keydown, ResizeObserver) → **modules/files/tree-view**.
  12. L876-939 public object (mount/show/hide/render/reveal/reread/changes/fold/list/getters) → module API.
- **Smells.**
  - Cycle-ish coupling: files.js imports `RUNS` from viewer.js (L27) and `countsHtml` from changesframe.js (L26);
    viewer.js imports `countsHtml` from changesframe.js too; filespage/viewer/files reach each other by
    injected objects. `countsHtml` and `RUNS` are shared primitives living in feature files.
  - `paintTree` (L338-387) and `paint` (L389-418) are god functions mixing render, layout, focus repair and badge
    text. `wire` (L746-874) is a 130-line delegation switch.
  - Hidden global DOM ownership: steals `#viewer` (L884) and attaches a body-level menu and document listener with
    no unmount (L569, L892) — impossible to "undo" a module registration today.
  - `paths` is optional in the signature (`paths = null`, L92) but `makeOther`, `moveTo`, `remove`, `undoRemove`
    call `paths.changed` unguarded (L689, L708, L726, L740); only reachable when `ops()` is true (which requires
    paths), except `undoRemove`/`remove` paths — fine today, fragile.
  - `F.undo` is used (L360, L712-L739) but not declared in `F` (L93-104); `M.kind` likewise (L529).
  - `go` is accepted (L92) and never used. `FILES_ICON` and `folderIcon` exported/imported and unused.
  - Duplicated: `size()` (L42) differs from viewer.js `size()` (L37) (KB rounding vs 1 decimal); `base()`/
    `parentOf` duplicated in changesframe.js (`base`, `dirOf`), viewer, filespage (`nameOf`).
  - Worktree-path regex `^\.xo\/worktrees\/[^/]+` appears in files.js L62, changes.js L173/L182, viewer.js L308,
    app.js L242 and L3342/L3671 (the place model is smeared across five files).
- **Proposed home(s).** `modules/files` (tree-store, tree-view, ops, page) + `core/services/places` for the pure
  scope maths; ⋯ menu onto `core/ui/menu`.

### js/filespage.js (150 lines)

- **Purpose.** Registers Files as a *page* of the right panel (stage.js page model): the panel widens for a file,
  the tree sits beside it with a draggable splitter and folds to a rail (⌘B or its button).
- **Exports.** `createFilesPage({stage, files, viewer, view, announce})` → `{show({focus}), toggleTree({focus}),
  treeFolded(folded), reset(), sync(), get isOpen}`. Importer: js/app.js:46 (built at L407 as `FP`).
- **Imports.** fileicons.js (fileIcon), ui.js (ICON).
- **Coupling beyond imports.**
  - `stage.page("files", {...})` (L81-109) — the one real "slot" registration in this domain: spec keys
    `single, width({room}), title, lead (head button HTML with data-stg-act="tree"), act(name), icon, mount,
    onShow, onHide, unmount, canClose, escape`. Also uses `stage.refit()`, `stage.show()`, `stage.pages()`,
    `stage.closeTab()`, `stage.pageShown`.
  - DOM outside its own markup: `document.getElementById("viewer")` (L101), `document.querySelector('#stage
    [data-stg-act="tree"]')` (L114) — reaches into stage's head.
  - `document.body.classList` `fv-sizing` while dragging (L56-59).
  - localStorage: `xo-files-tree` (tree width px, L16, L32-36), `xo-files-folds` ({tree:"open"|"folded"}, L17,
    L41-43).
  - Keys: splitter ArrowLeft/Right ±16 px (L65-69); ⌘B is not bound here — app.js runGlobal("treeFold")
    (app.js L4612) calls `FP.toggleTree()`; keys.js L32 defines `treeFold` = mod+b, scope global.
  - Pointer capture on the splitter (L52-63); requestAnimationFrame in `refocus` (L114).
  - Constants: TW_DEF 240 / MIN 160 / MAX 420, FILE_W 640, RAIL_W 44, min page width 480 (L85).
- **State it owns.** `pane` (section.fv, made once and kept off-DOM when the tab closes), `mounted`, `tw`, `folds`,
  `seen`/`had` (last file followed, whether a file was open).
- **Responsibilities.** (a) L23-43 pane + persisted tree width/fold; (b) L45-70 one-time mount of files.js into the
  pane + splitter; (c) L72-80 `follow()` — tree follows the viewer's file and refits the panel on file
  arrival/departure; (d) L81-109 the page registration (width policy, title, head lead button, lifecycle,
  canClose → viewer.confirmClose, escape → viewer.escape); (e) L111-148 the public API (show/toggleTree/
  treeFolded/reset/isOpen/sync).
- **Smells.** Fold state is split three ways: files.js `F.folded`, filespage `folds.tree` (localStorage), and
  narrow-mode `files.list()` — toggleTree (L123-133) has to reconcile them. `P` used inside the page spec before
  its declaration (L94, hoisting through closure — fine but order-fragile). `sync()` must be called by app.js on
  every render (app.js L2887) — a polling contract rather than a subscription.
- **Proposed home.** `modules/files/page.js` — the module's registration into the `panel.page` slot; its width and
  fold persistence go through `core/services/shape` or a per-module settings store rather than raw localStorage.

### js/viewer.js (1157 lines)

- **Purpose.** The single file viewer/editor (`#viewer`): tabs of open files, a head with name/kind/state/versions/
  view switches/⋯/×, bodies for text (CodeMirror via doceditor.js), Markdown page, sandboxed HTML preview, images
  (fit/1:1), PDFs, attachments and pastes, a file's diff ("Changes" view via diffview.js or imagechange.js),
  version stepping/restore, unsaved-close questions, ask-about-lines/file, copy/copy path/download, external
  change intake (file.version), and park/unpark for "live mode".
- **Exports.** `RUNS` (regex of runs-code paths, L47; imported by files.js L27 and tests/edits.test.mjs),
  `whenWords(at, now)` (L67, no importer outside — only used internally), `createViewer({...})` (app.js L38,
  built at app.js L217 as `VW`). ~25 source-text tests read the file (viewer-hooks, head-focus, menu-focus, …).
- **Imports.** util.js (esc, isImagePath), fileicons.js, ui.js (ICON, $, xi), focusview.js (usable), api.js (api,
  attachmentUrl, attachmentText, missingRoute), attach.js (kindOf, typeWord), diffview.js (as DV: diff, jump),
  keys.js (K.is nextChange/prevChange), keynav.js (pointerFollows), redraw.js (redrawNode), changesframe.js
  (countsHtml), docs.js (createDocs, byWords), doceditor.js (mount, prefetch), imagechange.js (isImageChange,
  drawImageChange).
- **Coupling beyond imports.**
  - DOM: binds to `$("#viewer")` from index.html (L85); toggles `document.body` class `viewer-open` (L863, L900,
    L1101, L1107); `likeOf` (L913-920) searches the whole document for `[data-file]`, `[data-cx]`, `[data-node]`,
    `[data-made-file]`, `[data-k]` to restore focus to a redrawn opener — i.e. it knows the hook attributes of the
    conversation, the Changes frame, the Map and Made.
  - window/document listeners never removed: `pagehide`, `beforeunload` (L1052-1053), document `pointerdown`
    capture (L1055), `visibilitychange` (L1057).
  - localStorage: passed as `store` into docs.js (L100) → drafts.js keys `xo-draft:<project>|<rel>` and index
    `xo-drafts`.
  - /api: GET `/xo-projects/{p}/file` (projectFile, with `purpose:"edit"` L732, fallback on 413 L735, `commit`
    for the diff's old side L421, `version` for older versions L602), GET `/image` (L752), GET `/download` as a
    blob (L127), GET `/versions` (L776, disabled for the session on a missing route L778), attachment routes
    (attachmentUrl/attachmentText L145, L726-727). Saves go through docs.js (PUT `/file`).
  - SSE: `fileChanged(ev)` consumes Space events `file.version`, `file.version.attributed`, `file.rescan` (and
    kind rename/delete/create) relayed from app.js `world.onEvent` (app.js L238-246). `notice()` (L788-798) is
    the fallback /changes-hash signal, called on every app render (app.js L2885), switched off forever once one
    push arrives (`pushed`, L786).
  - Keys on `el`: ⌘/Ctrl+S save (L1077), Escape cascade (confirm → old version → selection → unsaved question →
    `away()` → close, L1078-1089), J/K next/prev change in a diff (L1091-1093), menu roving (L1068-1074).
  - Timers: COPY_SAYS_MS 150 (L935), Copied 1400 ms (L959), Saved flash 1600 ms (L386), object URL revoke 60 s
    (L130).
  - Sandboxed `<iframe sandbox="allow-scripts" srcdoc>` for HTML (L401) — security-relevant (serve.py refuses a
    null origin on /api).
- **State it owns.** `V` (open, parked, file, data, error, loading, mode, textMode, imgMode, returnTo, gen, copied,
  dims, busy, saveError, show, split, menu, tabs[], tab, showChanges, asking, why, savedFlash, focusText, keep,
  keepScroll) L88; `DF` diff body state L92; `TX` text editor state L98; the `docs` store instance (L101) — the
  **only** documents store in the app lives inside the viewer; `flashT`, `versionsRoute`, `pushed`.
- **Responsibilities inside (by region).**
  1. L37-76 helpers: size/bytes/extOf, KIND_WORD, RUNS, NOT_EDITABLE words, icons, `whenWords` → words to
     **core/platform/words**, `RUNS` to **core/services/places** (it is a place rule shared with files.js).
  2. L84-119 construction, doc store, predicates (`showsText`, `isMd`, `canSave`) → **modules/files/viewer**.
  3. L121-184 download, ⋯ menu HTML, menuOff, menuItems, redrawKeep → menu onto **core/ui/menu**; download onto
     a `files.ops.download` service.
  4. L186-305 head: `stateHtml`, `versionsHtml`, unsaved/confirm pops, `tabsHtml`, `head()` (L256-300, a 45-line
     god function with responsive "folds" into ⋯), `verBar` → **modules/files/viewer/head**. The tabs strip could be
     a `core/ui/tabs` component.
  5. L307-365 runs-code rule, `hookOf` focus-hook finder, `paintHead`, `paintBars`, `headFocus`, `focusHere`
     → the focus-preservation helpers are generic: **core/ui/focus** (same pattern exists in files.js refocus,
     changesframe, diffview conflict).
  6. L367-387 `docChanged` (document events → head/editor/announce), `flashSaved` → viewer.
  7. L389-415 body for why/loading/error/image/pdf/html/cut notice → viewer "renderers by kind". Should become a
     registry: **`files.viewer.kind`** keyed slot (text, markdown, html, image, pdf, attachment) so apps can add
     viewers.
  8. L411-519 diff view of one file (`diffBody`, `dropDiff`, `bothSides`, `drawDiff`, `inRegion`) → belongs to
     **modules/changes** (a "file diff" component reused by changesframe.js, which has its own `draw`, L123-167,
     duplicating ~70% of it). `inRegion` → core/ui/focus.
  9. L521-617 text editor lifecycle (`textBody`, `dropText`, `drawText`, `showChangesNow`, `stepVersion`) →
     **modules/files/editor-host**.
  10. L619-656 ask-about-lines composer (`openAsk`, `closeAsk`, `sendAsk`) → a **composer** integration: the
      viewer should emit "ask(file, a, b)" and the conversation/composer module should own the fallback mini
      composer.
  11. L659-718 `render`/`above`/`renderNow` (three body modes: text keeps editor node, diff keeps Pierre node,
      other redraws) → viewer.
  12. L720-779 reading: `readAttachment`, `readText` (413 fallback), `load`, `loadVersions` → a **files service**
      (`readFile`) plus attachment reader in **modules/attachments** (or core/services/attachments).
  13. L781-823 external change intake (`notice`, `fileChanged`, rename follow) → **modules/files/documents**
      (should subscribe to the event bus itself, not be fed by app.js).
  14. L825-920 tabs (`sameFile`, `releaseTab`, `showTab`, `open`, `closeTab`, `close`, `likeOf`) → viewer.
  15. L922-960 `copy` with clipboard fallback (execCommand) → **core/platform/clipboard** (util.js already has
      `copyText`; this is a second implementation).
  16. L962-1094 event wiring: click `act()` (L977-1036, a 60-line dispatch on data-vw-* hooks), dblclick, image
      load/error, page lifecycle, menu dismissal, cut-sel selection, keydown.
  17. L1096-1115 `park`/`unpark`/`refresh` (Map "live mode"; called by map.js).
  18. L1117-1156 public API (open, close, park, unpark, refresh, notice, fileChanged, getters isOpen/hasFile/
      isParked/file/opener/editing/openFiles, goto, confirmClose, escape, leave).
- **Smells.**
  - God module: 1157 lines covering seven concerns (documents host, editor host, diff, tabs, attachments, copy/
    download, ask). The doc store is created *inside* the viewer (L101), so nothing else (e.g. ⌘P previews,
    a second editor, an app) can open a document without the viewer.
  - `head()` and `act()` are god functions; data-vw-* string hooks are the contract between HTML and behaviour.
  - Duplicate diff drawing logic with changesframe.js (`drawDiff` vs `draw`; both handle image change, "Binary
    file", failure retry, pend/gen guards).
  - Hidden global listeners with no teardown (L1052-1057); body class `viewer-open` is read by CSS elsewhere.
  - `likeOf` hard-codes other features' DOM hooks (L915).
  - `goto(line, col)` ignores `col` (`void col`, L1123). `whenWords` exported but unused outside.
  - Doc comment on L1126-1127 is orphaned (describes `leave` but sits above `confirmClose`).
  - `ask.file` is optional in the options shape but `act()` calls `ask.file(V.file)` (L1034) — guarded only by the
    button being drawn when `ask && ask.file` (L280).
- **Proposed home(s).** `modules/files/viewer` (shell of tabs+head+body), `modules/files/documents` (docs store +
  external-change intake, as a service other modules can use), `modules/files/editor` (doceditor+mdlive),
  `modules/changes/file-diff` (shared diff component), `core/ui/menu`, `core/ui/focus`,
  `core/platform/clipboard`, kind renderers registered into a `files.viewer.kind` slot.

### js/docs.js (420 lines)

- **Purpose.** DOM-free model of open project files as documents (VS Code-like): text vs base vs version, states
  (saved/dirty/saving/conflict/deleted/readonly/error), versions list, saving with Space's guarded PUT,
  confirm-for-runs-code, merge of external changes (3-way via merge.js), drafts (hot exit), restore, rename.
  Testable in node with a fake clock.
- **Exports.** `DRAFT_MS` (800), `KEEP_TEXT` (20), `MERGE_MS` (10000), `refusal(err)`, `changedLines(prev,next)`,
  `minimalEdit(a,b)`, `byWords(by, threadTitle)`, `createDocs({api, store, clock, onChange})`. Importers:
  viewer.js L33 (createDocs, byWords); tests/docs.test.mjs, tests/edits.test.mjs (refusal),
  tests/file-cache.test.mjs (source); tools/files/space-e2e.mjs.
- **Imports.** merge.js (merge3, changes, linesOf), drafts.js (draftKey, getDraft, putDraft, dropDraft).
- **Coupling beyond imports.** Only through injected `api` (projectFile, saveProjectFile → GET/PUT
  `/xo-projects/{p}/file`, with `restoreOf`), `store` (localStorage keys via drafts.js: `xo-draft:<project>|<rel>`,
  `xo-drafts`), `clock` timers (draft timer DRAFT_MS). Emits `onChange(doc, what)` with what ∈ state, saved,
  version, applied, conflict, confirm, renamed. Mutates `d.cmState`/`d.checkedSig` set by others (doceditor L183-187,
  viewer L795) — the doc object is an open bag.
- **State it owns.** `docs` Map key → doc (key, project, rel, refs, text, base, version, place, kind, lineEndings,
  state, err, confirm, confirmed, declined, offline, deleted, source, apply, length, viewing, versions[], saveT,
  draftT, inflight, again, merge, gen, restoreOf, restoring + foreign cmState, checkedSig).
- **Responsibilities.** L32-84 pure helpers (refusal words, changedLines, minimalEdit, byWords); L91-119 store +
  versions with merge window; L125-162 open/release refcounting and draft restore; L168-202 view attach + edit
  tracking; L205-260 save/flush/confirm; L266-322 merge-in, merge progress, resolve; L329-349 `changed`
  (external change read); L353-379 rename + knownVersions; L382-410 view/discard/restore; L412-419 API.
- **Smells.** Header comment contradicts itself: "saves itself"/"autosaves every second" (L28-29, viewer.js L3-4,
  doceditor L3) vs "no autosave: ⌘S only" (L6-7, L24) — the code is ⌘S-only; comments in three files are stale.
  `saveT` is cleared but never set (dead). `save()` keeps an unused `was` (`void was`, L246). `knownVersions`
  has two doc comments stacked (L351-352 belong to different functions). The doc object is mutated by consumers
  (cmState, checkedSig) — should be a typed field or a side map. Otherwise this is the cleanest module in scope.
- **Proposed home.** `modules/files/documents` exposed as a **service** (`core/services` level if apps or other
  modules will edit files): `documents.open/get/flush/changed/renamed/unsaved`. Pure helpers stay with it;
  `byWords` → words.

### js/doceditor.js (290 lines)

- **Purpose.** The single CodeMirror 6 editor for every text file: lazily imports the vendored bundle, builds the
  extension set (XO highlight style from --code-* tokens, theme from CSS variables, keymaps, line tints for
  external changes, "Ask about lines ⌘L" tooltip, language by filename, Markdown page view via mdlive.js), wires
  itself to a docs.js document, and offers version viewing, "Show changes" and conflict merge via
  @codemirror/merge.
- **Exports.** `loadCM()`, `loadMerge()`, `prefetch()`, `mount(host, {docs, doc, name, page, onLines, onAsk,
  onSave, onKey})` → handle {view, focus, reveal, select, clearSelection, setPage, isMarkdown, showVersion,
  showChanges, showMerge, refresh, destroy}. Importer: viewer.js L34 (mount, prefetch). No tests import it.
- **Imports.** Dynamic only: `./vendor/codemirror/cm.js` (L14, L17), `./vendor/codemirror/merge.js` (L15, L18),
  `./mdlive.js` (L133, only for Markdown).
- **Coupling beyond imports.** CSS custom properties in the theme (L135-152: --code-*, --ink*, --mono, --fs-base,
  --lh-ui, --cell-in, --row-hover, --info, --warn, --hover-fill, --line*, --fill-1, --r, --r-xs, --float,
  --surface, --d-long, --ease, --err-ink, --fw-strong) — a hard dependency on core/ui tokens. Classes
  `cm-xo-tint`, `cm-xo-asktip`, `xd-ask`, `cm-xo-fold`, `xd-btn cm-xo-chunk`, `cm-xo-page` (styled in
  css/docs.css, css/app.css). Keys: Mod-s, Ctrl-g, Mod-l plus CM default/search/history/fold/closeBrackets keymaps
  and indentWithTab. `navigator.platform` sniff (L22). Timer TINT_MS 2400 (L23, L207). Writes `doc.cmState`
  (L187, L284) on the docs object.
- **State it owns.** Module promises `cmP`, `mergeP`; per mount: compartments, `live` (live state while an old
  version shows), `viewing`, `merging`, `showing`, `destroyed`.
- **Responsibilities.** L14-20 lazy loader/prefetch; L26-48 highlight style; L51-73 tint field; L76-115 ask
  tooltip; L121-196 mount + extensions + language; L199-209 docs attach (source/length/apply); L212-222 conflict
  chunk counting → `docs.resolve`; L224-288 handle.
- **Smells.** `setPage(false)` re-adds a plain `foldGutter()` (L241) without the custom `markerDOM` used at L162 —
  the fold markers change look after toggling Page→Source. Mod-s is handled here and again in viewer.js L1077
  (double flush; harmless because flush is idempotent while inflight). `onKey` is accepted but never passed by the
  viewer.
- **Proposed home.** `modules/files/editor` (with mdlive.js). The CM loader (`loadCM`/`loadMerge`) could be a
  `vendor` adapter `vendor-adapters/codemirror` if other modules (composer, settings JSON) want an editor.

### js/mdlive.js (331 lines)

- **Purpose.** CodeMirror extension that renders Markdown as an editable page (Typora-like): hidden marks with
  atomic ranges, heading/quote/fence line classes, bullets, inline math widgets, block widgets for rules/display
  math/mermaid/chart fences drawn by the chat renderer, and an editable table widget writing rows back to source.
- **Exports.** `toggleMark(CM, state, mark)`, `rowLine(list)`, `tableRows(src)`, `pageView(CM)`. Importers:
  doceditor.js L133 (dynamic, pageView); tests/mdlive.test.mjs (all four).
- **Imports.** markdown.js (renderMarkdown, renderInline, cells), rich.js (drawMath, drawDiagram) — i.e. it pulls
  the **conversation's** renderer (and through rich.js, KaTeX and Mermaid on demand) into the editor.
- **Coupling beyond imports.** Classes `cm-md-*`, `prose vw-md`, `md-table`, `md-math`, `md-diagram`,
  `md-dg-src` (the last three are markdown.js/rich.js output contracts it queries, L22-29). Keys (Prec.high):
  Mod-b bold, Mod-i italic, Mod-e code, Mod-Shift-x strike (L320-325). Timer DRAW_MS 250 (L20).
  `getSelection()` for table cells.
- **State it owns.** Module-level-per-pageView `atomic` array (L308) shared between `inline()` and the plugin —
  a mutable closure variable written as a side effect of decoration building.
- **Responsibilities.** L21-33 deferred rich drawing; L43-67 pure helpers; L73-191 widgets (Block, Table, Math,
  Bullet); L196-246 block field; L249-317 inline decorations + atomic ranges; L319-330 format keys.
- **Smells / risks.**
  - **⌘B collision (probable bug, verify):** mdlive binds Mod-b to bold (L321). app.js's window keydown handler
    (app.js L4570-4580) runs `K.globalFor(e)` → `treeFold` (keys.js L32, mod+b) → `FP.toggleTree()` with no
    `defaultPrevented` check, and CodeMirror only preventDefaults (no stopPropagation). So ⌘B in a Markdown page
    likely bolds *and* folds the file tree. A slot/keymap registry must define precedence (focused editor wins).
  - Header promises "# ", "- ", "1. ", "> " input rules and list continuation (L6-7); no input rules exist here
    (list continuation comes from lang-markdown's default keymap). Stale doc.
  - `atomic` shared mutable (L260, L308, L311-312, L316) — order-dependent.
- **Proposed home.** `modules/files/editor/markdown-page.js`. Its dependency on markdown.js/rich.js should go
  through a shared **core/ui/rich-content** (or `services/markdown`) renderer API, not the conversation module.

### js/changes.js (194 lines)

- **Purpose.** Store of "what a place changed" from Space's GET `/xo-projects/{p}/changes[?worktree=&path=]`,
  re-read when an agent finishes an edit (signature of done edit rows in the turns), with "unsupported" fallback;
  plus helpers for message text refs (`File: path`, `path:a-b`).
- **Exports.** `FILE_MARK`, `fileRef(text)`, `lineRef(text)`, `scopeOf(view, world)`, `activityIn(scope, threads,
  turns)`, `createChanges({world, onChange})` → {sync, of, entry, forTarget, patch, at, patchAt, saved, activity,
  scope}. Importers: app.js L47 (createChanges, lineRef, fileRef; built at L216 as `CHG`); tests/changes.test.mjs.
  Consumers of the instance: app.js (sync L2968, forTarget L1192/L3667, scope L3339/L3670, saved L236), stage.js
  (passes to changesframe), files.js (of, activity, saved), viewer.js (at, patchAt).
- **Imports.** api.js, map.js (folderOf, placeOf), diffview.js (prefetch).
- **Coupling beyond imports.** /api GET `/changes` (list, and single-file `path=` when the list omitted a patch
  for `response_budget`). Reads `world.state.threads`, `world.state.turns` (`turns.list`, `turns.blocksOf`,
  activity rows with kind create_file/edit_file/delete_file). Error codes it interprets: 404 http_404 /
  not_a_repository / worktree_not_found, 501 git_too_old. Timer QUIET 250 ms (L20, L147). Calls diffview
  `prefetch` after each read (L110) — a store triggering a renderer's network/worker warm-up.
- **State it owns.** `P` Map scope key → {state, data, files, total, sig, inflight, again, timer, err}; `NO` set of
  projects without /changes; `memo` per-render activity; `one` Map of single-file patch promises.
- **Responsibilities.** L19-42 message reference parsing (`fileRef`, `lineRef`, `FILE_MARK`) → **belongs to the
  conversation/composer domain** (it is how a sent message is shown as a file capsule; app.js L3327-3330 and
  timeline.js use it), not to changes; L45-54 place scoping (duplicate of files.js scopeOf with different shape)
  → core/services/places; L61-89 agent activity from turns → shared `services/activity`; L91-193 the store.
- **Smells.** Misplaced pure text helpers (`fileRef`/`lineRef`), stray doc comment (L22-25 describes lineRef but
  sits above FILE_MARK). Two `scopeOf`s with different return shapes (files: {key, project, base, label, sub,
  tid}; changes: {key, project, worktree, root, tid}) under the same name; app.js imports files' as
  `filesScopeOf` to dodge the clash. `sync(view)` is a render-time poll (app.js L2968). `activity()` uses `this`
  (L141) — breaks if destructured.
- **Proposed home.** `modules/changes/store.js` (service; public API other modules use: `of`, `at`, `patch`,
  `forTarget`, `activity`, `saved`); `fileRef/lineRef` → `modules/conversation/refs` (or `core/services/refs`);
  scope maths → `core/services/places`.

### js/changesframe.js (323 lines)

- **Purpose.** The panel's Changes frame: list of changed files (32 px rows, +/− counts, live "editing now" arcs),
  the chosen file's diff below, "follow the agent" mode with a pill when paused, image changes, Open in Files.
- **Exports.** `countsHtml(n)` (imported by files.js L26, viewer.js L32, stage.js L31, app.js L49 — a shared UI
  atom), `newestHunkLine(prev, next)`, `choose(st, paths, act)` (pure; tests/changes.test.mjs),
  `createChangesFrame({host, changes, view, openFile, onChange})` → {paint, head, select, resume, toggleFollow,
  chosen, get wide}. Importer of createChangesFrame: stage.js L31/L111 only.
- **Imports.** util.js (esc), icon.js (xi), redraw.js, fileicons.js, diffview.js (diff, jump), keys.js,
  imagechange.js.
- **Coupling beyond imports.** Lives in stage's `[data-fr="changes"]` body (`.cx-host`), which stage.js creates
  (stage L110); stage decides between this frame and the old list from files.js `changes()` (stage L302-316).
  Reaches into Pierre's shadow DOM (`diffs-container` shadowRoot, `[data-line]`, `[data-line-type]`, L171-172).
  Keys J/K (keys.js nextChange/prevChange) and ArrowUp/Down in the list (which also clicks, L295-302). Listeners
  wheel/pointerdown/keydown on the diff pause following (L285). requestAnimationFrame loop up to 30 frames
  (L170-175).
- **State it owns.** `ST` Map scope key → {follow, sel, pill, sig, all, reveal}; `D` drawn diff {key, path, patch,
  ver, handle, img, gen, failed, pend}; `H` last HTML per region.
- **Responsibilities.** L29-36 counts atom → core/ui (or modules/changes/ui shared export); L38-69 pure following
  logic; L71-78 no-patch words → words; L80-121 frame markup/rows; L123-176 diff draw + reveal (duplicate of
  viewer drawDiff); L178-254 paint; L256-302 input; L304-322 API.
- **Smells.** Follow state is per scope but kept only in memory. `paint()` returns a boolean that stage uses to
  decide which list to show — a rendering side effect doubling as a capability query. The 'unsupported' fallback
  list lives in files.js (`changes(view)`) and is rendered by stage.js (`changesHtml`) — the Changes feature is
  split over three files.
- **Proposed home.** `modules/changes/frame.js` registering into the panel's `panel.frame` slot; `countsHtml` →
  `core/ui/components/counts`; diff draw → `modules/changes/file-diff` shared with the viewer.

### js/diffview.js (421 lines)

- **Purpose.** The only adapter to @pierre/diffs (vendored 1.6.4): lazy library load + custom XO themes, one
  module-worker highlighter pool, idle-time prefetch of grammars, `diff()` from a git patch, `jump()` J/K between
  changes, live theme switch; plus three APIs that are **no longer used by the app**: `file()` (virtualised whole
  file + Pierre's editor via edit.js), `conflict()` (Pierre merge view), `exitKeys()`, and `ready()`/`loaded()`.
- **Exports.** `langOf`, `loaded`, `ready`, `prefetch`, `setTheme`, `diff`, `conflict`, `jump`, `exitKeys`, `file`.
  Live importers: changes.js L17 (prefetch), changesframe.js L20 (diff, jump), viewer.js L28 (diff, jump), stage.js
  L32 (setTheme as diffTheme, used at stage L857), app.js L50 (setTheme, used at app L118). Tests/tools only:
  `langOf` (tests/diffview.test.mjs), `exitKeys` (tests/editor-exit.test.mjs), source-text tests (paint-a11y,
  editor-caret, find-bar, find-race), tools/diffview/lab.html. **Dead in the app:** `file`, `conflict`,
  `exitKeys` (only used inside `file`), `ready`, `loaded` — grep finds no app caller. They are left over from the
  pre-CodeMirror editor (the Files rebuild today moved editing to doceditor.js).
- **Imports.** Dynamic: `./vendor/pierre-diffs/diffs.js` (L19), `./diffthemes.js` (L55),
  `./vendor/pierre-diffs/edit.js` (L21, only in dead `file().edit`); worker URL `./vendor/pierre-diffs/worker.js`
  (L20, L65).
- **Coupling beyond imports.** `new Worker(WORKER, {type:"module"})` pool of 1, `mainThreadMaxCharacters: 0`
  (L63-69). Window capture listeners wheel/scroll/pointerdown/keydown/touchstart while waiting for 1.2 s of
  quiet, then requestIdleCallback (L81-90). Reads `document.documentElement.dataset.theme` (L107). Injects
  `FIND_CSS` and `unsafeCSS` into Pierre's shadow roots (L129-147, L194) using --ink-2/--ink-3/--err-ink/
  --diffs-* variables. Queries Pierre's shadow DOM (`diffs-container`, `[data-line-type]`, L261-263). In the dead
  `file().edit`: calls Pierre private `__captureFocusForDOMReplacement` (L383) — tied to the patched vendor copy.
- **State it owns.** `lib` promise, `pool`, `loadedLangs`, `live` Set of views (for theme switching), `findN`.
- **Responsibilities.** L26-50 language map (`langOf`) — note a *second* language map exists implicitly in
  doceditor.js (CodeMirror's `LanguageDescription.matchFilename`); L53-69 loader + worker pool; L80-103 idle
  prefetch; L106-113 theme; L150-177 `diff`; L186-254 `conflict` (dead); L260-272 `jump`; L281-291 `exitKeys`
  (dead); L300-421 `file` + `edit` (dead).
- **Smells.** ~230 of 421 lines are dead code (L115-147 FIND_CSS only used by `file`, L179-254, L274-291,
  L293-421) together with the 173 KB patched `edit.js` vendor file and its test (tests/pierre-find-focus per the
  manifest). The "quiet" idle gate (L82-90) is generic scheduling (memory note "page is never idle") →
  **core/platform/idle**.
- **Proposed home.** `modules/changes/diff-renderer` (or `vendor-adapters/pierre-diffs`) exposing `diff`, `jump`,
  `prefetch`, `setTheme`, `langOf`. Theme switching should subscribe to a `theme.changed` bus event instead of
  being called by app.js and stage.js. Drop (or explicitly ledger as "deleted") `file`, `conflict`, `exitKeys`,
  `ready`, `loaded`, FIND_CSS and vendor `edit.js` — the owner must confirm; nothing may be dropped silently.

### js/diffthemes.js (4 lines)

- **Purpose.** Generated TextMate themes `XO_DARK`, `XO_LIGHT` from the --code-* tokens for Pierre/Shiki.
- **Exports.** `XO_DARK`, `XO_LIGHT`. Importer: diffview.js L55 (dynamic). Generated by tools/diffview/theme.mjs
  (L153); tests/diffview.test.mjs L48 fails when stale.
- **Imports / coupling.** None at runtime; build-time coupling to css/app.css token values (hex values baked in,
  so the diff colours do not follow token edits until regenerated).
- **State / responsibilities.** Data only.
- **Proposed home.** `modules/changes/diff-renderer/themes.js` (generated artefact), or `core/ui/tokens/generated/`
  if other code renderers will use the same TextMate pair. Keep the generator + staleness test with it.

---

## 2. Vendored libraries (js/vendor/) and worker scripts

| Library | Version (as stated) | Entry files | First-party importers | Loading |
|---|---|---|---|---|
| **CodeMirror 6** bundle (`codemirror/`) | manifest.json "pinned": @codemirror/state 6.7.6, view 6.43.15, commands 6.11.1, search 6.7.2, language 6.13.1, autocomplete 6.20.4, merge 6.12.3, lang-markdown 6.5.2, language-data 6.5.2, @lezer/* ; esbuild 0.28.2; 124 chunks in `c/` (legacy modes + lang packages) | `cm.js` (72 KB, re-exports the API), `merge.js` (29 KB, @codemirror/merge) | doceditor.js L14-18 (`import(CM_URL)`, `import(MERGE_URL)`) | **Lazy**: first file open (viewer `open()` calls `prefetch()` L866); merge only for Show changes / conflicts; each language chunk loaded on demand via `LanguageDescription.load()` (cm.js has 136 dynamic `import("./c/…")`). Main thread. Build: tools/codemirror/vendor.mjs. Licences: LICENSES.md. |
| **@pierre/diffs** (`pierre-diffs/`) | 1.6.4 (manifest), bundles shiki 4.6.0, @pierre/theming 1.0.2, diff 9.0.0, oniguruma-to-es, hast-util-to-html …; 46 languages; sha256 per file; **one local patch** to `edit.js` (find-bar focus, 10 Nov, tests/pierre-find-focus.test.mjs) | `diffs.js` (358 KB), `worker.js` (121 B, imports 4 chunks), `edit.js` (173 KB, patched), `c/` 90 chunks | diffview.js L19-21 | **Lazy**: idle prefetch after a /changes read (changes.js L110 → diffview.prefetch) or first `diff()`; grammars per language in the worker. `edit.js` is only referenced by the dead `file().edit()` → effectively unused at runtime. Build: tools/diffview/vendor.mjs. |
| **KaTeX** (`katex/`) | 0.19.1 (README) | `katex.min.js` (UMD → `window.katex`), `katex.min.css`, `fonts/*.woff2` (woff/ttf fallbacks removed from CSS) | rich.js L90 (base URL; script/style injected) | **Lazy** (first formula), main thread. Reaches this domain through mdlive.js → rich.js `drawMath`. |
| **Mermaid** (`mermaid/`) | 12.3.0 (README) | `mermaid.esm.min.mjs` (31 KB) + `chunks/mermaid.esm.min/*.mjs` (105 files) | rich.js L147 (`import()`) | **Lazy**, per diagram type chunk; main thread. The ELK layout chunk (`elk-VW7CPVO3.mjs`) contains a `new Worker(…)` path (elkjs); XO does not configure a worker URL — verify it never spawns one. Reached from mdlive.js via rich.js `drawDiagram`. |
| **xterm.js** (`xterm/`) | @xterm/xterm 6.0.0, @xterm/addon-fit 0.11.0 (README, with sha256 + tarball integrity) | `xterm.mjs`, `addon-fit.mjs`, `xterm.css` | shells/term.js L8-9 (static import); index.html L17 (`<link>` xterm.css) | **Static** import within shells/term.js, which shells/dock.js imports statically → loaded with the app bundle graph at startup (CSS always). Main thread. |
| **Pierre Trees icons** (`pierre/`) | @pierre/trees 1.0.0-beta.6 "complete" coloured set (header of icons.js); Apache-2.0 + NOTICE | `icons.js` (`PIERRE`) | fileicons.js L19 (static) | **Static**, startup. Data only. |
| **Lucide** (`lucide/`) | lucide-static 1.68.0 (headers); ISC | `files.js` (`LUCIDE`), `projects.js` (`LUCIDE_PROJECTS`) | **none** — grep finds no importer anywhere in the snapshot (fileicons.js and projicons.js import `PIERRE` / `./icon.js` instead); projects.js cites a generator in design-research/…/gen-project-icons.py | **Orphaned** vendor data: must be ledgered (keep for the generator, or delete with owner sign-off). |
| **Agent marks** (`agent-marks/`) | @lobehub/icons-static-svg 1.104.0 (README); MIT; owner-chosen 19 Nov | `claude.svg`, `openai.svg` (mask), `antigravity.svg` | css/app.css L1858-1860 (`.agm-*` background/mask URLs), described by runtimes.js L19 `rtMark` | CSS-loaded on first use of the class. Not JS. |

**Worker scripts (all of them).** First-party code creates exactly one worker type: `diffview.js` L65
`new Worker(new URL("./vendor/pierre-diffs/worker.js"), {type:"module"})`, pool size 1, created by
`getOrCreateWorkerPoolSingleton` on the first prefetch/draw; all Shiki tokenising/grammar compilation for diffs
runs there (`mainThreadMaxCharacters: 0`). `worker.js` is 121 bytes: four `import "./c/chunk-*.js"` lines that
install Pierre's worker handler. No service worker, SharedWorker or `importScripts` exists in first-party code
(grep over js/, index.html, tools/). Inside vendor, only Mermaid's ELK chunk contains a `new Worker` call (see
table). CodeMirror, KaTeX and Mermaid otherwise run on the main thread.

Proposed home: `vendor/` as-is, each with its manifest/README/licences, plus a thin **vendor adapter per library**
(diffview.js for Pierre, doceditor.js loader for CodeMirror, rich.js loaders for KaTeX/Mermaid, shells/term.js for
xterm) so a module never imports a vendor path directly. The build/refresh tools (tools/codemirror/vendor.mjs,
tools/diffview/vendor.mjs, tools/diffview/theme.mjs) and integrity tests move with the adapters.

---

## 3. Domain summary

### 3.1 Proposed module boundaries

1. **core/services/places** (new, shared) — the "place" model: view → place (`t:<id>` → thread worktree,
   `p:<id>` → project, else none), file → place, `localIn`, worktree path parsing (`.xo/worktrees/<name>/`),
   `RUNS` runs-code rule, `.xo/` read-only rule (`canMake`, files.js L508). Replaces files.js L47-90, changes.js
   L45-54 and L172-185, viewer.js L47/L308, and app.js L242/L250/L3342/L3671. One shape:
   `{key, project, base, worktree, root, label, sub, tid}`.
2. **core/services/activity** (new, shared with Map/conversation) — what agents touched/are editing from turns:
   merge files.js `touched`/`marksOf` (L129-177) and changes.js `activityIn` (L61-89); map.js `activityOf` is the
   underlying reader.
3. **modules/files** —
   - `documents` (docs.js + drafts.js + merge.js + external-change intake from viewer.js L781-823): a service,
     subscribing itself to the bus for `file.version`, `file.version.attributed`, `file.rescan`; owning
     page-lifecycle draft saving (viewer.js L1050-1057).
   - `ops` (files.js L579-743 + viewer download): create, mkdir, rename/move, delete, undo, download, copy path.
   - `tree` (files.js tree store + view + ⋯ + drag).
   - `viewer` (viewer.js shell: tabs, head, versions bar, kind renderers, ask hooks).
   - `editor` (doceditor.js + mdlive.js).
   - `page` (filespage.js: the panel page registration, width/fold persistence).
4. **modules/changes** — `store` (changes.js minus refs/scoping), `frame` (changesframe.js), `file-diff` (one shared
   component replacing viewer.js `drawDiff` L427-504 and changesframe `draw` L123-167, including image changes
   from imagechange.js), `diff-renderer` (diffview.js live part + diffthemes.js). The "unsupported" fallback list
   (files.js `changes()` L924-927 + stage.js `changesHtml`) moves here too, so Changes is one module.
5. **modules/conversation/refs** — `fileRef`, `lineRef`, `FILE_MARK` (changes.js L32-42).
6. **core/ui** — `countsHtml` (changesframe L30-36) as a component; one menu component replacing files.js ⋯
   (L507-570) and viewer ⋯ (L144-184, L1067-1074); focus-preservation helpers (`hookOf`, `inRegion`,
   `refocus`, `headFocus`); tabs strip.
7. **core/platform** — clipboard (viewer `copy` L924-960 vs util `copyText`), idle gate (diffview `quiet`),
   words (all the error/notice strings: files.js `makeWords`, docs.js `refusal`, viewer NOT_EDITABLE, changes
   `noPatchWords`).

### 3.2 Places (slots) this domain needs

| Slot | Kind | Scope | Registered by / used for |
|---|---|---|---|
| `panel.page` | keyed (by page name; `single` flag) | app | Files page (filespage.js L81) — spec: width, title, lead, act, icon, mount/onShow/onHide/unmount, canClose, escape. Already exists informally in stage.js L442-458. |
| `panel.frame` | list (ordered, user can hide/fold via shape) | conversation/place | Changes frame (stage.js L110-115 builds it today; must become a registration). |
| `panel.head.action` (page lead) | list | page | Files' "show/hide the files" toggle (filespage L89-94; `data-stg-act` → `act(name)`). |
| `files.viewer.kind` | keyed priority-chain (first that accepts a file) | app | text/code (editor), markdown page, html preview (sandboxed), image, pdf, attachment text, binary/why. Today hard-coded in viewer.js L104-110, L389-403, L689-718. Apps would register viewers here. |
| `files.viewer.head.action` | list | file | Ask about this (L280-281), runs-code badge, read-only badge, view switches, ⋯ items (copy, copy path, download, open in new tab). |
| `files.row.menu` | list | place | New file, New folder, Rename or move, Delete, Copy path (files.js L531-534). |
| `files.tree.section` | list (ordered) | place | "Changed here"/"Touched by agents", "All files" (files.js L304-318). Changes module should contribute the Changed section instead of files.js calling `changes.of`. |
| `editor.extension` | list | file kind | mdlive page view, ask tooltip, tints; lets apps add CM extensions. |
| `keys.action` (global/diff/editor) | keyed with scope precedence | app / focused region | `treeFold` mod+b, `nextChange` j, `prevChange` k, ⌘S, ⌃G, ⌘L, ⌘B/I/E/⇧X in the Markdown page. Needs focus-scoped precedence (see ⌘B risk). |
| `file.opener` / `open-file` command | single (command handler) | app | Every "open a file" (chips, Made, Map, lightbox, quick open, attachments, Changes' Open in Files) ends in `viewer.open(f, from)`; app.js has 8 call sites. Should be one command `files.open({project, rel | att | local, lines, show, pin, created}, from)`. |
| `conversation.block` / message capsule | keyed | conversation | file and line refs (`fileRef`/`lineRef`) rendered as capsules that run `files.open`. |
| bus events consumed | — | app | `file.version`, `file.version.attributed`, `file.rescan` (SSE via world.onEvent), `theme.changed`, `view.changed` (replace `FP.sync()`/`FILES.render()`/`VW.notice()`/`CHG.sync()` render polls). |
| bus events emitted | — | app | `files.saved({project, rel})` (→ changes re-read, today `edits.saved` → app.js `savedSoon` 2.5 s debounce → `CHG.saved`), `files.created/moved/deleted` (→ paths index; today files.js calls `paths.changed` directly), `changes.updated` (→ chips' counts, stage head). |

### 3.3 Public API to other modules

- **files**: `open(file, from)`, `close({restore})`, `isOpen`, `hasFile`, `current` (file), `openFiles` (for ⌘P),
  `goto(line)`, `leave(go)` / `confirmLeave()` (unsaved and conflicts before navigating; app.js L3101),
  `escape()`, `park()/unpark()/refresh()` (Map live mode), `revealInTree(file)`.
- **documents** (service): `open(project, rel, data)`, `get`, `all`, `unsaved`, `flush`, `changed`, `renamed`,
  `keepDraft`, `on(event)`.
- **changes**: `of(place)`, `at(project, rel)`, `patch(place, path)`, `forTarget(place, target)` (chips),
  `activity(place)`, `saved(project, rel)`, `select(path)` / `showChange(path)` / `resumeFollow()` / `chosen()`
  (frame), `countsHtml` via core/ui.
- **places**: `ofView(view)`, `ofFile(file)`, `localIn(place, file)`, `runsCode(path)`, `isReadOnly(path)`.

### 3.4 Risks in moving it (subtle behaviour easy to lose)

1. **`#viewer` is a singleton element re-parented into Files** (files.js L884-885) and found by id from
   filespage.js L101, files.js L410 and app.js; CSS keys off `body.viewer-open`. A module system that mounts per
   slot must keep exactly one viewer element alive for the app's life (filespage.js L21-22: "the viewer is one
   element for the app's whole life") or the editor state/undo is lost.
2. **Editor state survives tab switches and remounts** via `doc.cmState` (doceditor.js L183-187, L284) and docs
   refcounting (docs.js L125-162). Destroying modules on page hide would drop undo history.
3. **Draft "hot exit"**: drafts written on pause (DRAFT_MS 800), pagehide, visibilitychange, beforeunload (viewer
   L1050-1057), on leaving a place (`leave`, L1148-1155) and on close (`close` L892). A draft over the base
   reopens dirty (docs L143-149). Keys `xo-draft:*`, `xo-drafts` must keep their names or migrate.
4. **No autosave**: owner decision 19 Nov 11:42Z (docs.js L6-7, L24); several comments still say "saves itself"
   (viewer L3-4, doceditor L3, docs L28-29). Do not reintroduce autosave from the stale comments.
5. **Runs-code confirmation**: Space 428 → `confirm` pop, `confirmed` sticky per document, Not now leaves it dirty
   (docs L239, L255-260; viewer L243, L1013-1014, L1077, L1083); new-file path uses `RUNS_SAY` and "Enter makes
   it anyway" (files.js L76, L669, L698). Path rule `RUNS` (viewer L47) is case-insensitive by design.
6. **External change intake has two signals**: push (`file.version*`, viewer L800-823) and the fallback /changes
   hash (`notice` L788-798) which turns itself off permanently after the first push (`pushed`, L786). Rename
   events move the document and its tab (L810-816). Losing either breaks "someone else changed it" on older Space.
7. **Merge semantics**: saved docs take theirs in place with glowing lines (TINT_MS 2400); dirty docs 3-way merge;
   overlapping hunks enter conflict with CM unified merge view, resolve when chunk count hits 0, and save only if
   the clash came from your ⌘S (docs L266-322, doceditor L212-222, L261-277).
8. **Versions**: `MERGE_MS` 10 s window collapses your saves into one version; only `KEEP_TEXT` 20 hold text;
   older text read via GET `/file?version=` and pruned ones skipped (`gone`) (docs L105-119, viewer L590-617);
   `/versions` disabled for the session on a missing route (viewer L772-779).
9. **Preview tabs**: single click opens a preview tab that the next open replaces unless dirty/saving/conflict;
   typing or double-click pins it; `created`/`pin` files never preview (viewer L847-873, L378, L972-976).
10. **Focus contracts everywhere** (dozens of grader findings cited in comments): head redrawn in place keeps the
    focused control by its `data-vw-*` hook (L313-351); Try again busy states keep focus (L442-449, L545-555);
    files tree groups redrawn in place via `redraw()` so a press still clicks (L153-161, L267-277 — today's
    owner fix "a folder needed a second click"); `likeOf` (L913-920) restores focus to a redrawn opener by other
    features' hooks. ~25 tests read viewer.js source text and will fail on any file split — they must be
    rewritten to the new paths, not deleted.
11. **reveal() keys by place key, not identity** (files.js L457-461; owner 19 Nov: "Reading…" stuck) — any store
    rewrite must keep comparing `scope.key`.
12. **Tree scrolling must not snap** (files.js L871-873, owner 19 Nov 13:03Z).
13. **Sections fold per project** (`xo-files-secs`), tree width (`xo-files-tree`), fold (`xo-files-folds`):
    persisted settings to migrate into shape/settings.
14. **HTML preview sandbox**: `sandbox="allow-scripts"` with srcdoc, no same-origin (viewer L8-10, L401); serve.py
    refuses null-origin /api. Any apps-host work must not loosen this.
15. **Download without token in URL**: blob via Coder header (viewer L16-17, L121-136).
16. **⌘B collision** between mdlive bold (mdlive L321) and global treeFold (keys.js L32, app.js L4612) — likely an
    existing bug; the new keymap registry must give the focused editor precedence.
17. **Changes following** (owner D6): follow until you touch the diff (wheel/pointerdown/keydown pause,
    changesframe L285), a pill instead of jumps, resume on send (`stage.resumeFollow`), scroll to newest hunk
    (`newestHunkLine`). "Files arriving open Changes" auto-unfold (stage L307-311).
18. **Lazy-loading budget**: CodeMirror on first open, merge only on demand, Pierre on idle after 1.2 s input
    quiet + rIC (diffview L80-103), one worker, grammars in the worker. Moving imports to static module
    registration would put ~2 MB (CM) + ~4 MB (Pierre) on the startup path.
19. **Dead code to ledger, not lose silently**: diffview `file`/`conflict`/`exitKeys`/`ready`/`loaded`/FIND_CSS
    (~230 lines), vendor `pierre-diffs/edit.js` (patched) and its test, vendor `lucide/` (no importer),
    files.js `FILES_ICON`, unused `folderIcon` import and `go` option, docs.js `saveT`, viewer `whenWords` export,
    doceditor `onKey`. Needs owner confirmation before deletion.
20. **Render-time polling**: `FP.sync()`, `FILES.render(view)`, `VW.notice()`, `CHG.sync(view)` are called on every
    app render (app.js L2885 and L2887, L2968). A bus-driven rewrite must keep the same triggers (view change, turns
    change, /changes read) or features silently stop updating.
