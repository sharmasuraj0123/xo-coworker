# core/services

The data layer under the shell and the modules. It never draws: no DOM here, so everything is tested from Node.

| Path | What it does |
|---|---|
| `storm/` | The world on storm, XO Space's chat engine: reads, the one stream, reducers, selectors and writes (its own README). |
| `world/` | `createWorld` (the store the views subscribe to) and the world's pure parts: turns, hops, paid usage (its own README). |
| `runtimes.js` | A runtime's name, mark, health, usage windows and policy, and the words for each; the backend is the truth. |
| `paths.js` | Every file in a place, for ⌘P and Find: Space's `/paths`, or a background walk of `/tree`; kept current by file events. |
| `notices.js` | The dock line's notices: what's on screen, what waits, and how a newer line meets an older one. The line itself is drawn by the app. |

## How notices meet

- An Undo is never pushed out of reach by a newer line: what comes while one shows waits.
- A passing line yields to an Undo, to a line of its own kind (`OWN`), and to a forced line (a message that didn't go).
- A Stop's own Undo shows at once (its 3 s are already running); the line it covers comes back after.
- When a line ends, the next is: Undo lines first, in order; then forced lines, oldest first, never merged away; of the rest only the newest (each was already announced).
- A line whose Undo has a deadline comes back only for what is left of it, or without its Undo.
- A message's notice is set whole for each state (out, sent, failed), in place, on screen or waiting; one that's no longer true is dropped.
