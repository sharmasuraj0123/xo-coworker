# How code-server (VS Code) handles files, and what our viewer should copy

Research only, 19 Nov 2026. Nothing was built and nothing is embedded.

**The owner, 09:40Z:** "i don't want to embed code server, i just wanted you to learn how it works, so we can have our file viewer to behave like that at least."

**How this was studied.** Read from the code-server already on this machine (4.145.2, VS Code's workbench at `/tmp/code-server/lib/code-server-4.145.2/lib/vscode/out`):

- its setting defaults, read out of `vs/code/browser/workbench/workbench.js`;
- its own wording, from `nls.messages.json`.

The behaviours below are VS Code's, quoted where possible. Each row then says what XO does today and what to copy.

Related notes in this folder:
- `README.md`: the system map, and section V on versions.
- `files-as-editor.md`: the editor engine options. CodeMirror 6 is the engine that makes most of this possible.

---

## 1. The behaviours, one by one

### 1.1 A file is always editable: no Edit mode

- **VS Code.** Every text file opens in the editor with a caret. There's no Edit button and no read mode.
  - Markdown opens as source. Its preview is a separate editor you open beside it (`⌘K V`).
  - With `markdown.preview.scrollEditorWithPreview` (default **true**), scrolling one scrolls the other.
- **XO today.** Preview first. Edit (or `E`) switches to Source and Pierre's editor, then the head becomes Cancel · Save (`viewer.js:329`).
- **Copy.**
  - **Code opens editable**, with a caret on click and no mode.
  - **Markdown opens as our page and is editable in place** (README Option 1/2). This is better than VS Code's source-plus-preview.
  - **"Source beside"** shows the raw Markdown next to the page, with scrolling synced both ways: VS Code's ⌘K V, the other way round.

### 1.2 Saving: in the browser, VS Code saves by itself

- **VS Code.** `files.autoSave` defaults to **`afterDelay` when it runs in a browser**, and `off` on the desktop. The bundle reads `default: Bt ? AFTER_DELAY : OFF`. Its description: *"An editor with changes is automatically saved after the configured `files.autoSaveDelay`"*, and **`files.autoSaveDelay` = 1000 ms**.
  - Other choices are `onFocusChange` (*"saved when the editor loses focus"*) and `onWindowChange`.
  - `⌘S` still saves at once.
- **XO today.** Explicit Save only.
- **Copy.**
  - **Autosave 1 s after you stop typing, and when you leave the file.** `⌘S` saves at once.
  - The head shows a quiet state: *Saving…* → *Saved*.
  - Files that run code (`.claude/**`, `.git/**`) still ask once before their first save (Space's 428). That's the one place we stay stricter than VS Code.

### 1.3 Unsaved edits survive a reload ("hot exit")

- **VS Code.** `files.hotExit` keeps unsaved editors across a closed window or a reload, as backups. You come back to the same text, still marked unsaved.
- **XO today.** **We already do this.** Drafts are kept in `localStorage` after an 800 ms pause, and on leave, hide and unload (`drafts.js`, `viewer.js:1101–1105`).
- **Copy.** Keep it. With autosave, a draft only ever holds the last second.

### 1.4 Someone else changes the file (an agent, bash, git)

- **VS Code** watches the disk:
  - **No unsaved edits →** the editor **reloads in place**, quietly, keeping your scroll and cursor. No question, no button.
  - **Unsaved edits →** your text stays. Saving then says: *"Failed to save '{0}': The content of the file is newer. Please compare your version with the file contents or overwrite the content of the file with your changes."* It offers **Compare** (a diff of yours ↔ disk, titled `{0} ↔ {1}`) or **Overwrite**. `files.saveConflictResolution` defaults to `askUser`: *"To prevent data loss, the user is asked to compare the changes…"*
  - **Deleted on disk →** the tab stays open, marked *(deleted)*, with your text kept.
- **XO today.**
  - We only notice an agent's change through its edit tool (README A7), and show **Updated · Show** instead of reloading.
  - While you edit, nothing happens until a save gets the 409.
  - On a 409 we **merge automatically** (`merge3`), which is better than VS Code's Compare/Overwrite, and ask only about places you both changed.
- **Copy.**
  - **Clean file → reload in place, as a new version**, with the changed parts tinted for a moment (the owner's 09:12Z ask, README V).
  - **Your unsaved edits → keep them, and merge as today.**
  - **Deleted → keep the tab and your text**, marked deleted, with *Save again* to recreate it.
  - All of this needs **Space to watch the files and push changes** (`watchfiles` is already installed; `files-as-editor.md` §5.1). Otherwise only edit-tool writes are seen.

### 1.5 Local History: every save is kept, and saves close together merge

- **VS Code.** `workbench.localHistory.enabled` (default **true**): *"the file contents of an editor that is saved will be stored to a backup location to be able to restore or review the contents later."*
  - It keeps up to **`maxFileEntries` = 50** per file.
  - **`mergeWindow` = 10 s:** *"the last entry in local file history is replaced with the entry that is being added. This helps reduce the overall number of entries that are added, for example when auto save is enabled."*
  - The **Timeline** view lists the entries with git commits mixed in.
  - Each entry offers *Compare with File*, *Compare with Previous*, **Restore Contents**, and *Rename*.
- **XO today.** Space's edit log keeps every UI save with its contents (30 days, 200 MB), plus Undo of the last save. Agent changes aren't kept (README V3).
- **Copy.** This is README V's version list, done VS Code's way:
  - autosaves inside a **merge window** fold into one version;
  - each version can be compared with the current file or the previous one, and restored;
  - git commits sit in the same list;
  - **plus what VS Code can't do: each version says who made it** (you, which agent's turn, or "changed on disk").

### 1.6 Undo goes back past a save

- **VS Code.** One undo stack per open file. ⌘Z keeps working after an autosave: the file becomes unsaved again, and autosave writes it back.
- **XO today.** Undo lives inside an edit session. After Save it's Space's one-step Undo.
- **Copy.** Keep **one undo stack per open file for as long as it's open**, across autosaves. Older states come from versions (1.5).

### 1.7 Tabs: a single click is a preview, editing keeps it

- **VS Code.** `workbench.editor.enablePreview` (default **true**): a single click opens a **preview tab**. Its name is in *italics*, and the next single click replaces it. Double-clicking or editing pins it. There's *"a maximum of one preview mode editor per editor group."*
  - An unsaved tab shows a **dot** in place of its ×.
  - Closing it asks *Save / Don't Save / Cancel*. With autosave on, that question almost never appears.
  - `⌘⇧T` reopens the last closed tab.
  - `explorer.autoReveal` (default **true**) selects the active file in the tree.
- **XO today.** One file at a time. "Put away" turns it into a chip in the thread's header.
- **Copy.**
  - **Tabs in the Files head**, with the preview-tab rule, so browsing doesn't pile up tabs.
  - A dot while saving or unsaved.
  - ⌘⇧T, and the tree revealing the active file.
  - On a phone, tabs fold into a "3 open" menu.

### 1.8 Getting to a file or a line fast

- **VS Code.**
  - **`⌘P` Quick Open** (fuzzy on path; it opens as a preview unless `enablePreviewFromQuickOpen`, default **false**, so Quick Open pins);
  - **`⌃G` go to line**, **`⌘⇧O`** go to symbol;
  - **breadcrumbs** over the editor (folders › file › symbol);
  - **`⌘⇧F` search** across files, with replace;
  - **`⌘F`** in a file, with regex, case, whole word and in-selection.
- **XO today.** Pierre's find bar while editing. Chat links can open a line range. No quick open, no project search.
- **Copy.**
  - ⌘P and ⌃G first; both are frontend work over the tree we already read.
  - Breadcrumbs: our head already shows the path, so make it clickable.
  - ⌘⇧F needs a Space search route (`git grep`).
  - **Key clash.** XO already uses ⌘B (fold the tree, the same meaning as VS Code ✓), ⌘J (fold the chat, close to VS Code's panel ✓), ⌘\ (the Map, but in VS Code it splits the editor ✗) and ⌘L (ask about lines). ⌘P, ⌃G and ⌘⇧F are free.

### 1.9 The tree does file work in place

- **VS Code's Explorer:**
  - new file or folder **inline** in the tree;
  - **F2 rename** inline;
  - Delete (to trash, undoable);
  - **drag to move**;
  - Copy Path / Copy Relative Path;
  - git colours (M, U, D) and error counts on rows;
  - typing filters the tree.
- **XO today.** Our tree reads and shows the Changed section and counts. There are no file operations, and Space has no rename/move/delete route.
- **Copy.** Inline new, rename and delete, and drag to move. Space routes for these, logged and undoable like saves, with the same read-only and runs-code rules.

### 1.10 The editor itself

- **VS Code:**
  - multi-cursor (`⌥`-click, `⌘D`, `⌘⇧L`);
  - move or copy a line (`⌥↑↓`, `⇧⌥↓`), comment (`⌘/`);
  - folding, bracket matching, sticky scroll (headers stay at the top), word wrap (`⌥Z`), format;
  - the **status bar**: `Ln 12, Col 4`, spaces, encoding, line endings, language.
- **XO today.** Pierre: caret, undo, find.
- **Copy.** All of it comes with **CodeMirror 6** (`files-as-editor.md`). A slim foot shows Ln/Col and, when it matters, line endings and encoding. Space already returns `line_endings` and `bom`.

### 1.11 Side by side, and comparing

- **VS Code.**
  - `⌘\` splits the editor; tabs drag between groups.
  - *Compare with Saved*; *Open Changes* (git, inline or side by side); Compare two files.
- **XO today.** The Changes pane and the Pierre diffs are already good. One file at a time.
- **Copy, later.** Split for the doc and its source, or two files. "Compare with Previous" from versions. Keep our Changes pane as it is.

### 1.12 What VS Code doesn't do that we must

- **Phones.** VS Code has no mobile layout. Ours needs one: the file full screen, the chat as a sheet, tabs in a menu.
- **Documents as pages** with equations, diagrams and charts, editable in place.
- **Agents:** versions that say who made them; select → ask the agent; the agent hearing about your edit (Space's `person_edits` already does that).

---

## 2. What this means for our viewer, in order

| # | Behaviour to copy | Where the work is | Size |
|---|---|---|---|
| 1 | **Always editable, no Edit mode**, for code and for Markdown as a page | FE (`viewer.js`; the editor engine) | with the engine |
| 2 | **Autosave 1 s after typing and on leaving**, ⌘S at once, quiet *Saved*; runs-code files ask once | FE (`viewer.js` save loop) | ½ day |
| 3 | **Clean file reloads in place as a new version**, tinted; unsaved edits kept and merged; deleted kept | FE (`notice`), and the **Space file-watch push** for full coverage | ½ day FE; 1 day Space |
| 4 | **Local History = versions**, with a 10 s merge window, Compare, Restore, git commits alongside, and *who* made each one | FE stepper; Space records agent and disk versions | 1 day (README V) |
| 5 | **Tabs** with the preview-tab rule, a dot while unsaved, ⌘⇧T, the tree revealing the active file | FE (`filesview.js`, `viewer.js` holding several files) | 1–2 days |
| 6 | **⌘P quick open, ⌃G go to line**, clickable breadcrumbs | FE | 1 day |
| 7 | **Tree file work:** new, rename (F2), delete, drag to move | Space routes + FE (`files.js`) | 2 days |
| 8 | **⌘⇧F search across files** | Space route + FE | 1 day |
| 9 | **Editor power:** multi-cursor, move line, comment, folding, sticky scroll, Ln/Col | **CodeMirror 6** in place of Pierre's editor | 2–3 days |
| 10 | Split view and Source beside, with synced scroll | FE | later |

**What could ship today** (frontend only, no new engine, built on Pierre's editor and our viewer):
- #2 autosave;
- the edit-mode part of #1 for code (a click puts a caret in; Edit goes away);
- #3 a clean file reloading in place as a new version;
- #4's stepper over the versions this browser has seen (README V4).

**This week:** CodeMirror 6 (#1 for Markdown, #9), tabs (#5), quick open (#6), and the Space file-watch push (#3).

**Next:** the Space routes for file work and search (#7, #8), then split view (#10).
