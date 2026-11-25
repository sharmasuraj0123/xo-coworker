# Developing xo-coworker

How the code fits together, how to add to it, and how to check and land a change. The rules are in [AGENTS.md](AGENTS.md); the overview is in [README.md](README.md).

## Setup

```sh
npm ci                  # once, and whenever package.json changes: build, lint, types, linkedom
python3 serve.py        # the app on http://127.0.0.1:5180
```

Development runs straight from the source. If a `dist/` is left from a build, `serve.py` serves that release instead: delete `dist/` or set `XO_SERVE_RAW=1`. In source mode, restart `serve.py` after editing assets so their fingerprint is taken again.

`npm run build` (`tools/build-ui.mjs`) bundles the entry points with esbuild, inlines every stylesheet in cascade order into one `css/app.css`, writes the release to `dist/<digest>/` and then points `dist/current` at it. Production runs this build when its Docker image is built. The full check builds a release in a temporary folder and checks its asset graph and both serving modes over HTTP (`tools/build/check.mjs`).

For an in-place rollout, build into the existing `dist/` and restart the server. It prints its mode and digest. Source assets revalidate on request. Each production build retains the last two distinct releases for open tabs and keeps their diagnostic source maps private. If a replacement image drops a tab’s release, the existing notice line offers **Reload**.

The pre-commit hook (`.githooks/pre-commit`) is enabled through the shared git config; never run `git config` for it.

## Structure

Layers, lowest first: `core/kernel` → `core/platform` → `core/ui` → `core/services` → `shell` → `modules/*` → `apps-host`. A file imports only its own folder and lower layers, and a module never imports another module. `node tools/check.mjs` enforces both, including JSDoc `@import`s.

- **Kernel** (`core/kernel/`): `createKernel()` registers modules, activates them in `needs` order behind an error boundary per module, and undoes everything a module registered when it is disabled or fails. Its contract is `core/kernel/types.d.ts`.
- **Boot** is a static module graph. `boot.js` loads the frame and `js/app.js`; if either fails, it replaces the page with a "couldn't start" alert. `js/app.js` only imports modules and calls `bootShell([...])` (`shell/boot.js`) once with them. The conformance gate rejects any other statement there.
- **The app's kernel** is `shell/kernel.js`, with the places of `shell/places.js` defined before anything contributes. `bootShell` registers the modules, starts the kernel and emits `app:started`.
- **Places** are named slots in the UI: `single`, `list` (ordered by `order`), `keyed` (one entry per id) and `chain` (by `priority`; the first that applies wins). An entry may have `when(at)` to show only for some views. A place's entry type is declared in the kernel's `PlaceEntries` interface, or per key in `KeyedPlaceEntries` (`"panel.frame:map"`), so `ctx.contribute` and `ctx.places.get` are type-checked. [architecture/places.md](architecture/places.md) is the catalogue.
- **Services** are named APIs one module provides and others use. The world and the shell's basics (`world`, `announce`, `projectName`, `currentView`, `placeContext`, `navigationState`) come from the `xo.app-services` module in `shell/world.js`.
- **The bus** carries synchronous topics. `app:*` topics must be declared in the kernel's `Topics` interface.

## Adding a feature

1. Make `modules/<name>/` with a `module.js` that exports a `ModuleDef`: a manifest (`id: "xo.<name>"`, `version`, `kernel: "^1.1.0"`, `needs`, `optional`, `provides`, `contributes`) and `activate(ctx)`. `modules/since/module.js` is a short example.
2. In `activate`, get what you need with `ctx.use(service)` (or `ctx.optional(service)` for one that may be absent), fill places with `ctx.contribute(place, entry)`, share an API with `ctx.provide(name, api)`, and listen with `ctx.on`. The kernel throws on a `use`, `provide` or `contribute` the manifest does not declare.
3. Type a provided service by adding it to the kernel's `Services` interface from a `*-types.d.ts` beside it (`modules/changes/data-types.d.ts`). Declare a new `app:*` topic in `Topics`, and a place's entry type in `PlaceEntries` or `KeyedPlaceEntries`, the same way.
4. Need a new slot? Add it to `SPECS` in `shell/places.js` with its kind, scope, one-sentence description and required fields, then run `node tools/places-md.mjs`.
5. Import the module in `js/app.js` and add it to the list given to `bootShell`. The kernel activates modules in `needs` order.
6. Styles live beside the module and join the cascade in a declared `@layer` (the order is in `core/ui/foundation.css`), through the ordered links in `index.html` or the imports in `css/app.css`. The order is load-bearing: compare `node tools/conformance/css-resolve.mjs --flat <root>` before and after a move.
7. A module that calls a backend route checks it in `modules/<name>/tests/routes-contract.test.mjs` against xo-space's OpenAPI snapshot (`core/platform/tests/fixtures/openapi-routes.json`, refreshed by `node tools/openapi/snapshot.mjs`). Responses are decoded by typed readers in `core/platform/*-response.js`.

Tests go in `modules/<name>/tests/*.test.mjs`; `tests/run.mjs` finds them.

## Where state lives

| State | Home |
|---|---|
| Everything from the server: chats, threads, messages, sessions, turns, review items | The world (`core/services/world/store.js`), fed by Storm (`core/services/storm/`). One instance, made by `xo.app-services` (`shell/world.js`) and provided as `world`. Views subscribe; writes go through `world.act`. |
| The UI's shape per person | `core/services/shape/`: defaults < preset < yours (kept on Storm) < this device. |
| Navigation and small view state | Immutable stores from `core/kernel/store.js` (`shell/navigation-state.js`). |
| A module's own state | The module's closure, owned by its activation. Another module reaches it only through a service. |
| Browser storage | Only through `core/platform/storage.js` (`read`, `write`, `erase`). A key keeps its name or gets a migration. |
| Caches and in-flight reads | `createLru` (`core/platform/cache.js`), `once` (`core/platform/pending.js`) and `latest` (`core/platform/latest.js`). |

The DOM holds no state of its own: views draw from state with `core/ui/redraw.js`, which updates nodes in place.

## Lifecycle and scopes

- `createScope()` (`core/kernel/scope.js`) owns resources: `listen`, `timeout`, `interval`, `frame`, `observe`, `effect` and `delay`, plus an abort `signal` for requests. `dispose()` undoes them newest first and aborts the signal; `size` counts what is still held.
- A module's `ctx` has the same resource methods. Disabling the module disposes it, and `kernel.live(id)` must then be `0`.
- The app lives as long as the kernel, which `bootShell` disposes on `pagehide`. A mount takes the scope of its owner (usually its module's `ctx`) and registers its disposer there.
- Pass the scope's `signal` to every request, so a late answer after disposal is dropped rather than painted.
- Esc, phone Back, inert and the Tab trap go through one layer stack (`ctx.pushLayer`, `core/kernel/layers.js`).
- A test of a mount disposes it and asserts the scope is empty (`scope.size === 0` or `kernel.live(id) === 0`).

## Failures, logging and dialogs

- The kernel catches a throw from a module's activation, a bus listener, a place's `when`, watcher or arranger, a flush, a layer or a cleanup. The kernel logs the original error to the console with its module and phase, and shows it on the failure line.
- Report any other unexpected failure with `reportFailure` (`core/platform/util.js`). It reaches the same line through `reportError`, and so do uncaught errors and rejections. Don't add bare `console` calls or catch and drop an error.
- The failure line (`core/platform/failure.js`, `shell/failures.js`) is one quiet notice in the dock. It groups repeats with a count, ignores aborts, and after 30 quiet seconds starts over. Its Details open the error dialog with the source and a bounded stack.
- If boot itself fails, `boot.js` replaces the page with a "couldn't start" alert and logs the error.
- A dialog is `createDialog()` (`core/ui/components/dialog.js`), styled once in `shell/dialogs.css`. Open it with `showModal()`, push a layer for Esc and Back with `ctx.pushLayer`, and give focus back on close (`shell/failure-surface.js` is the pattern).

## Checks

| Command | What it does |
|---|---|
| `node tools/check.mjs --fast` | Lint, ratchets, layers, conformance, places, ledger. No types, build or tests. It lists files over 400 lines for size review. The pre-commit hook runs it. |
| `node tools/check.mjs --conformance-base <base>` | The full gate: the above plus types, the production build and every unit test. With a base, files changed since it are held to the strict rules and baselines may not grow. |
| `node tools/check.mjs --update-baselines` | Lowers baselines to what the code is now. They never rise. |
| `node tools/check.mjs --accept-upstream <ref>` | Integrator only, on a forward merge: allows existing findings in files identical to `<ref>`. |
| `node tests/run.mjs [filter]` | Unit tests (all, or those whose path contains `filter`), each judged by its exit code. |
| `python3 tools/ledger/check_ledger.py --repo .` | The ledger alone; `python3 tools/ledger/ledger_md.py . --check` checks its generated Markdown. |
| `node e2e/run.mjs [filter]` | The fast browser lane ([e2e/README.md](e2e/README.md)). Only when the owner asks. |

The exit code is the verdict, never the printed lines. [tools/conformance/README.md](tools/conformance/README.md) explains the conformance rules and baselines in `tools/baselines/`.

### Memory

The sandbox has 8 GB shared by every thread, so heavy runs are serialised:

- One full check or multi-file test run across the project at a time: take the `modular-full-check` lease first, and release it when done. A browser run also holds `headless-browser-suite`.
- Before starting, check `free -m`: wait unless at least 3 GiB is available.
- Run it as `JOBS=1 NODE_OPTIONS=--max-old-space-size=512 node tools/check.mjs --conformance-base <base>`.
- Run focused tests (`node tests/run.mjs <filter>`) while working, and the full gate once on the tip you hand over.
- Stop only processes you started.

## Tests

- Each test file's header says what it covers. Test behaviour through the public entry point, not the source text.
- Prove a fix's test: break the fix on purpose, watch the test fail, restore it, and say so in the handoff.
- DOM tests run in linkedom. When an assertion compares DOM nodes, compare identities as booleans (`assert.ok(a === b)`): a failing deep comparison of nodes can exhaust memory.
- Fake time and the backend; never wait on a real clock.

## Landing work

The modular rebuild lands on an integration branch that the integrator thread owns; [architecture/HANDOFF.md](architecture/HANDOFF.md) names it and its current pin.

1. Work in your own worktree, branched from the current pin.
2. Make small single-purpose commits whose titles say what changed.
3. A commit that moves, splits or deletes a file of the ledger's base commit updates `tools/ledger/ledger.json` in the same commit and regenerates `architecture/modular/LEDGER.md` with `python3 tools/ledger/ledger_md.py .`; never hand-merge it. Move commits change no behaviour; fixes and deletions are their own commits, each with a test.
4. Gate the exact tip: the full check with `--conformance-base <pin>`, then `git diff --check <pin>..HEAD`.
5. Hand over the head (`git rev-parse HEAD`), tree (`git rev-parse 'HEAD^{tree}'`) and base, read from git, with the gate's result. The integrator checks that they match, that the branch fast-forwards from the pin, the ledger and `git diff --check`, then fast-forwards and announces the new pin. If the pin moved first, rebase and gate again.

Nothing leaves this machine (push, PR, deploy) without the owner's approval, and deploys go through the coordinator.
