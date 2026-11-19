# core/services/world

The world's pure parts: no page, no network.

| File | What it does |
|---|---|
| `turns.js` | Storm's turns and their blocks, built only from stream frames, so a turn looks the same watched live or read from history. |
| `hops.js` | A hop's state only moves on (sent → delivered → answered): a merge keeps the further one. |

## The turn store's rules

1. `block.started` creates the block; a second one for the same id only adds its index.
2. `block.updated` appends text `append` and a row's `output_append`; the rest replaces.
3. `block.finished` replaces the block with its final form.
4. `snapshot` replaces each listed turn's open blocks.
5. `turn.finished` drops that turn's blocks that never finished (they only streamed).
6. A turn that ends without `turn.finished` drops its open blocks too: a `session` frame for its session with status cold or parked, or a new `turn.started` in the same session.
