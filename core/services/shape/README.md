# core/services/shape

The UI's shape, per person. What overwhelms a non-technical person can comfort a technical one, so the person picks the shape (a preset, a switch, Edit as JSON) and the UI never reshapes itself on its own: only a person's click writes a layer.

One list of every surface that can come and go (`SURFACES`: an id, a slot, an order, on by default, what it needs from the backend, its options), and one document that says which are on, in what order, how dense and in which words. `keys.js` is the same idea at small scale: defaults in code, only the differences stored, a Settings page generated from the list.

No DOM here, so `tests/shape.test.mjs` runs it in node. `createShapeStore` is the browser half, with its storage and its fetch injectable.

| File | What it does |
|---|---|
| `model.js` | `SURFACES`, `PRESETS`, `WORDS`, the checks, `merge` (RFC 7396), `migrate`, `cleanLayer`, `createShape`, `describeShape`, `everythingLayer`, `migrateDevice`. |
| `changes.js` | One person's change and putting it back on top of another device's: `changesOf`, `applyChanges`, `oneKey`, `sameDoc`. |
| `store.js` | `createShapeStore`: the live shape for the page, its storage keys (`KEYS`), and mine kept in sync with Storm. |
| `index.js` | Every public name, from the three files above. |

## Layers

Layers, lowest first, merged per key with JSON Merge Patch (RFC 7396: objects merge, anything else replaces, null removes):

built-in defaults (`model.js`) < preset (`presets/<id>.json`) < mine (Storm's, cached in `cv-shape-mine`) < this device (`cv-shape-device`)

- `surfaces` and `apps` are maps keyed by id, never arrays, so a preset that adds a surface still reaches someone who changed another.
- A bad value falls back to the layer below for that key only; an unknown key is ignored. Both are listed as problems (Settings › Shape), and nothing blanks the screen.
- A document newer than this UI knows is read for what it understands and never written over.
- Ids follow the apps contract (`apps/README.md` §6): XO's own surfaces are `xo:<id>`, an app's are `<app id>:<surface>`. Apps aren't built yet, so their entries are kept as data and do nothing.

## The store

This device's layer is kept in localStorage; the active preset is cached too (`cv-shape-preset`), so the first paint already has the right shape (the file is read again after boot). The presets stay files here: Storm has no presets route.

Mine is Storm's where Storm keeps it (`GET`/`PUT /api/chat/shape`), so your shape follows you to every device; `cv-shape-mine` keeps a copy for the first paint, and is all there is on a backend without the route. `remote` is `{get(), put({shape, if_version})}`, both answering `{shape, version, updated_at}` (api.js's in the app; none in node tests, which is the localStorage behaviour). `notice({text, sub})` is the app's quiet line.

## How mine syncs with Storm

- **Load: one GET.** A 404 (an older backend) or a failure keeps this browser's copy, as before. When Storm has a shape, it's yours here too. When it has none and this browser has one, nothing is offered and nothing is uploaded: it goes up with your first change, as `if_version` `"new"`.
- **Only your change writes**, a PUT with `if_version` (the version last read): never a page load. One PUT at a time; changes made meanwhile go with the next.
- **Another device saved first** (409 `shape_changed`): Storm's is taken, and your change is put back on top of it when it's one clear key (a switch, the density, the preset), once; otherwise Storm's stays. Either way it's said, quietly. When Storm has none any more (cleared elsewhere), this device's goes up as `"new"`, as on a first upload.
- **Another device's change arrives on the stream** (`settings`, key `ui.shape`): applied here at once, then read again for its version (the event doesn't carry it). While a write of ours is out, it waits for that write to settle; our own write's echo changes nothing.
- **A write that didn't land** is held, here and across a reload, so no read takes Storm's older shape over it:
  - **unreachable** (XO couldn't be reached): sent again by itself, after 30 s, then doubling up to 5 minutes, or as soon as a read reaches Storm;
  - **refused** (XO answered 4xx): it goes with your next change.
  - Its reason is said in a sentence of its own, in the notice and in Settings › Shape while it's held, and truthfully when this browser couldn't keep it either. Once Storm has it, a change that waited says it got there.
- A read that reaches Storm while changes are held and finds another device's shape since they began is a conflict, as above; otherwise they go again.

## The note of held changes (`cv-shape-unsynced`)

Your change Storm hasn't taken yet (a failed write) is kept in `KEYS.unsynced`, so a reload neither loses it nor reads over it. The note carries the changes, what Storm held when they began (`known`), why and its sentence, mine as you left it, and what this browser's copy of mine was when the note was written (`stored`).

On a reload:
- If this browser's copy of mine is unchanged since the note, the note's mine is the newer (that copy's write had failed): it's what shows and is sent again.
- If the copy was written since (a later change landed here while its PUT was out), the copy is newer and stays; a stale note never rolls it back.
- A note without mine (an earlier build's) has the changes: they're put on top of this browser's copy, so what's held is never claimed while it's missing.
- Then it's one coherent revision: the document wanted (mine), what Storm held when it began (`known`), and what's held is the difference between the two, never a delta left over from an older note (a conflict replays exactly this). Nothing left between them: nothing is held, and the note goes.

The note follows mine at once while something is held, so a reload while a PUT is out restores the newest. It's kept exactly when the note is what's held and what's on its way with it.

## The sync state (`R`)

- `mode`: `reading` (the load's GET), `on` (Storm keeps it; `version` is what it holds), `off` (no route: this browser's copy only), `unknown` (a read failed: read again before a write).
- `synced`: the document Storm holds at `version`; `knows`: it has been read at all.
- `pend`: your changes not stored yet (lists from `changesOf`); `known`: what Storm held when they began, so a read that finds otherwise is a conflict.
- `busy`: the PUT on its way; `heard`: a `ui.shape` heard on the stream while one was.
- `held`: your changes a write couldn't land; `why` (`unreachable` or `refused`) and `text` stay set until Storm has them (a change sent again with them doesn't hide that they're not there yet).
- `kept`: whether this browser kept both mine and the note of it, so a reload finds them; `localOk`: whether it kept mine at its last write.
- `retried`, `tries`, `timer`: one put-back per conflict, and the resend's backoff.
