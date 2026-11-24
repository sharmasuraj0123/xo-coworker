# xo-coworker, modular: the plan

A plan only, 2026-11-19. Nothing was built and nothing in the repo was changed.

- **Researched:** `release/2026-11-19` at `6c73139a5dc917bfe7e278e6e481c4ab2863c887`, read from a read-only export. The owner's checkout was not touched.
- **The owner's ask:** *"make it very modular so we can integrate further apps into it natively, like plug and play."* Also: *"note the name down of every single file … when porting it … nothing is left."*

### Files that come with this plan

On branch `coworker/modular`: the readable files are in `architecture/modular/`, the data and scripts in `tools/ledger/`. The ledger's base commit is now `f006ec1`, the release head the branch was cut from; it was re-run there (1,310 files, 0 problems).

| File | What it is |
|---|---|
| `architecture/modular/INVENTORY.md`, `tools/ledger/inventory.json` | Every one of the **1,309 tracked files**, grouped, with line counts. For our own code it also lists what is inside each file: exports, functions, DOM ids, storage keys, backend routes, custom events, keyboard keys, globals, CSS custom properties. Generated from git by `tools/inventory.py`. |
| `architecture/modular/LEDGER.md`, `tools/ledger/ledger.json` | Every file, and **2,290 items inside our own files**, mapped to a new home. Each has a status: planned, split, vendor or decide. Every item in `js/app.js` already points at its region's home. |
| `tools/ledger/check_ledger.py` | The "nothing is left" gate. In plan mode it fails if any tracked file is missing from the ledger or has no home. Today it passes: 0 problems, and 332 entries wait for the owner's decision. With `--final` it fails until every entry is moved, kept, split, deleted with a written reason, or vendored. |
| `architecture/modular/analysis/1–6` | Six deep reads of the codebase (about 51,000 words): `app.js` in 98 contiguous regions covering lines 1–4819 with no gaps, `app.css` in 45 regions covering lines 1–3149, ~100 backend routes, about 30 stream frame types, all 175 tests classified, every vendored library, and the subtle behaviours with line numbers. |

---

## 0. The plan on one page

1. **Today's code has good parts and one big problem.**
   - **Good parts:** today's work added real seeds of modularity: the panel's page API (`stage.js`), mountable conversation instances, the shells dock, one icon source, the token scale and the per-person shape store. These are the right ideas.
   - **The problem:** everything is still **wired by hand through one 4,819-line `js/app.js`**, which exports nothing and passes ~25 callbacks around. On top of that:
     - one 3,149-line `css/app.css`, whose winners depend on `<link>` order plus 58 `!important`;
     - one `index.html` that holds every feature's markup;
     - 114 of 175 tests that read source text instead of running code.
2. **Build a small kernel, then move one feature at a time into self-contained modules.**
   - The kernel has four parts:
     - a registry of **places** (named spots in the UI that features plug into);
     - a module lifecycle where every registration has an undo;
     - an event bus;
     - one scheduler and one layer stack.
   - Each module (a folder with its JS, CSS, tests and a `module.json`) plugs into places.
   - `app.js` shrinks to a boot file of about 50 lines.
3. **Apps plug into the same places.**
   - First-party **modules** run in the page and are trusted.
   - **Apps** are MCP-native packages (the 4 Nov contract). Their views run in sandboxed frames, their servers are run by xo-space, and their permissions are granted per project.
   - From the UI's side, a panel tab from an app and one from a module go into the same place, so apps feel native.
4. **No framework, no runtime build.** We keep vanilla ES modules and `redraw()`, because the hardest-won behaviours live there: clicks survive live redraws, focus is never lost, scroll anchoring works.
   - We add **dev-only** checks: JSDoc types checked by `tsc`, `oxlint`, and one test command.
5. **Nothing is left behind.** That is enforced by `check_ledger.py`, not promised. Every phase updates the ledger, and the final phase must pass `--final`.
6. **Size.**
   - Phases 0–6 (the whole frontend, modular): about **13–15 weeks of work**, or **8–10 weeks of calendar time** with 2–3 threads in parallel once the shell exists.
   - Phase 7 (the app host, with xo-space): 3–4 more weeks.

   This is more than the 4–6 weeks I guessed this morning. The full inventory shows why: 30,840 lines of JS, 6,841 of CSS, and 114 source-reading tests to rewrite.

---

## 1. Where it stands today (measured)

| | Count |
|---|---|
| Tracked files | 1,309 (84,257 lines) |
| Our JS | 79 files, 30,840 lines. The largest are `app.js` 4,819, `map.js` 1,360, `storm.js` 1,242, `launchpad.js` 1,166, `viewer.js` 1,157 and `decide.js` 1,104. |
| Our CSS | 18 files, 6,841 lines. `app.css` alone is 3,149. |
| Tests | 165 unit + 9 browser suites + a harness, 2 lib files, 2 fixtures. **Only 51 run real code; 114 read source or CSS text.** 48 of those read `app.js` and 23 read `viewer.js`. |
| Vendor | 371 files: CodeMirror 6, @pierre/diffs 1.6.4, KaTeX 0.19.1, Mermaid 12.3.0, xterm 6.0.0, Pierre tree icons, lucide (unused) |
| Assets | 385 icon sources (the generator's input; the browser never fetches them), 3 Geist fonts |
| Research and mockups tracked in the product repo | 231 files, mostly images. Only 4 are needed by tests. |
| Backend contract | ~100 HTTP routes (9 defined but never called), about 30 global-stream frame types (24 rows in `analysis/4 §3.2`; some rows cover several), 10 deploy-stream event types |

### Seeds of modularity already there (keep and generalise)

- **`stage.js` page API.**
  - `page(name, {title, icon, width, single, lead, act, mount, onShow, onHide, unmount, canClose, escape})`, plus `show / sections / closeTab / requestClose / pages / refit`, with at most 5 tabs.
  - Three pages are registered today: Shell, Files (`filespage.js:81`) and Thread (`app.js:2761`).
  - **It becomes the kernel's `panel.page` place.**
- **Conversation instances.** `createConv` (app.js:2826), `drawConv` (2959), `createFollow` (follow.js:27) and `decorateConversation` (msgx.js:36). The second instance is the Thread page. This becomes `modules/conversation`'s `mount(host, opts) → {…, destroy()}`.
- **`createShells`** (`js/shells/dock.js`) and the decision dock **`createDock`** (app.js:1718): self-contained controllers.
- **One icon source** (`xoicons.js`, generated by `tools/xoicons`) and **one token scale** (`tokens.css`). These become `core/ui`.
- **The shape store** (`shape.js`, `/api/chat/shape`) with presets whose `apps` and `layout.panel/dock/canvas/commands` keys nothing reads yet. It already drafts the registry, and place ids should match its ids (`xo:panel/agents`, `xo:dock/shells`, …).

### What makes it hard to change today

- **One hub.** `app.js` exports nothing.
  - Features get its functions as callbacks: `go`, `schedule`, `announce`, `heraldShow`, `PROJ`, `isBusy`, `threadState`, `putBack`, …
  - It holds one `render()` that redraws everything, a shared state object `S` that is passed whole into `create.js` and `herald.js`, and one 45-branch click handler whose order matters.
  - **The list of open layers is coded in 6 places that disagree:** Escape order, phone Back, inert, Tab trap, gestures.
- **Duplicates.**
  - Two SSE parsers, two GitHub device-flow clients, two `esc`, two `usable()` with different meanings, three easing constants and three reduced-motion queries.
  - Two diff drawers (viewer `drawDiff`, changesframe `draw`).
  - The main composer and the Thread page's composer are copies, and both default to the *main* field's text (`liveBlock`, `composerDest`).
- **Leaks.**
  - Thread page mounts never tear down msgx's listeners, interval, style elements and observers, or the dock's and `tpMount`'s.
  - Document listeners in recordview, map, launchpad and storm are never removed, and storm's 60 s timer survives `stop()`.
- **CSS order is behaviour.** foundation, panel and phone win only by load order. ID selectors (`#msgs #tmsgs #say #composer …`) bind styles to `index.html`'s markup.
- **Tests guard text, not behaviour.** Any move breaks 114 tests even when nothing visible changes.

---

## 2. Target architecture

### 2.1 Layers, and the one rule

```
apps (sandboxed frames + MCP servers run by xo-space)        ← third-party and later first-party apps
  └─ apps-host            frame, bridge, manifest → contributions, grants view
modules/<id>/             first-party features, each self-contained
shell/                    the frame: rail, header, panel host, page host, dock host, layers, phone
core/services/            storm (client · stream · reducers · selectors · commands), world, shape, places,
                          paths, notices, runtimes, account, review, github, activity, git-state
core/ui/                  tokens, foundation, components, icons, markdown, lightbox, redraw, motion, a11y
core/platform/            http, sse, router, keys, gestures, time, util, fuzzy, pending, clipboard, diff
core/kernel/              places, modules, bus, effects (undo), scheduler (invalidate), layers
vendor/                   third-party code, unchanged, one thin adapter per library
```

**The rule:** a file may import only its own folder and the layers below it.
- Modules never import each other. They talk through **services** (`ctx.use("files")`), **places** and **bus events**.
- `core/kernel` imports nothing.
- `core/services` never touches the DOM. The shape engine, storm reducers and world selectors are already node-testable, and stay so.
- An import-boundary test enforces all of this (§5).

### 2.2 Folder layout

```
index.html            shell frame only (~60 lines): pre-paint snippet, core CSS, importmap, boot
boot.js               ~50 lines: kernel.start(modules from modules/index.json)
core/kernel/ core/platform/ core/ui/ core/services/
shell/                frame.js, rail/, header/, panel/ (from stage.js), pages/, dock/, layers.js, phone.css
modules/
  index.json          the ordered list of first-party modules (like dsh's profile)
  shells/  launchpad/  files/  changes/  conversation/  composer/  decisions/  threads/  chats/
  intelligence/  map/  home/  since/  artifacts/  projects/  create-project/  search/
  settings/  runtimes/  routing/  rules/  worktrees/
    └ each: module.json · module.js · *.js · *.css · tests/ · README.md
apps-host/            (phase 7)
vendor/               (moved from js/vendor/)
e2e/                  browser suites + harness + fixtures (from tests/browser/)
tools/                generators (xoicons, diff themes, vendor manifests), probes, ledger tools
architecture/decisions/       dated decision notes (the owner's standing calls)
```

Bare imports go through an `<script type="importmap">` (`@xo/kernel`, `@xo/ui`, …), so paths can move without editing every importer. That needs no build step. A generated `<link rel="modulepreload">` list keeps the first paint from becoming a waterfall of requests.

### 2.3 The kernel (`core/kernel`, target ≤ 600 lines, 100% unit-tested)

| Part | What it does | Replaces today |
|---|---|---|
| **places** | `definePlace(id, {kind, scope, props})`, `contribute(id, entry) → undo`, `entries(id, scope)`, `watch(id, fn) → undo`. Kinds: `single`, `list` (ordered; the shape can reorder or hide), `keyed`, `chain` (the first entry whose `when()` holds wins). Scopes: `app`, `project`, `conversation`. | stage `page()`, `SURFACES`, keys `ACTIONS`, hand-coded lists in index.html and app.js |
| **modules** | It reads each module's `module.json`, checks it (id, version, the kernel API range, `needs`, the places it contributes to, routes, storage keys, shortcuts, styles), orders modules by `needs`, then `activate(ctx)`. **Disable means undo everything the module registered.** Safe mode starts core modules only. | the import order in app.js; side effects at import time |
| **effects** | `ctx.effect(fn)` collects disposers. `ctx.on`, `ctx.contribute`, `ctx.keys.register`, `ctx.listen(target, …)`, `ctx.interval` and `ctx.observe` are all effects, and they run in reverse order on deactivate. | the leaks listed in §1 |
| **bus** | Typed topics: `view:changed`, `shape:changed`, `world:*` (message, thread-state, moved, file, …), `files:saved/created/moved/deleted`, `changes:updated`, `conversation:opened`, `message:sent`, `decision:made/undone`, `turn:ended`, `project:created`. | callbacks threaded through app.js; render-time polls (`FP.sync`, `FILES.render`, `VW.notice`, `CHG.sync`); create.js writing `S` |
| **scheduler** | `invalidate(placeId \| region)` batches redraws, per place, never the whole app. | `schedule()` → one global `render()` |
| **layers** | One stack (`push(layer) → undo`), read by Escape, phone Back, `inert`, the Tab trap, gestures and swipe-close. | 6 diverging lists in app.js |

### 2.4 The places catalogue (merged from the six analyses)

These are first-party places for v1. **Open to apps** says whether an app may contribute.

| Place | Kind | Scope | Today's contributors | Open to apps |
|---|---|---|---|---|
| `page` (route kind → main page) | keyed | app | home, artifacts, conversation (`ws`, `p:`, `t:`), chats (`chats`, `c:`) | later (canvas) |
| `rail.entry` (left rail top, ordered by shape `layout.side`) | list | app | Home, Workspace, Chats, Artifacts, Shells toggle, settings pages | yes (one entry, no counts or dots) |
| `rail.section` | list | app | Projects | no |
| `rail.foot` | list | app | account, theme, settings icon | no |
| `header.title` | keyed by route kind | conversation | projects (icon, name), threads (title, label), chats | no |
| `header.badge` | list | conversation | runtime tag, needs-you | no |
| `header.action` | list, by priority | conversation | Threads control, Resolve, ⋯, Deploy, Map, panel toggle | yes |
| `thread.menu` | list of groups | thread | prev/next, rename, label, delete, open shell, continue elsewhere, Stop | yes |
| `thread.head` | list | thread | checklist, sub-agent strip | no |
| `panel.frame` (stacked frames) | list, shape `xo:panel/*` | conversation | Threads, Changes, Map; Launchpad as a covering frame | yes |
| `panel.page` | keyed (single or per key) | app | Shell, Files, Thread | **yes** |
| `panel.title-action` | list | app | Shell toggle, Full, Close | no |
| `dock.bottom` (re-hostable into a panel page) | single | app | Shells | no |
| `conversation.source` | keyed by view prefix | app | coordinator chats, threads, plain chats | no |
| `conversation.row` | keyed by item `who` | conversation | you, coordinator, agent, turn, card, system, control, limit, hist, event, rec | yes (app cards) |
| `conversation.block` | keyed by storm block type | conversation | thinking, activity, plan, shared_files, narration, text, answer | yes (`app` block) |
| `conversation.tool-words` | chain | app | comms words | yes (an MCP tool describes its own calls) |
| `conversation.typing` | chain | conversation | held, coordinator replying, ask, working | no |
| `message.action` | list | conversation | Copy, Reply, Good, Bad | yes |
| `message.decorator` | list | conversation | tails, quote card, emoji, project marks | no |
| `composer.tool` | list | per composer | attach, intelligence chip, send now | yes (`/` commands, attach pickers) |
| `composer.target` | chain | per composer | chat target, send gate, @project, thread target | no |
| `composer.send-gate` | chain (first refusal wins) | app | connection, routing off, chat ended, files busy | no |
| `composer.above` | stack | per composer | herald notices, docked decision, put-away file chip | no |
| `decision.card` / `decision.detail` | single / keyed by kind | app | decisions card; usage, limit, permission, question, create_project | `decision.evidence` yes (4 Nov) |
| `home.section` | list, shape `xo:home/*` | app | next, then, handled, since, recently made | no (apps reach Home only as evidence in asks) |
| `settings.section` | list (advanced flag) | app | General, Appearance, Keyboard, Shape, Routing, Rules, Worktrees, Runtimes, Paid | yes (declarative form) |
| `files.viewer.kind` | chain | app | text/code, markdown page, HTML preview, image, PDF, attachment | yes (document types) |
| `files.row.menu`, `files.viewer.head.action`, `files.tree.section` | list | place / file | new, rename, delete, copy path; ask, badges | yes / yes / no |
| `editor.extension` | list | file kind | mdlive, ask tooltip, tints | later |
| `search.provider` | list | app | files, text, artifacts, jump items | yes |
| `command` | keyed (`<module>:<id>`) | app | ~40 key actions | yes |
| `shortcut` | keyed, scoped (global, decision, editor, diff, panel) | app | keys.js ACTIONS plus hard-wired `/`, ⌘S, ⌘L, ⌃G | through commands |
| `layer` | stack | app | jump, keys, runs, quickopen, settings, drawer, lightbox, create, files page, decisions panel | apps' dialogs via the host |
| `notice` | service | app | herald, the dock's notify, shape notices | through asks only |
| `world.reducer` | keyed by frame type | app | storm sub-services; files for `file.version` | no |
| `pre-paint` | list | app | theme, bubbles, density (set before first paint) | no |

Place ids match the shape's existing ids, so no stored user data needs a migration. A rename always gets a `MIGRATIONS.shape` step.

### 2.5 A module, concretely (the Shells module)

`modules/shells/module.json`, a static manifest that tools can read without running anything:

```json
{
  "id": "xo.shells", "version": "1.0.0", "kernel": "^1",
  "needs": ["world", "shape", "notices"],
  "provides": ["shells"],
  "contributes": ["panel.page:shell", "dock.bottom", "rail.entry:shells", "thread.menu:open-shell", "shortcut:shells.toggle"],
  "routes": ["GET /terminal/status", "GET /terminal/sessions", "GET /terminal/sessions/{id}", "POST /terminal/sessions", "POST /terminal/sessions/{id}/attach", "PATCH /terminal/sessions/{id}", "DELETE /terminal/sessions/{id}", "WS /terminal/sessions/{id}/ws"],
  "storage": ["session:xo-shells"],
  "styles": ["./shells.css"],
  "vendor": ["xterm@6.0.0"]
}
```

`modules/shells/module.js` (sketch):

```js
/** @param {import('@xo/kernel').ModuleContext} ctx */
export async function activate(ctx) {
  const shells = createShells({ world: ctx.use("world"), shape: ctx.use("shape"), notify: ctx.use("notices").notify });
  ctx.effect(() => shells.destroy());
  ctx.provide("shells", shells.api);
  ctx.contribute("panel.page", { id: "shell", title: () => "Shell", mount: shells.mountPage, onShow: …, onHide: …, canClose: … });
  ctx.contribute("dock.bottom", { mount: shells.mountDock });
  ctx.contribute("rail.entry", { id: "shells", label: "Shells", icon: "terminal", count: shells.running, onPress: shells.toggle });
  ctx.contribute("thread.menu", { group: "open", label: "Open a shell in its worktree", run: (t) => shells.openThread(t) });
  ctx.keys.register({ id: "shells.toggle", keys: "ctrl+`", run: shells.toggle });
}
```

**The `ctx` API (the module SDK v1):**
- `use(service)` and `provide(name, api)`;
- `contribute(place, entry)`;
- `effect`, `on/emit`, `listen`, `interval`, `observe`;
- `keys.register`;
- `store(namespace)`: namespaced storage that declares its own migrations;
- `words` (copy);
- `invalidate(place)`;
- `layers.push`;
- `log`.

**Nothing else is reachable.** The kernel gives each module a scoped `ctx`, unlike dsh where any plugin can read any service.

### 2.6 Rendering contract (keeps the hard-won behaviour)

- **One rendering primitive.** All module rendering goes through `core/ui/redraw` (`redraw`, `reconcile`, `redrawNode`). It keeps the pressed node, which is the 19 Nov "a press still clicks while live data redraws" fix. It also keeps the `_h` HTML caches and `data-own` decorations. **No framework re-creates nodes.**
- **Components** keep one shape: `createX(host, opts) → { update(next), destroy() }`. Leaf widgets may be custom elements (`<xo-select>` already is).
- **Focus is never on BODY.**
  - Every module declares its focus return: the opener, then its fallback hook.
  - `layers` gives back focus on close.
  - Focus tests are behaviour tests on the module, not regexes on its source.
- **Conversation scroll** stays owned by `follow.js`. Other modules call `conversation.unpin/toRow`; they never set `scrollTop` and never focus inside the scroller without `{preventScroll: true}`. The banned list stands: no column-reverse, no windowing, no `content-visibility`, no transforms on the list.

### 2.7 CSS architecture

- **Explicit cascade layers** replace load order:

  ```css
  @layer reset, tokens, foundation, components, shell, modules, apps, theme, density, phone;
  ```

  Sheets are layered one module at a time, and only where a static check finds no winner that changes. Third-party CSS injected without a layer (CodeMirror's theme) beats any layered rule. So our styling of a vendor component goes through that vendor's own theme API (CodeMirror: `EditorView.theme`), never through global overrides of its classes. That is the files module's job when the editor moves.

  Every sheet declares its layer, so moving a rule never changes who wins. `!important` goes from 58 to 0, one module at a time, with a ratchet.
- **Each module ships its own sheet**, loaded by the kernel before the module's first paint. Core and shell sheets stay static in `index.html`.
- **Selectors are scoped to the module** (`[data-m="files"] …` or a prefix). A lint test rejects a module styling another module's classes, and rejects ID selectors outside the shell.
- **Tokens only.** Modules never define colours, sizes, radii or curves: the design budget, extended. The four colour sets outside `tokens.css` move in: `--sb-*`, `--code-*`, `--viz-*` and the light-theme hex. 14 unused tokens are deleted consciously.
- **Pre-paint.** One boot snippet sets `data-theme`, `data-msgx` and `data-density` from storage before first paint. It is fed by the `pre-paint` place, so the logic stops being duplicated in index.html and app.js.
- **JS→CSS custom properties** (`--dock-h`, `--sw`, `--pw`, …) are listed in each module's README as part of its API.

### 2.8 Data: services and the backend contract

- **`storm.js` splits into five:**
  - `client` (routes);
  - `stream` (boot hold/apply, reset protocol);
  - `reducers/<frame-type>` (contributed to `world.reducer`);
  - `selectors` (busy, held, coordinatorOf, uiThread);
  - `commands` (writes with optimistic rollback).

  The 20 subtle rules in `analysis/4 §2.4` are written as tests **before** the split: boot ordering, sent-at stamping, queued vs held vs busy, paging once per page, `findRows`, monotonic hops, the 60 s pruning, decision refusal semantics, and the rest.
- **One `http` and one `sse`** in `core/platform`: one error parser instead of three. lpapi's second SSE parser goes.
- **Every module declares its routes in `module.json`.** A contract test checks each one against xo-space's OpenAPI: a missing route fails the test, not the owner. The full table of ~100 routes with their call sites is in `analysis/4 §3.1`.
- **Stored keys are declared too.** Each module lists its storage keys in its manifest. The ledger already has every key found (`cv-theme`, `cv-bubbles`, `cv-drafts:live`, `xo-draft:*`, `xo-stage*`, `xo-shells`, …). A key never changes name without a migration step.

---

## 3. Apps: plug and play

### 3.1 Two kinds of extension, one set of places

| | **Module** (first-party) | **App** (first- or third-party) |
|---|---|---|
| Runs | in the page, in-process | views in sandboxed frames; server as a process run by xo-space |
| Written in | our repo, our rules | its own repo, any stack that speaks MCP |
| Trusted | yes (reviewed with the code) | no: only what the owner granted, per project |
| Manifest | `module.json` | `plugin.json` + `extensions["space.xo"]` (the 4 Nov contract) |
| Plugs into | any place | the places marked "open to apps" in §2.4 |
| Talks to xo-space | `core/services` | MCP tools via xo-space; views via the bridge → `POST /api/apps/{id}/call` |

**Native feel comes from the places, not from trust.** The apps-host turns an app's manifest into ordinary contributions: a panel tab (`panel.page`), a header button, a `/command`, a document type (`files.viewer.kind`), an inline card (`conversation.block: app`), evidence in an ask, and a settings form. XO draws the frame, title, loading, errors, theme and focus ring around each one. The app draws only its content.

### 3.2 The app manifest

This is the 4 Nov contract (`apps/contract.md` §1), unchanged in shape. Its key fields:
- `id` (reverse-DNS), version, and `engines.xo` (the kernel API range);
- `permissions` (required and optional, each with a "why");
- `surfaces` (canvas, panel, inline, evidence, commands, attach, settings);
- `tools`, each with a risk tier;
- `limits`, `attention: "silent"` and `data.onRemove`.

The apps-host compiles `surfaces` into place contributions. A surface naming a place that isn't open to apps is a manifest error that `xo app check` reports.

### 3.3 Lifecycle

| Step | What happens | Who decides |
|---|---|---|
| **Install** | xo-space fetches a signed package, or a local folder in dev mode. It verifies the signature and `engines.xo`, and shows one sheet: what it touches, in plain words. **No install scripts ever run.** | the owner |
| **Enable** (per project, or by a preset) | Grants are stored in xo-space. The apps-host contributes its surfaces. Its server starts when first needed. | the owner, or a preset the owner chose |
| **Disable** | Surfaces are removed (the kernel's undo), the server stops, grants are kept. | the owner |
| **Update** | Applied between turns, never mid-turn. An update that asks for more permissions **pauses** until the owner agrees. If loading fails, the previous version keeps running. | the owner (for new permissions) |
| **Remove** | Everything is undone. The app's files stay in the project (`data.onRemove`). | the owner |
| **Safe mode** | One switch starts XO with core modules only and no apps, for recovery. | the owner |
| **Kill switch** | A version pulled from the registry stops everywhere. | XO |

### 3.4 Permissions and trust

- **Views.** They run in `<iframe sandbox="allow-scripts">` with no same-origin, no network, and a CSP. Before third-party apps arrive, views move to a **separate origin**, so a busy app can't freeze XO's tab (the 4 Nov risk, still to be tested).
- **Servers.** They run as separate processes started by xo-space, with a scrubbed environment and an OS sandbox (bubblewrap, the same work as the dsh research's item (`architecture/dsh-research.md`) 4). Network goes only to the hosts that were granted, through an egress check. Secrets are given to the server by name and never reach a view.
- **One checkpoint.** Every app call from a view or a tool passes xo-space's review and rules, exactly like an agent action. `serve.py` keeps refusing frames (`Origin: null`), so a view can never reach `/api` directly.
- **What we don't copy.** This is the line dsh never drew: their plugins run with full access, which their own docs admit (`architecture/apps-and-quality.md` §1).

### 3.5 How apps talk to xo-space and storm (MCP-native)

- **Agents.** In projects where an app is enabled, agents get its tools through `SessionSpec.mcp_servers`, from xo-space's `/mcp/apps/{id}` proxy, which issues a token per session.
- **Views.** They call the same tools through the MCP Apps bridge (postMessage). The apps-host forwards the call to `POST /api/apps/{id}/call`, stamped as the person.
- **Host API** (`xo_host`):
  - files under granted paths;
  - threads, artifacts, and opening an ask;
  - drafting into the composer (only the person sends).

  Nothing else.
- **Results come back** as a presented `app` block in the stream (`storm/stream/presenter.py`), which `conversation.block: app` renders as an inline card.
- **Apps use xo-space's local routes, the same ones xo-coworker uses.** This is the owner's call (19 Nov 19:10Z): no oneshot completion is exposed.
  - An app that needs a model (a Word-like editor asking for a rewrite, for example) does what coworker does: it starts or uses a chat or thread and sends a message through the local routes. The work runs on the owner's runtimes and accounts, under the same pools, review and rules.
  - **How an app reaches the routes.** The app's server, or its view through the bridge, calls them via the apps-host's route proxy. It works like serve.py's proxy and quirq's `_PROXY_ALLOW`:
    - a call is allowed only if the manifest declares the route under `routes` and the owner granted it for that project;
    - every call is stamped as the app;
    - routes that expose secret values or raw files are never forwarded, the same refusals serve.py makes today.
  - **No new inference API.** The route contract (§2.8) is the app API, which is why it is versioned and checked against xo-space's OpenAPI.

### 3.6 Versioning and API stability

- **The kernel API and the places are versioned together (semver).**
  - Adding a place, or an optional field on one, is a minor version.
  - Removing or changing one is a major version, and needs **one minor release of deprecation**: the kernel logs who still uses it, and a test lists them.
- **Experimental places** carry a `preview:` prefix. Apps can't use them unless they opt in, and they may change without a major version.
- `module.json` and the app manifest both declare `kernel` / `engines.xo` ranges. The kernel refuses to load what doesn't match and names the reason.
- **Generated catalogue.** `architecture/places.md` is generated from the kernel's definitions (dsh's slot catalog idea), with a staleness check in the test command.
- **Contract 1.0 freezes after two apps ship** on it. Until then the app contract is 0.x.

### 3.7 What an app author gets

- `xo app new <name>` writes a working app: manifest, one MCP tool, one panel view, one test.
- `xo app dev` loads the folder into a local Space and reloads on save.
- `xo app check` validates the manifest against the generated places catalogue and explains every problem in plain words.
- A test kit fakes the host and replays recorded sessions.
- A tutorial builds the "Revenue" example end to end (`architecture/apps-and-quality.md` §2).

dsh has no scaffolding command at all. This is where XO can be the easier platform, without being the less safe one.

---

## 4. What we take from dsh, and what we don't

| Take | How it lands here |
|---|---|
| Everything is a contribution, with an undo | the kernel's effects; a leak test per module (§5) |
| A typed slot catalogue with kinds and scopes | §2.4, generated into `architecture/places.md` |
| Composer takeover as a priority chain | `composer.target`, `composer.above`, `conversation.typing` |
| Start when what you need exists | `needs` in `module.json`; surfaces of a broken app show XO's error frame |
| Profiles as ordered lists | `modules/index.json` plus the shape's presets |
| A version check before loading | `kernel` / `engines.xo` ranges with named refusals |
| Safe mode and a never-off core | §3.3; `core/*`, `shell` and the decisions module can't be disabled |
| A README skeleton per package | per module: Purpose, Places contributed, Services, Routes, Storage keys, Events, JS→CSS properties, Risks |
| Dated decision notes | `architecture/decisions/YYYY-MM-DD-slug.md` |
| Recorded sessions instead of live model calls | e2e on seeded history plus replayed streams |
| Text snapshots of the accessibility tree instead of screenshots | the fast UI lane (`architecture/dsh-research.md` item 3) |
| One gate runner, fast local hooks | `node tools/check.mjs` (§5) |

| Don't take | Why |
|---|---|
| Plugins with full access, in-process | apps get sandboxes and grants (§3.4) |
| Installing from npm or git at runtime; install scripts | signed packages only; no scripts |
| Config that runs code (`!!js`) | manifests are pure JSON |
| A crash in one plugin exits the host | apps run out of process; modules get an error boundary per place entry |
| A giant shared context (196 files merge into `ctx`) | a scoped `ctx` with a small, versioned SDK |
| Override-by-id that replaces the whole config | the shape merges by field |
| React and a TS build | our behaviours live in `redraw`; no runtime build (§5, decision D1) |
| 389 gate scripts, 100% coverage, bilingual docs | for a public monorepo of 391 packages, not two repos and one owner |

---

## 5. Engineering hygiene (so it stays production-grade)

1. **Build or no build: no runtime build, dev-only tools (decision D1).**
   - The app still runs from plain files with no bundler and no CDN.
   - A `package.json` with **devDependencies only** (`typescript` for checking JSDoc, `oxlint`) and a lockfile.
   - Nobody needs it to run the app, and it is never shipped.
   - This is the one change to the README's "no npm" line, so it is the owner's call.
2. **Types.**
   - `// @ts-check` plus JSDoc on every new and moved file.
   - `jsconfig.json` with `strict` and `checkJs`; `tsc --noEmit` in the check.
   - `core/kernel/types.d.ts` is the SDK's contract, and later the app authors' typings.
3. **Lint.** oxlint with named rules, each with a one-line reason:
   - `no-unused-vars` and `no-undef`;
   - `no-floating-promises` once types land;
   - import boundaries (§2.1);
   - no ID selectors and no cross-module selectors in module CSS.
4. **One check command: `node tools/check.mjs`.** It runs in this order and fails on the first failure, by exit code:
   1. lint;
   2. types;
   3. every `**/tests/*.test.mjs`;
   4. design budget;
   5. import boundaries;
   6. the places catalogue's staleness check;
   7. the route contract against xo-space's OpenAPI;
   8. file-size ratchet: no file over 600 lines may grow, and no new file may pass 400 (modules are small by design);
   9. `!important` ratchet;
   10. `check_ledger.py`.

   A `.githooks/pre-commit` runs the fast half. The fast UI lane runs on request (the owner's rule: no browser runs unless asked).
5. **Module conformance tests**, generated per module:
   - activate, then deactivate, leaves zero contributions, listeners, timers and observers (the leak test);
   - every contributed place exists;
   - every declared route exists;
   - every storage key is declared.
6. **Rewrite the 114 source-reading tests as behaviour tests** when their module moves. Each test is listed in the ledger with its new home; none is deleted without a written reason.
7. **`AGENTS.md` (short; `CLAUDE.md` imports it).** It holds the layer rule, the rendering contract, the CSS rules and the owner's standing rules:
   - no push;
   - no leftovers on `:3000`;
   - `follow.js` owns scroll;
   - system-wide tokens;
   - no browser runs unless asked;
   - quote hashes from git output only.

   Each rule links to `architecture/decisions/…`.
8. **A README per module**, with a fixed skeleton (§4), checked by the check command.
9. **Research leaves the product repo.** The 231 tracked mockup and research files go to a design archive (decision D4). The 4 files tests need move into `e2e/fixtures`, and the second `mockspace.cjs` copy goes.

---

## 6. Migration path

**Rules for every phase:**
- The app works at every commit, verified by the check command plus the owner-approved screenshot set.
- **Move commits change no behaviour.** Bug fixes and deletions are separate commits, each approved.
- **One module at a time:**
  - a module being moved is frozen for feature work, which keeps the window short;
  - old paths re-export new ones (shims) for one phase, then the shims are deleted;
  - **characterisation tests come first**: behaviour tests written against today's code before it moves, so the move is checked by something other than eyes;
  - the ledger is updated in the same commit as the move.
- **Extract, then wire.** Legacy files may only shrink (the size ratchet refuses growth, which already stopped one attempt to wire the kernel into `stage.js` in place). So a piece moves out to its new home first, and only then do the old call sites connect to it. Who does what: `architecture/WAVES.md`.

### Post-P4 fix phase in the current release sequence

This updates the 23 November integration plan (`git show 539ddcd8:architecture/2026-11-23-modular-phases.md`), which numbers P4 as keyboard and shim work and P5 as shipment. In that sequence the order is **P4 → fix phase → independent quality audit → P5**. Finish the move-only work first so fixes are developed and reviewed through the final module boundaries. Audit after the fixes so the review includes their code and tests.

- **Entry gate.** P4 has passed its full check and independent review, the final ledger reports zero open items, and the P4 tag is available for rollback. Use the consolidated [handoff findings](HANDOFF.md#findings-for-the-post-p4-fix-phase) to scope work on the modular branch.
- **Scope.** Reproduce the recorded bugs and accessibility findings and confirm the impact of the performance findings. Give each fix a named commit with the root cause and a regression through the public API or DOM that fails before the fix. For performance fixes, record comparable measurements before and after. Review each change for readable code, module boundaries and token use. Bring any visual or behavior decision beyond the reported repair to the coordinator.
- **Exit gate.** Each finding has a verified repair or a disposition agreed with the coordinator. The clean-export full check and final ledger pass, and an independent reviewer checks the fixes. Then audit the whole codebase before P5. Revert an individual fix or return to the P4 tag if the phase cannot pass.
- **P5.** Bring release changes forward and check parity against current release, accounting for the recorded fixes. Deployment still requires the owner's approval.
- **Blazing-fast UI after P5.** Package E owns serve-time stylesheet bundling and mask asset caching. The [P3 measurements](HANDOFF.md#p3-exit-evidence) supply the baseline. Through P5, keep stylesheet link and import order explicit and verify the declared cascade and versioned asset resolution whenever a path moves.

### Original architecture milestones

| Phase | Scope | Exit criteria | Size | Main risks |
|---|---|---|---|---|
| **P0 Safety net** | AGENTS.md, `tools/check.mjs` (first lint, the tests, design budget), pre-commit hook, ratchets, route-contract test, ledger checker. Fast UI lane seeded: seeded store, settle barrier, text snapshots. | the check is green on today's code; all 174 tests run by one command | 3–4 days | none user-visible |
| **P1 Kernel** | `core/kernel` (places, modules, effects, bus, scheduler, layers), SDK types, places catalogue generator, conformance and leak tests. `stage.page()` becomes an adapter over `panel.page`, and `SURFACES` over `shape.surface`. | kernel at 100% unit coverage; the three panel pages register through it; no visible change | 1 week | adapter semantics: page key bug, tabs survive close |
| **P2 Core extraction** | `core/platform` (http, sse, keys, gestures, time, util…), `core/ui` (tokens, foundation, components, icons, markdown, lightbox, redraw, motion, a11y), `core/services` (storm in five, world, shape, places, paths, notices, runtimes, account, review, github). Duplicates merged. `@layer` on tokens and the base reset (no winner changes); every other sheet gets its layer when its module moves, all by P6. | app.js imports only `core/*` and features; storm's 20 rules covered by tests; duplicates gone | 1.5–2 weeks | storm boot and order rules; cascade order |
| **P3 Shell** | `shell/`: frame, rail (with `rail.entry`, so the left top scales), header, panel host (from stage.js), page host, dock host, the layer stack, phone. The `index.html` markup moves to the shell and its modules. | one layer stack drives Esc, Back, inert, Tab and gestures; index.html holds only the visible frame drawn at first paint (sidebar, main), and everything hidden is drawn by its owner; first paint unchanged | 1.5–2 weeks | focus returns, Esc order, inert cover, width rules (analysis/2 §2.4) |
| **P4 Proof modules** | **Shells** first: ~1,037 lines, already self-contained; exercises `panel.page`, `dock.bottom`, `rail.entry`, `thread.menu` and `shortcut`. Then **Launchpad**: its own API client, `panel.frame` cover, `header.action`, notices, and secrets that must never persist. | both pass the conformance tests; disable and re-enable at runtime leaves no trace | Shells 3–4 days; Launchpad 1 week | dock re-hosting into the panel; Launchpad's stale-answer tickets and secrets |
| **P5 Every other module** | in order of risk: search and create-project → settings group (settings, runtimes, routing, rules, worktrees, shape page) → map → home, since, artifacts, projects → changes → files (viewer stays one element for the app's life) → threads, chats, intelligence → **conversation + composer + decisions** last, highest risk | each module green; `app.js` ≤ 300 lines; `app.css` empty | 6–7 weeks of work (3–4 calendar weeks with parallel threads) | scroll anchoring, drawConv's step order, same-task decoration, composer defaults, editor state and drafts, merge semantics |
| **P6 Finish** | delete the shims, `app.js` → `boot.js`, remove `app.css`, README regenerated, research moved out, `check_ledger.py --final` green | **the ledger has no planned or decide entries left** | 3–4 days | — |
| **P7 Apps host v0** | **Frontend:** apps-host (frame, bridge, manifest → contributions, Settings › Apps). **xo-space:** §7. Proof: a sample app from `xo app new`, then the Design spike. | a sample app installs, plugs into `panel.page` and `/command`, gets granted tools, and removes cleanly | frontend 2 weeks; xo-space 3–4 weeks in parallel | the bridge and grant checks are the security boundary |

**Why Shells is the first proof:**
- It is small and already has its own controller.
- It touches five kinds of place.
- It owns a vendor library.
- Nothing else depends on it.

If the kernel works for Shells, it works. Launchpad second proves the harder parts: a module with its own backend client, live state and secrets. I don't recommend porting the file viewer as the first *sandboxed* app, as the 4 Nov plan suggested. It is a singleton with deep editor state (`analysis/5 §3.4`), so it should stay a first-party module.

---

## 7. What xo-space needs

| # | Need | Why | Size |
|---|---|---|---|
| 1 | **Serve the OpenAPI document locally** (it is hidden for some routes) and keep it complete | the route-contract test | S |
| 2 | **Prune or document the 9 routes nothing calls** (`chat`, `memory`, `memoryFile`, `patchSession`, `active`, `addRule`, the three `/schedules`), and fold the `/coworker/` odd prefix into the scheme | one clear contract | S |
| 3 | **A stream frame catalogue**: the ~30 global frame types and 10 deploy events, with a version | `world.reducer` registrations are checked against it | S |
| 4 | **Shape store:** room for module enablement and layout per person (it already stores the shape document with `if_version`) and server-side migrations of shape ids | presets drive which modules and apps are on | S–M |
| 5 | **A capabilities endpoint** (what this Space supports) | `needs` in the shape and in modules resolve against it, instead of probing for a 404 | S |
| 6 | **Apps contract §12 (4 Nov):** app store and grants (`/api/apps`, `app_grants`), supervisor, `/mcp/apps/{id}`, `POST /api/apps/{id}/call`, `xo_host`, the `app` block type, signature checks | phase 7 | L (3–4 weeks) |
| 7 | **An OS sandbox and egress control for app servers** (bubblewrap plus a cgroup per process; the same work as the dsh research's item (`architecture/dsh-research.md`) 4) | trust for third-party apps | M–L |
| 8 | **Thread delete is already in** (`storm/chats/deletion.py`, 19 Nov 14:39): soft, undoable, branch kept. The `thread.menu` place carries it. | — | done |

---

## 8. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Allow a dev-only `package.json` (TypeScript checking for JSDoc, oxlint), never needed to run the app | **Yes.** Without it there are no types and no lint. |
| D2 | Keep vanilla ES modules + `redraw` (no React, no runtime build) | **Yes.** The hard-won behaviours live there. |
| D3 | Freeze feature work on a module while it moves (days, not weeks) | **Yes**, one module at a time. |
| D4 | Move `ui-mockups/` (108 files) and tracked `design-research/` (123 files) out of the product repo to a design archive | **Yes.** Nothing depends on them except 4 test fixtures, which move into `e2e/`. |
| D5 | Keep shape ids as they are (`xo:panel/agents`, …) even where the names are old | **Yes.** They are stored user data; renames need migrations. |
| D6 | Dead code (list in §9): port, fix or delete each | **Delete**, each in its own approved commit. |
| D7 | Likely bugs found by reading (list in §9): fix before or during the move | **Fix in their phase**, in separate commits with a test each. |
| D8 | The first sandboxed app: a sample app, then the Design spike, not the file viewer | **Yes.** |

---

## 9. Found while reading: dead code and likely bugs

None of these was confirmed by running, because no browser was used. Each one gets a test before anything changes.

### Likely bugs

1. **The Thread page's ⋯ menu never opens.** Nothing sets `TP.menu` to true (app.js).
2. **⌘B in the Markdown page** probably both bolds the text and folds the file tree. mdlive binds Mod-b, and app.js's global handler runs `treeFold` with no `defaultPrevented` check.
3. **Esc in a terminal inside the panel** (Shell mode) probably closes the panel. The capture-phase Esc handler spares only `input` elements, and xterm types into a textarea.
4. **Thread page mounts leak.** msgx listeners, an interval, style elements and observers, plus the dock's and `tpMount`'s, are never torn down.
5. **The two conversations share typing timers** (`S.heldT`/`S.askT`).
6. **The Thread page's intelligence chip** probably re-opens the popover: `#tiq` is not excluded from intel's outside-click close.
7. **On single pages, `pages()` gets the page name instead of the key**, so the Thread page's title reads "Thread".
8. **The second composer reads the main composer's text by default** (`liveBlock`, `composerDest`).
9. **Ended-turn ordering and height-hold rules** apply only when Chat bubbles is on (`:root[data-msgx]`). Is that intended in the document look?
10. **Comments in three files still say files "save themselves"**, against the 19 Nov ⌘S-only decision. Fix the comments; don't reintroduce autosave.
11. **favicon.svg** is a hand-made copy that differs from the icon pack's favicon.

### Dead or unreachable code

- **The All threads sheet:** about 200 lines plus swipe-to-resolve. Nothing renders `data-switch`, `data-next` or `data-all-threads`.
- **diffview.js:** `file`/`conflict`/`exitKeys`/`ready`/`loaded`/`FIND_CSS` (~230 of its 421 lines), plus vendor `pierre-diffs/edit.js` (173 KB, with a local patch) behind it.
- **The lucide vendor folder** (no importer).
- **About 150 lines of map.js** standalone mode.
- **`content.js` `suggestFor` always returns null**, so decide.js's suggestion path never runs.
- **Small unused helpers:** `createAnnouncer`, util time helpers, `mmss`/`waited`, and unused exports in files, docs, viewer and doceditor.
- **CSS:** two invalid `:root{(…)}` rules at app.css 2221–2228, and 14 tokens nothing uses.
- **9 backend routes** defined in api.js and never called.
- **tools/diffview:** most of it is one-off probes with machine paths.

---

## 10. Behaviours that must survive the move (the short list)

The full lists, with line numbers, are in `analysis/1 §3.4`, `2 §2.4`, `3 §2.4`, `4 §2.4`, `5 §3.4` and `6` (Domain summary). Each becomes a characterisation test before its module moves.

1. **A press still clicks while live data redraws.** In-place `redraw`/`reconcile` keep the pressed node.
2. **Focus is never on BODY.** This covers every handoff: dockSwap, focusNext, heraldBack, the closeRuns chain, settings, dialogs, the panel's close return, launchpad `land()`, map `focusNode`, Artifacts focus-follows-card.
3. **Scroll anchoring.**
   - Only follow.js writes scroll.
   - drawConv runs its steps in order.
   - Decoration runs in the same task.
   - Width changes are never read as the user scrolling.
   - "Open at latest, filling doesn't move you."
4. **Message ordering.** Seq first, then time, with a stable merge, echo aliasing and stable turn keys.
5. **Storm's rules.** Boot hold/apply, sent-at stamping, queued vs held vs busy, `coordinatorOf` before busy, awaiting/failed, the reset protocol, paging, `findRows`, monotonic hops, pruning.
6. **Undo windows are real time** (the commit window, hold under reduced motion, the read guard), and **receipts are honest**.
7. **IME guards** (`isComposing || keyCode===229`) in every key handler.
8. **The global key rule** (⌘ keys work while typing, plain keys don't); Escape order; phone Back order.
9. **The send gate is asked with the message's own destination.**
10. **Pre-paint flags.** theme, bubbles and density are set before first paint, and skeleton runs before boot.
11. **Panel behaviour.**
    - Tabs survive closing the panel, and a `canClose` that throws counts as a refusal.
    - The inert cover is computed whole.
    - The Launchpad cover uses no `inert`.
    - Layout reads are avoided.
    - The width rules hold.
    - Threads are sized in whole rows.
    - The dock moves into the panel without disposing xterm.
12. **Files.**
    - One viewer element for the app's life.
    - Editor state survives tab switches.
    - Drafts hot-exit.
    - No autosave.
    - Runs-code confirmation.
    - Two signals for outside changes.
    - Merge and conflict semantics.
    - The versions window.
    - Preview tabs.
    - The tree doesn't snap.
13. **Launchpad secrets never persist or log,** and stale answers never overwrite newer ones.
14. **The shape sync machine** (held changes, one-key 409 rebase, echo suppression, never writing on load), and shape ids as stored data.
15. **Every storage key keeps its name or gets a migration.** The ledger lists them all.

---

## Sources and files

- Code: `release/2026-11-19` at `6c73139` (exported read-only with `git archive`).
- `architecture/modular/analysis/1-app-index.md`: app.js region map, index.html elements, places, hub API, risks.
- `architecture/modular/analysis/2-shell-chrome.md`: stage, dock, ui kit, keys, shape, settings, places, risks.
- `architecture/modular/analysis/3-conversation.md`: conversation instance API, msgx/follow/turnview, composer, decisions, places, risks.
- `architecture/modular/analysis/4-data-features.md`: storm, api, sse, map, launchpad, create, record; the full route and stream tables.
- `architecture/modular/analysis/5-files-changes.md`: files, viewer, docs, editor, changes, diffview; vendor and workers.
- `architecture/modular/analysis/6-css-tests-tools.md`: all CSS (app.css region map), all tests, tools, assets, root files.
- `architecture/modular/{INVENTORY,LEDGER}.md`; `tools/ledger/{inventory.json,ledger.json,inventory.py,fill_ledger.py,check_ledger.py,ledger_md.py}`.
- xo-space (read only): `/opt/xo-space` (`routers/cowork_agent/storm/shape.py`, `storm/chats/deletion.py`).
- Related: the 4 Nov apps proposal (`design-research/2026-11-vision/apps/{README,contract}.md`, local), `architecture/apps-and-quality.md`, `architecture/dsh-research.md`.
