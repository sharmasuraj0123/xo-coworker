# The whole Files view as a seamless editor: code-server, VS Code's editor, or our own

Research only, 19 Nov 2026. Nothing was built. This follows `README.md` in this folder (the system map, and section V on versions).

**The owner, 09:35Z:** "if we were to make our entire files view to be something like this and code-server, is it possible … and make it feel seamless? so like I can have features like code server and edit the files anyway i want?? … think properly, don't hang yourself to any single rule or idea. explore properly. I want the smooth and seamless feeling."

**Short answer:** yes. There are four ways to get there. The one that feels most seamless, and still gives "edit any way I want", is a hybrid:

- **Our own Files view on a single modern editor engine** for everyday reading and editing: documents as a canvas, code as code, versions, agents' changes landing live.
- **The real VS Code (code-server) one keystroke away, on the same file and line**, for heavy work.
- **One thing underneath both:** Space watches the files and pushes every change, so anything that edits a file (you, an agent, bash, VS Code) shows up everywhere at once.

---

## 1. What "seamless" has to mean here

These are the rules every option is judged against:

1. **One surface, no modes.** A file opens ready to edit: a doc as a page, code as code. There's no Edit/Save step, and saving happens by itself (README Option 1 / V).
2. **Every change shows up live, whoever made it.** You, an agent's tool, an agent's bash, VS Code, a `git pull`. It lands as a new version (V) and never needs a reload.
3. **IDE power when you want it:** multi-cursor, find/replace with regex, go to line, quick open (⌘P), search across the project, rename/move/create/delete, completion and errors for the language, a terminal, git.
4. **It looks and moves like XO:** our tokens, rounded corners, the 24/32/40 rhythm, light and dark, our keyboard map, and the chat docked beside it. No second app's chrome showing through.
5. **It works on a phone (390 px).** The owner uses the phone layout.
6. **Agent-aware.** You can see who changed what (versions), ask about a selection, and tell the agent.

## 2. What we already have

- **Already running on this workspace: code-server 4.145.2.** This is VS Code in the browser, started by the Coder module: `/tmp/code-server/…`, `--auth none --port 13337`, on localhost.
  - Its pages send a CSP with **no `frame-ancestors` and no `X-Frame-Options`**, so XO could embed it in an iframe. Coder's proxy in front may add its own headers; that's unchecked.
  - It has **no extensions installed**.
  - **It's a Coder add-on, not part of XO.** An XO install elsewhere wouldn't have it unless Space ships one (openvscode-server or code-server; both MIT).
- **xo-space** (`/opt/xo-space`, from `GET /openapi.json`):
  - Already there: file read/save with versions (`GET/PUT /xo-projects/{p}/file`), the edit log and undo, `/changes`, `/file-history`, `/commits`, `/tree`, terminals (`/terminal/sessions`, which our Shells use with xterm), and the older `/files/*` (list, content, save, mkdir, upload).
  - **Missing:** rename, move and delete for project files; search across a project (`ripgrep` isn't installed; `git grep` is); a file-change push; language servers.
  - **`watchfiles` 1.3 and `watchdog` are already installed in Space's venv** (through `uvicorn[standard]`), so watching folders costs no new dependency.
- **Frontend:**
  - Our own tree (`files.js`), viewer (`viewer.js`), Markdown renderer (`markdown.js`, soon with KaTeX, Mermaid and charts) and Shells (xterm).
  - Editing today is **Pierre's** editor (`vendor/pierre-diffs/edit.js`). It's a diff viewer with a basic editor attached: caret, undo and find, but no multi-cursor, completion, language smarts or Markdown widgets.

## 3. How others made it feel seamless

| Product | Editor | What they learned |
|---|---|---|
| **Replit** | Moved Monaco → **CodeMirror 6** (mobile first, then desktop) | Monaco added ~51 MB to their bundle (~5 MB parsed and gzipped) and slowed loading. CM6 is "significantly more lightweight, performant, and customizable". Mobile users on CM were ~70% more likely to stay than on Ace. |
| **Sourcegraph** | Moved Monaco → **CodeMirror 6** everywhere | Monaco gives "a full IDE by default" with global shared state, and many small niggles added up. CM6 is building blocks they could make their own. |
| **GitHub.dev / Codespaces, Gitpod** | Whole **VS Code** web workbench | Full power, but it *is* VS Code: its own chrome, its own tree, its own keys. GitHub doesn't try to blend it into github.com; it's a separate place (press `.`). |
| **Cursor, Windsurf** | **Forks** of VS Code | To make AI feel native they had to own the whole workbench. An extension alone couldn't do it. |
| **StackBlitz / Bolt, Lovable, v0** | Their own UI with a code pane (CM6 or Monaco) | The chat and the files are one product; the editor is a component, not an app. |
| **Obsidian, Jupyter, Chrome DevTools** | **CodeMirror 6** | One engine for rich documents and code, themed to the host. |
| **Claude, ChatGPT, Gemini canvases** | Their own editors | A doc or code canvas beside the chat, versions, select → ask (README V). |

The pattern: **products that feel seamless own the editor as a component inside their UI.** Products that embed the whole VS Code workbench get its power but keep it as a separate place.

## 4. Four routes

### Route 1: Files *is* code-server (VS Code embedded, themed to XO)

**What you see.** The Files area becomes VS Code: its explorer, tabs, editor, search, git, terminal and extensions. We trim it with settings (activity bar hidden, menu off, status bar slim, a custom XO colour theme) and an XO extension. The chat stays docked beside it.

**What you get, from day one:** the whole of VS Code. IntelliSense through language extensions, debugging, refactors, multi-root, extensions from Open VSX, and Markdown preview side by side. It **watches the disk itself**, so an agent's write reloads the file if you haven't changed it.

**What breaks the seamless feel:**
- **Two apps stitched together.** VS Code's tree duplicates ours, and its tabs, menus and context menus, its toasts, and its density (22 px rows, square corners) are its own. A theme can recolour it; it can't round or re-space the workbench without forking.
- **Keyboard clashes.** ⌘P, ⌘B, ⌘J, ⌘\ and Esc are XO's *and* VS Code's. Inside the iframe, VS Code wins and XO's keys stop working; outside, the reverse.
- **Focus and scroll live in a separate document.** Our focus rules, announcements, glass and motion don't reach inside.
- **No XO inside it unless we write an extension.** That means agent versions, "Ask about lines", the doc canvas with our renderer, and who-changed-what. Cursor's lesson is that an extension only gets so far.
- **Phone:** VS Code web at 390 px is poor (no real mobile layout).
- **Weight:** ~2–4 s cold start, a few hundred MB of memory per window.
- **Install:** Space would have to ship and supervise openvscode-server outside Coder, and proxy it through `serve.py` behind XO's auth. It's full shell access, the same trust our Shells already have.

**Size.** 1–2 days to embed, theme and route it (proxy, auth, open-at-file). Weeks for an XO extension that brings versions and asking into it.

**Verdict.** Maximum power, fast. It feels like VS Code inside XO, not like XO.

### Route 2: VS Code's editor (Monaco, optionally with `monaco-vscode-api`) inside our own Files view

**What you see.** Our tree, our head, our tabs, our chat dock. The editor pane is VS Code's editor: the same keys, multi-cursor, find/replace, minimap, the diff editor, and completion for JS/TS/JSON/CSS/HTML built in. With CodinGame's `monaco-vscode-api` it can even load VS Code themes and some web extensions in a worker.

**What breaks it:**
- Monaco is **large** (Replit: ~5 MB gzipped).
- It's **weak on phones** (both Replit and Sourcegraph left it).
- Its theming is VS Code's model, not CSS, so matching our tokens takes a translation layer.
- **Markdown as a canvas isn't Monaco's job,** so documents would still need a second engine.
- Languages other than JS/TS need language servers on Space (as in Route 3).

**Size.** About a week for the editor and tabs, plus language servers later.

**Verdict.** VS Code's feel for code, but heavy, and two engines (Monaco and a doc engine).

### Route 3: one engine, CodeMirror 6, for everything in our own Files view

**What you see.** Files stays XO. Every text file opens in **one CM6 editor themed with our tokens**:

- **`.md`** as the live page from README Option 2: rendered, with Markdown showing only on the caret's line, and equations, diagrams and charts as widgets using the chat's renderer.
- **Code** with VS Code-style keys: multi-cursor, ⌘D, ⌥↑↓ to move lines, a regex find/replace panel, folding, bracket matching, and optionally vim.
- **Merges and Show changes** in `@codemirror/merge`, which replaces today's Pierre merge view.
- **Completion and errors** through the official `@codemirror/lsp-client`, talking to language servers that Space runs (pyright, typescript-language-server, gopls…) over a websocket through `serve.py`.

**Around it, our own UI:**
- tabs, with split right;
- **⌘P quick open** (fuzzy over `git ls-files` or the tree);
- **⌘⇧F search** (a new Space route over `git grep`, or ripgrep if added);
- rename/move/delete/new file in the tree (new Space routes, logged like saves);
- the **Shells** dock as the terminal;
- Changes and versions (V) in the head.

**Seamless because:**
- it's one app, one theme, one keyboard map, one focus model;
- it's light (~75 kB gzipped core, plus languages on demand) and works well on touch;
- agents' changes land as CM transactions, so your caret stays put (README Option 2).

**What it costs:**
- We build the IDE features ourselves, piece by piece.
- Debugging, extensions and refactors stay out of reach (Route 4 covers those).
- It replaces Pierre's editor (Pierre can stay for read-only diffs).

**Size, all incremental:**
- the editor plus our theme and keys: 2–3 days;
- the Markdown live page: 3–5 days;
- tabs and quick open: 1–2 days;
- search and file ops (Space + frontend): 2 days;
- language servers (Space + frontend): 3–5 days.

### Route 4 (recommended): Route 3 as home, with the real VS Code one keystroke away

**What you see.** Everything in Route 3. In the Files head there's also **Open in VS Code** (⌘⇧O, and in ⋯). It opens code-server **on the same file and line**, in a new browser tab on a desktop, or optionally as a full-width pane in Files with XO's chat still docked. It's for the 10% that needs extensions, debugging or a big refactor.

**Why it feels seamless, not like two apps:**
- **The same files and the same live updates both ways.** Space's file-watch push (§5.1) sees VS Code's saves and lands them in XO as versions. VS Code sees XO's and the agents' saves through its own watcher.
- **No duplicated everyday editing.** XO's own editor is complete enough that VS Code is a deliberate step, not a crutch.
- **Coming back** to XO's tab shows the file where VS Code left it, as a new version.

**Size.** Route 3, plus ~½ day for the handoff. Opening at a file and line uses code-server's `?folder=` and, inside it, `code-server -r file:line` through its IPC socket, or a tiny XO extension listening for "open this". Both to be verified.

## 5. The foundation any route needs (and the order to build it)

1. **File-change push (Space).** Watch each open project's folder with `watchfiles` (already installed), debounced, ignoring `.git/` and heavy folders. On a change, send an SSE `file.changed {project, path, version, at}` on the stream the UI already has.
   - This closes README A7's gaps for bash writes, committed files, other places, VS Code and `git pull` in one go.
   - Each change also becomes a **version** (V): attributed to the agent's turn when `_turn_wrote` (`made.py:186`) claims it, else "changed on disk".
2. **Versions (V).** The stepper, Show changes and Restore, over the edit log plus agent and disk versions.
3. **File operations (Space).** `POST /xo-projects/{p}/files:rename|move|delete`, logged and undoable like saves, with the same read-only and runs-code rules.
4. **Find (Space).** `GET /xo-projects/{p}/search?q=&regex=&case=` (`git grep`, or ripgrep if it's added), and a fast file list for ⌘P.
5. **Language servers (Space, later).** Start them per project and language on demand, and proxy them over a websocket through `serve.py` with the writer check.

## 6. Recommendation and phasing

**Route 4:** XO's own Files on CodeMirror 6, with VS Code one keystroke away and Space's file-watch push underneath.

- It's the only route that is *both* seamless (one app, our look, our keys, phone-ready, agent-aware) *and* "edit any way I want" (VS Code for the rest).
- It's what Replit, Sourcegraph and the AI canvases converged on: own the editor as a component, don't host a second app.

| When | What |
|---|---|
| **Today** (fits the release) | (a) Versions slice from README V4: agent changes land as a new version, with a stepper, Show changes and Restore (frontend only). (b) **Open in VS Code** from Files, on this workspace's code-server, in a new tab at the file. Needs the Coder app URL and an open-at-file check. |
| **This week** | Space file-watch push + versions recorded at turn end. CM6 replaces Pierre's editor for code (our theme and keys, autosave). The `.md` live page. Tabs and ⌘P. |
| **Next** | Search and file ops in Space. Language servers. `@codemirror/merge` for conflicts and Show changes. Optionally VS Code as a pane inside Files, with an XO extension (versions, ask about a selection). |

**For the owner to decide:**
- Is Route 4's split (XO's own editor for everyday, VS Code for heavy work) right? Or do you want Route 1 (VS Code *is* Files, full power now, VS Code's look)?
- Does "Open in VS Code" open a new browser tab (simplest, no key clashes), or a pane inside Files?

## Sources

- Replit: [Betting on CodeMirror](https://replit.com/blog/codemirror); [CodeMirror mobile](https://blog.repl.it/codemirror-mobile); [Ace, CodeMirror, and Monaco compared](https://replit.com/blog/code-editors)
- Sourcegraph: [Migrating from Monaco Editor to CodeMirror](https://sourcegraph.com/blog/migrating-monaco-codemirror)
- CodeMirror: [@codemirror/lsp-client](https://www.npmjs.com/package/%40codemirror%2Flsp-client) ([announcement](https://discuss.codemirror.net/t/codemirror-lsp-client/9309)); [bundling, minimal setup](https://codemirror.net/examples/bundle/)
- VS Code's editor in other apps: [@codingame/monaco-vscode-api](https://www.npmjs.com/package/@codingame/monaco-vscode-api)
- Embedding code-server: [code-server discussion #6079](https://github.com/coder/code-server/discussions/6079); [iframe-embedded code-server and its host page](https://blog-aol-en.pages.dev/2023/12/10/iframecode-server)
- On this machine: `ps` (code-server 4.145.2 on 127.0.0.1:13337, `--auth none`), its response headers (CSP without `frame-ancestors`), Space's `GET /openapi.json`, and Space's venv (`watchfiles` 1.3, `watchdog`).
