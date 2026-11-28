# Architecture

How xo-coworker is organised, and how to write code here that stays easy to read and change.

## The shape

The app is plain HTML, CSS and ES modules with no framework. A small kernel holds feature modules together; each module plugs into named slots in the UI (places), shares APIs (services) and hears events (the bus). Modules never import each other.

`index.html` loads `boot.js`, which loads the frame and then `js/app.js`. `app.js` only imports the feature modules and hands them, in one static list, to `bootShell()` (`shell/boot.js`), which builds the kernel and starts it.

## Folders and layers

Lowest layer first. A file imports only from its own folder and lower layers; `node tools/check.mjs` enforces this.

| Folder | What lives there |
|---|---|
| `core/kernel/` | Module registry, activation in `needs` order, places, the bus, scopes, stores, the layer stack. Knows no feature and imports nothing. Contract: `core/kernel/types.d.ts`. |
| `core/platform/` | Browser plumbing: requests and typed response readers (`*-response.js`), streams, storage, caches, keys, time, small helpers. |
| `core/ui/` | What every view draws with: tokens (`tokens.css`), icons, markdown, motion, `redraw`, shared components such as `createDialog()`. |
| `core/services/` | Shared data: the world store, Storm (the server stream), Shape (per-person UI), paths, notices, media. |
| `shell/` | The frame: boot, the rail, the right panel, the phone layout, the one layer stack for Esc/Back/focus, and the place definitions (`shell/places.js`). |
| `modules/<name>/` | One feature per folder (Files, Map, Home, Settings…), with its code, styles and tests together. |
| `apps-host/` | Installed apps: manifests, sandboxed frames, the tool bridge. |

Outside the app: `tests/` (unit tests not yet moved beside their code), `e2e/` and `tests/browser/` (browser suites), `tools/` (checks, baselines, the release build), `vendor/`, `fonts/`. `css/` holds styles that haven't moved to their module yet and only shrinks.

## How the pieces talk

- **Module.** `modules/<name>/module.js` exports a manifest (`id`, `version`, `kernel` range, `needs`, `optional`, `provides`, `contributes`) and `activate(ctx)`. The kernel activates modules in dependency order, each behind its own error boundary, and undoes everything a module registered when it is disabled or fails. `modules/since/module.js` is a short example.
- **Places** are named slots: `single`, `list` (by `order`), `keyed` (one entry per id) or `chain` (by `priority`; the first that applies wins). A module fills one with `ctx.contribute(place, entry)`. `shell/places.js` defines every place with a one-line description; the kernel's `PlaceEntries` types each entry.
- **Services** are APIs one module provides (`ctx.provide`) and others use (`ctx.use`, or `ctx.optional`). Each is typed in the kernel's `Services` interface from a `*-types.d.ts` beside it.
- **The bus** carries synchronous topics (`ctx.on`, `emit`); `app:*` topics are declared in the kernel's `Topics`.

The kernel throws on a `use`, `provide` or `contribute` the manifest doesn't declare, so a manifest is an honest list of what a module touches.

## Where state lives

| State | Home |
|---|---|
| Server data: chats, threads, messages, sessions, review items | The world store (`core/services/world/`), fed by Storm. Views subscribe; writes go through `world.act`. |
| The UI's shape per person | `core/services/shape/`: defaults < preset < theirs < this device. |
| Navigation and small view state | Immutable stores from `core/kernel/store.js`. |
| A module's own state | The module's closure. Others reach it only through a service it provides. |
| Browser storage | Only `core/platform/storage.js`. A renamed key gets a migration. |
| Caches and shared reads | `createLru()`, `once()`, `latest()` in `core/platform/`. |

The DOM holds no state: views draw from state with `core/ui/redraw.js`, which updates nodes in place.

## Lifetimes and failures

- A scope (`createScope()`, or a module's `ctx`) owns every listener, timer, observer, effect and request it starts. Disposing it undoes them newest first and aborts its `signal`; pass that signal to every request so a late answer is dropped, not painted.
- The kernel catches a throw from activation, a listener, a place callback or a cleanup and shows it on the failure line. Any other unexpected failure goes to `reportFailure` (`core/platform/util.js`) or is rethrown.
- Overlays register a layer during activation; the shell applies Esc, Back, inert and Tab to live layers in one place (`shell/layers.js`). Dialogs are `createDialog()`. Focus never falls to the page body when something closes or redraws.

## Styles

All visual values come from `core/ui/tokens.css`: one type scale, one spacing and size scale, role colours. A change to how something looks is a change to a token or a shared rule, so it lands app-wide. Styles live beside their module in a declared `@layer`; the layer order is in `core/ui/foundation.css`. Sizes come from content, not fixed positions.

## Writing maintainable, readable code

- **Fix the cause, once, where it lives.** Find why it's wrong before changing anything. A fix in the shared rule beats the same patch in three places, and a patch on top of a patch is a bug for later.
- **Small, named pieces.** A function does one thing and its name says what. A file covers one idea. When a function needs a comment to explain its steps, split it.
- **Say it once.** One home for each fact: a token, a reader, a service. Reuse before you add. Before writing a helper, search for the one that already exists.
- **Plain over clever.** Straight-line code with early returns, no indirection without a second caller, no options nobody passes.
- **Types are the documentation.** `// @ts-check` with JSDoc, no `any`. Data from the server passes through a typed reader before anything else sees it.
- **Ownership is explicit.** Whatever you start, a scope owns. Whatever a module touches, its manifest declares.
- **Delete what's dead.** Unused code, tokens, styles and flags go in the same change that made them unused.
- **Comments are rare.** One line, saying why, never what. No references to plans, tickets or docs.
- **Test behaviour, not text.** Tests go through the public entry point and fake time and the backend. A bug fix comes with a test that fails without it.
- **Small commits.** One purpose each, titled by what changed.
