# core/kernel

**Purpose.** The kernel holds modules together without knowing any feature. It is about 600 lines of plain ES modules that import nothing.

## Files

| File | What it does |
|---|---|
| `types.d.ts` | The contract (kernel API v1). Modules see only `ModuleContext`. |
| `places.js` | Named places in the UI and their entries. Kinds: `single`, `list`, `keyed`, `chain`. Scopes: `app`, `project`, `conversation`. |
| `kernel.js` | Modules: manifest checks, the kernel version range, activation ordered by `needs`, an error boundary per module. Disable takes dependents down first. Safe mode starts only the core modules. |
| `undo.js` | The bag of undos behind every registration. |
| `bus.js` | Synchronous topics. A listener that throws never stops the others. |
| `scheduler.js` | Batched redraws. `invalidate(key)` leads to one flush per frame, in registration order. |
| `layers.js` | One stack for Esc, phone Back, inert and the Tab trap. |
| `semver.js` | Range matching: `^`, `~`, `x`, comparisons and `\|\|`. |

## How a module uses it

A module is `module.json` plus `activate(ctx)`.

Everything it registers through `ctx` is undone, newest first, when the module is disabled or fails. That covers entries, services, places, bus listeners, DOM listeners, timeouts, intervals, frames, observers, flushers and layers. A module never imports another module: it uses a service (`ctx.use`), a place or a bus topic.

**The manifest is the truth.** The kernel refuses three things the manifest doesn't declare:
- `ctx.use` of a service not in `needs`;
- `ctx.provide` of a service not in `provides`;
- `ctx.contribute` to a place not in `contributes`.

## The conformance rule

After `kernel.disable(id)`, `kernel.live(id)` must be `0`. Every module's tests assert this. `tests/kernel.test.mjs` asserts it for the kernel itself.

## Versioning

`KERNEL_VERSION` (1.0.0) is semver.
- Adding a place, an optional field or a ctx method is a minor version.
- Changing or removing one is a major version, after one minor version of deprecation.

Each module declares the range it was written for (`"kernel": "^1"`), and `register` refuses a module whose range doesn't match.

## Known limits

- Places are defined at runtime; there is no generated catalogue of them yet.
- `when(at)` is called on every read, so keep it cheap.
