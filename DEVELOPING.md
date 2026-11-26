# Developing xo-coworker

How to run, extend and check the code. How it's organised is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Setup

```sh
npm ci                  # once, and whenever package.json changes: build, lint, types, linkedom
python3 serve.py        # the app on http://127.0.0.1:5180
```

Development runs straight from the source. If a `dist/` is left from a build, `serve.py` serves that release instead: delete `dist/` or set `XO_SERVE_RAW=1`. In source mode, restart `serve.py` after editing assets so their fingerprint is taken again.

`npm run build` (`tools/build-ui.mjs`) bundles the entry points with esbuild, inlines every stylesheet in cascade order into one `css/app.css`, writes the release to `dist/<digest>/` and then points `dist/current` at it. Production runs this build when its Docker image is built. The full check builds a release in a temporary folder and checks its asset graph and both serving modes over HTTP (`tools/build/check.mjs`).

For an in-place rollout, build into the existing `dist/` and restart the server. It prints its mode and digest. Source assets revalidate on request. Each production build retains the last two distinct releases for open tabs and keeps their diagnostic source maps private. If a replacement image drops a tab’s release, the existing notice line offers **Reload**.

The pre-commit hook (`.githooks/pre-commit`) is enabled through the shared git config; never run `git config` for it.

## Adding a feature

1. Make `modules/<name>/` with a `module.js` that exports a `ModuleDef`: a manifest (`id: "xo.<name>"`, `version`, `kernel: "^1.1.0"`, `needs`, `optional`, `provides`, `contributes`) and `activate(ctx)`. `modules/since/module.js` is a short example.
2. In `activate`, get what you need with `ctx.use(service)` (or `ctx.optional(service)` for one that may be absent), fill places with `ctx.contribute(place, entry)`, share an API with `ctx.provide(name, api)`, and listen with `ctx.on`. The kernel throws on a `use`, `provide` or `contribute` the manifest does not declare.
3. Type a provided service by adding it to the kernel's `Services` interface from a `*-types.d.ts` beside it (`modules/changes/data-types.d.ts`). Declare a new `app:*` topic in `Topics`, and a place's entry type in `PlaceEntries` or `KeyedPlaceEntries`, the same way.
4. Need a new slot? Add it to `SPECS` in `shell/places.js` with its kind, scope, one-sentence description and required fields.
5. Import the module in `js/app.js` and add it to the list given to `bootShell`. The kernel activates modules in `needs` order.
6. Styles live beside the module and join the cascade in a declared `@layer` (the order is in `core/ui/foundation.css`), through the ordered links in `index.html` or the imports in `css/app.css`. The order is load-bearing: compare `node tools/conformance/css-resolve.mjs --flat <root>` before and after a move.
7. A module that calls a backend route checks it in `modules/<name>/tests/routes-contract.test.mjs` against xo-space's OpenAPI snapshot (`core/platform/tests/fixtures/openapi-routes.json`, refreshed by `node tools/openapi/snapshot.mjs`). Responses are decoded by typed readers in `core/platform/*-response.js`.

Tests go in `modules/<name>/tests/*.test.mjs`; `tests/run.mjs` finds them.

## Checks

| Command | When | What it does |
|---|---|---|
| `node tools/check.mjs --fast` | Every commit (the pre-commit hook runs it) | Lint, layers, conformance, ratchets. A few seconds. |
| `node tests/run.mjs <filter>` | While working | The unit tests whose path contains `filter`, each judged by its exit code. |
| `node tools/check.mjs --conformance-base <start>` | Once, by whoever merges; not per commit | The fast check plus types, the production build and every unit test (about 2 minutes). Holds files changed since `<start>` to the stricter rules. |
| `node tools/check.mjs --fast --update-baselines` | When the check notes a baseline can drop | Lowers baselines to what the code has now. |
| `node tools/check.mjs --accept-upstream <ref>` | Integrator, on a forward merge | Allows existing findings in files identical to `<ref>`. |
| `node e2e/run.mjs [filter]` | Only when the owner asks | The fast browser lane ([e2e/README.md](e2e/README.md)). |

Read the exit code, not the printed lines. Lines starting with `note` don't fail the check: a baseline that can be lowered, or one raised since the base (say why in the commit). A file you edit loses its allowance for type escapes, stale comments and swallowed catches; its other old findings may stay, but no file gains new ones. [tools/conformance/README.md](tools/conformance/README.md) explains the rules.

## Tests

- Each test file's header says what it covers. Test behaviour through the public entry point, not the source text.
- A bug fix's test fails without the fix. If that isn't obvious from the test, check it.
- DOM tests run in linkedom. When an assertion compares DOM nodes, compare identities as booleans (`assert.ok(a === b)`): a failing deep comparison of nodes can exhaust memory.
- Fake time and the backend; never wait on a real clock.
