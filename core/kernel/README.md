# core/kernel

**Purpose.** The kernel holds modules together without knowing any feature. It is plain ES modules that import nothing outside this folder.

## Files

| File | What it does |
|---|---|
| `types.d.ts` | The contract (kernel API v1). Modules see only `ModuleContext`. |
| `index.js` | The public surface: `createKernel`, `KERNEL_VERSION`, `manifestProblems`, `satisfies`. |
| `manifest.js` | `manifestProblems`: a manifest's id, version, kernel range and lists, in plain words. |
| `places.js` | Named places in the UI and their entries. Kinds: `single`, `list`, `keyed`, `chain`. Scopes: `app`, `project`, `conversation`. |
| `kernel.js` | Modules: manifest checks, the kernel version range, activation ordered by `needs`, an error boundary per module. Disable takes dependents down first. Safe mode starts only the core modules. |
| `undo.js` | The bag of undos behind every registration. |
| `scope.js` | Owns resources and aborts its signal on disposal. |
| `bus.js` | Synchronous topics. A listener that throws never stops the others. |
| `scheduler.js` | Batched redraws. `invalidate(key)` leads to one flush per frame, in registration order. |
| `layers.js` | One stack for Esc, phone Back, inert and the Tab trap. |
| `store.js` | `createStore`: a small frozen value with `get`, `set` and `subscribe` on a bus topic. |
| `semver.js` | Range matching: `^`, `~`, `x`, comparisons and `\|\|`. |

## How a module uses it

A module is a `ModuleDef`: its manifest plus `activate(ctx)`. First-party modules declare it inline where they export the `ModuleDef`; `apps-host` keeps it in `module.json`.

Everything it registers through `ctx` is undone, newest first, when the module is disabled or fails. That covers entries, services, places, bus listeners, DOM listeners, timeouts, intervals, frames, observers, flushers and layers. A module never imports another module: it uses a service (`ctx.use`), a place or a bus topic.

**The manifest is the truth.** The kernel refuses these calls when the manifest doesn't declare them:
- `ctx.use` of a service not in `needs`, or `ctx.optional` of one not in `optional`;
- `ctx.provide` of a service not in `provides`;
- `ctx.contribute` to a place not in `contributes`.

## The conformance rule

After `kernel.disable(id)`, `kernel.live(id)` must be `0`. Every module's tests assert this. `tests/kernel.test.mjs` asserts it for the kernel itself.

## Versioning

`KERNEL_VERSION` (1.1.0) is semver.
- Adding a place, an optional field or a ctx method is a minor version.
- Changing or removing one is a major version, after one minor version of deprecation.

Each module declares the range it was written for (`"kernel": "^1"`), and `register` refuses a module whose range doesn't match.

## Known limits

- Places are defined at runtime by `shell/places.js`; `architecture/places.md` is generated from it.
- `when(at)` is called on every read, so keep it cheap.
