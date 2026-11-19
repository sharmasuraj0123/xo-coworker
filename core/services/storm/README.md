# core/services/storm

The world on storm, XO Space's chat engine: its chats, threads, messages, sessions, turns and review items made into the `world.state` the views render, and the person's actions made into requests. It owns no decision logic. It never touches the page except to hear the tab come back and the network return.

`stormSource(state, emit, event)` builds one shared context (`types.d.ts` `Ctx`) and lets each part install its functions on it.

| File | What it does |
|---|---|
| `index.js` | `stormSource`: the state's shape, the shared context, the parts in order, then the stream. |
| `config.js` | Page sizes, caps, intervals; the coordinator roles; the waiting states. |
| `client.js` | Every route storm reads or writes, and the stream's address. |
| `stream.js` | Boot (stream first, frames held through the load, applied in order), recover, reset reload, the 60 s housekeeping, the tab and network listeners. |
| `load.js` | Chats, threads, sessions and review items by GET; a single thread read again. |
| `account.js` | The engine's status and pools, runtimes and router, paid usage, runtime policies. |
| `history.js` | Timelines and threads paged backwards by seq, each page once; turns' stored frames; rows found by id, off the timeline. |
| `hops.js` | Hops read once per thread or chat, then kept by the stream; a hop state only moves on. |
| `reducers/` | One handler per stream frame type (`REDUCERS`); turn and block frames go to the turn store. |
| `selectors/` | Sessions (coordinator choice, status by stream order, on a turn, held), the thread view-model, and the commit that rebuilds threads and hosts. |
| `commands.js` | The writes, with optimistic rollback where they show at once; a refused decision is never reported as made. |
| `act.js` | `world.act`: the commands, what to watch and read, and what a session or chat is doing. |

Behaviour is pinned by `tests/storm-{boot,turns,history,writes}.test.mjs` on a fake backend (`tests/storm-harness.mjs`).
