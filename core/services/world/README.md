# core/services/world

The world the views render (`store.js`: `createWorld`, on storm), and its pure parts: no page, no network.

| File | What it does |
|---|---|
| `store.js` | `createWorld()`: the state, `subscribe`, `onEvent` (the last 200 kept in `state.activity`), `act` (storm's), and the `thread`, `project` and `waiting` selectors. |
| `rows.js` | Storm's message rows: the UI's message (`uiMsg`, its files by `attachmentsOf`), reactions and updates, merging by seq, and paging state. |
| `sessions.js` | Is an agent at work (Working), or held back by a gate (Waiting), and for what; which status is newest; the pools that can hold work now. |
| `threads.js` | A thread's shown state, what it asks of the person, and a stop someone meant. |
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

## Working, Waiting, and a stop someone meant

- Storm says `busy` on every session and thread view: true while the session is on a turn (starting, running, stopping) or while a sub-agent works on after its turn. Live session frames carry only the status, so between reads the same rule runs here: the status, then the sub-agents the stream names (run.* until run.finished, and the `runs` counts). An older backend sends no `busy`: the same rule with less to go on.
- "queued" is not Working. Storm queues a session only when a gate holds its message back (the usage limit, the paid-usage hold, near-limit pacing, the memory guard, the founder's pause), with no process: it is Waiting (`heldOf`). Only work seen after the status said queued (a turn started, a sub-agent named, counts above none) outlives it: the frame that ended the wait was missed or is late (`queuedButWorking`).
- Waiting on the person is never Working, whatever runs.
- A thread has two words: `state` (one of the API's seven) and `activity` (the true one) with `wait_reason`. A deliberate stop (the founder's Stop, or the coordinator's stop_thread) has activity "stopped" and state "failed": it is no failure to retry (`stopOf`). A real failure has activity "failed". An older backend sends no activity, and nothing changes.
