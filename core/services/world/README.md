# core/services/world

The world's pure parts: no page, no network.

| File | What it does |
|---|---|
| `turns.js` | Storm's turns and their blocks, built only from stream frames, so a turn looks the same watched live or read from history. |
| `hops.js` | A hop's state only moves on (sent → delivered → answered): a merge keeps the further one. |
| `paid.js` | Paid usage: the founder's modes, which one holds for an account, the account rows, the paid-usage question. |

## The turn store's rules

1. `block.started` creates the block; a second one for the same id only adds its index.
2. `block.updated` appends text `append` and a row's `output_append`; the rest replaces.
3. `block.finished` replaces the block with its final form.
4. `snapshot` replaces each listed turn's open blocks.
5. `turn.finished` drops that turn's blocks that never finished (they only streamed).
6. A turn that ends without `turn.finished` drops its open blocks too: a `session` frame for its session with status cold or parked, or a new `turn.started` in the same session.

## Paid usage (`paid.js`)

The three modes are the founder's, kept by XO (`POST /api/chat/intent/paid`), never decided here:
- **never**: work stops before any paid usage, and when XO can't tell whether it would be paid (the default);
- **ask**: work stops before paid usage and asks; it goes on only after the founder allows it, until that window resets;
- **always**: work goes on into paid usage without asking.

An account follows the Space unless it has a mode of its own. What an account is (its plan, whether it can go on to paid usage, its credits) is the Space advisory's: facts with a source and an age, each `known` or not. What it is doing now is its pool in `GET /api/chat/status`. The wire is read in this one file: a field renamed on the server changes here and nowhere else.
