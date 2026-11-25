# Places

Generated from `shell/places.js` by `node tools/places-md.mjs`; `node tools/check.mjs` fails when this file is stale.

Every entry also has an `id`, and may have `order` (lists), `priority` (chains) and `when(at)`.

| Place | Kind | Scope | Open to apps | Entry needs | What goes here |
|---|---|---|---|---|---|
| `page` | keyed | app | no | `mount` | A main page, keyed by route kind (home, ws, p, t, c, chats, artifacts). |
| `rail.entry` | list | app | yes | `label`, `icon`, `onPress` | An entry in the left rail's top list; the shape orders and hides them. |
| `rail.section` | list | app | no | `mount` | A section of the left rail below its entries (Projects). |
| `rail.foot` | list | app | no | `label`, `icon`, `onPress` | A control at the foot of the left rail (account, theme, settings). |
| `header.title` | keyed | conversation | no | `render` | How the header names what is open, keyed by route kind. |
| `header.badge` | list | conversation | no | `render` | A small mark beside the header's title (runtime, needs you). |
| `header.detail` | list | conversation | no | `render` | A detail drawn into a named host below the conversation header. |
| `header.action` | list | conversation | yes | `label`, `icon`, `onPress` | A button in the header (Threads, Resolve, Deploy, Map, the panel). |
| `thread.menu` | list | conversation | yes | `label`, `group`, `run` | An item in a thread's ⋯ menu, in a named group. |
| `thread.head` | list | conversation | no | `render` | A strip under a thread's header (checklist, sub-agents). |
| `panel.frame` | list | conversation | yes | `title`, `mount` | A stacked frame in the right panel (Threads, Changes, Map, Launchpad). |
| `panel.page` | keyed | app | yes | `mount` | A page the right panel shows in place of its frames (Shell, Files, Thread). |
| `panel.title-action` | list | app | no | `label`, `icon`, `onPress` | A button in the right panel's title bar. |
| `dock.bottom` | single | app | no | `mount` | The dock under the conversation; it can move into a panel page. |
| `conversation.press` | chain | app | no | `route` | Handles shared notice and transcript controls in precedence order. |
| `conversation.file-route` | chain | conversation | no | `route` | Handles transcript file clicks in priority order. |
| `conversation.source` | keyed | app | no | `items` | Where a conversation's rows come from, keyed by view prefix. |
| `conversation.row` | keyed | conversation | yes | `render` | How one kind of conversation row is drawn, keyed by its kind. |
| `conversation.block` | keyed | conversation | yes | `render` | How one block type of an agent's turn is drawn, keyed by type. |
| `conversation.tool-words` | chain | app | yes | `words` | Plain words for a tool call; the first that knows the tool wins. |
| `conversation.typing` | chain | conversation | no | `render` | The line that says who is working or waiting; the first that applies wins. |
| `message.action` | list | conversation | yes | `label`, `run` | An action under a message (Copy, Reply, Good, Bad). |
| `message.decorator` | list | conversation | no | `decorate` | Something drawn onto a message after it renders (tails, quotes, marks). |
| `composer.tool` | list | conversation | yes | `mount` | A tool in the composer (attach, intelligence, send now). |
| `composer.target` | chain | conversation | no | `render` | The line that says where a message goes; the first that applies wins. |
| `composer.send-gate` | chain | app | no | `block` | A reason sending is held; the first refusal wins. |
| `composer.above` | list | conversation | no | `mount` | What stacks above the composer (notices, a docked decision, a file chip). |
| `decision.card` | single | app | no | `render` | How a decision is drawn, in the panel, the dock and Home. |
| `decision.detail` | keyed | app | no | `render` | The details of one kind of decision, keyed by kind. |
| `decision.evidence` | keyed | app | yes | `mount` | A view shown as evidence inside a decision. |
| `home.section` | list | app | no | `mount` | A section of Home; the shape orders them. |
| `settings.section` | list | app | yes | `label`, `icon`, `render` | A section of Settings. |
| `files.viewer.kind` | chain | app | yes | `accepts`, `mount` | How a file is shown; the first kind that accepts it wins. |
| `files.row.menu` | list | project | yes | `label`, `run` | An item in a file row's ⋯ menu. |
| `files.viewer.head.action` | list | project | yes | `label`, `run` | An action in an open file's head. |
| `files.tree.section` | list | project | no | `mount` | A section of the files tree (changed here, all files). |
| `editor.extension` | list | project | no | `extension` | An editor extension for a kind of file. |
| `search.provider` | list | app | yes | `items`, `pick` | A source of results for ⌘K and ⌘P. |
| `command` | keyed | app | yes | `label`, `run` | A named command, run by keys, menus or ⌘K; ids are <module>:<name>. |
| `shortcut` | keyed | app | no | `keys`, `command` | A key binding for a command, in a scope (global, decision, editor, diff, panel). |
| `pre-paint` | list | app | no | `apply` | A flag set on <html> before the first paint (theme, bubbles, density). |
| `world.reducer` | keyed | app | no | `reduce` | How one stream frame type changes the world, keyed by frame type. |
