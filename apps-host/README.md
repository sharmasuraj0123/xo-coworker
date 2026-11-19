# apps-host

**Purpose.** Installed apps show up in XO's own places. Their views run in sandboxed frames, they reach their own tools through one bridge, and the owner installs and grants them in Settings › Apps.

## Files

| File | What it does |
|---|---|
| `module.json`, `host.js` | The kernel module. It lists apps, checks each manifest, and contributes each enabled app's surfaces. Disable undoes everything. |
| `manifest.js` | Checks an app's `plugin.json` (`extensions["space.xo"]`): id, version, `engines.xo` against `APPS_CONTRACT`, permissions, routes, documents, surfaces, tools. Problems come back in plain words; an app with any problem contributes nothing. |
| `routes.js` | The routes an app may declare. Secrets, raw files, settings, decisions, rules, terminals, app management and `/mcp` are refused whatever the manifest says. |
| `when.js` | `when` clauses: `key == 'value'` joined by `&&` and `\|\|`, over `view`, `canvas.app`, `artifact.type`, `thread.state`, `app.enabled`. It never runs code. |
| `contributions.js` | Manifest surfaces to place entries: `panel` → `panel.page`, `header` → `header.action`, `commands` → `command`, `canvas` → `files.viewer.kind`, `evidence` → `decision.evidence`. Each shows only in projects where the app is on. |
| `frame.js` | XO's frame around one view: loading, live and stopped states, Reload, theme tokens, a 5 s ping watchdog. A view that navigates its frame is closed. |
| `bridge.js` | MCP Apps JSON-RPC over `postMessage`. It accepts only messages from the view's own frame at the opaque origin `"null"`, allows a fixed list of methods, checks grants, and caps size (1 MiB) and rate (a burst of 50, then 20 a second). |
| `card.js` | `conversation.block: app`: a picture and caption drawn by XO, live only when touched, three live at most. |
| `settings.js`, `settings-view.js` | Settings › Apps: install from a repo or a folder, the consent sheet, per-project grants with Allow and Not now of equal weight, update, rollback, remove and activity. |
| `client.js` | The one interface to xo-space: `/api/apps/*` to manage apps, `/api/coworker/apps/{id}/*` for views (resources, call, prompts, views open/heartbeat/close). It checks ids, paths and sources before anything is sent. |
| `apps-host.css` | Tokens only, in `@layer apps`. Settings reuse the settings page's classes. |

## The sandbox

- Frames are `<iframe sandbox="allow-scripts">` with no same-origin, loaded from `srcdoc`, with XO's CSP as the first thing parsed: no fetch or sockets, no forms, no frames, no base. Peer connections (WebRTC) are removed before the view's code runs.
- A view that doesn't initialize in 15 s, stops answering pings for 10 s, or navigates its frame is closed, with Reload.
- Turning an app off in a project, updating it or removing it closes its open views at once. Grants are sent by the manifest's permission index, never by a name the app chose.
- A view never calls an XO route. It calls its own app's tools through the bridge, and its server uses the local routes under the owner's grants.
- `ui/message` becomes a composer draft; only the person sends. Links open only over https, after the person agrees.

## What the shell gives it

`createAppsHost({ client, doc, win, redraw, projects, draft, openPanel, confirm, context })`: `client` from `createAppsClient(core/platform's request)`, `redraw` from `core/ui`. Emit `apps:refresh` on the bus when xo-space says an app changed; the host emits `apps:changed` after it re-reads.

## Known limits

- Views share XO's renderer process. A busy loop in a view can freeze the tab until views move to their own origin.
- "No network" for a view is not yet airtight: a view can navigate its own frame (the second load closes it), and a DNS prefetch can carry a little data out. Until views move to their own origin with a header CSP, treat the `network` permission as advisory for views; app servers are held to it by xo-space's sandbox.
