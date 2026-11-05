# xo-coworker

**XO Space's web UI.** Codename xo-swim: Smart Work & Ideas Management.

A web UI for the XO Space **projects chat** backend (`/api/projects-chat/*`). It is built around one idea: protect the person's attention. The screen shows what is worth your time and the next action. Everything that only needs an agent stays quiet.

- **Home**: what is worth your time across every project, ranked. Small asks that block nobody wait quietly and say why. Then "Handled": what is running and what can wait.
- **Needs you** panel: one decision at a time, with what it unblocks, the evidence and Details. On phones it is a bottom sheet.
- **Workspace**: your coordinator across all projects. Messages show where they were routed.
- **Projects**: a title, one sentence, the Now shelf of threads in progress, and All threads (searchable, finished ones folded).
- **Threads**: each has its own agent, branch and checklist. The thread's own decision sits above the composer.
- **Pictures in the conversation** (`js/media.js`, `js/lightbox.js`): what an agent or you share is *shown*, not attached. A picture appears bare (12 px corners, a hairline, no shadow; an agent's up to 560×480, yours up to 320×320, never enlarged), several make an album with "+N", other files are cards. Its box is reserved from the server's `w`, `h` and `tint` (a fixed 16:10 frame when they're missing), so nothing moves while it loads. A picture opens in the lightbox: it grows from its place, ← → walk through the conversation's pictures, Esc or a swipe down puts it back. A file an agent titled (`share_files` titles, xo-space 8c6bc03) is named by its title there, on its card, in Made, Artifacts and Recently made, with its file name beside it or in a tooltip; a long file name is cut in the middle, keeping its extension (`r3-dark…title.png`). **Pictures from the web** in an agent's words (`![alt](https://…)`, or a bare http(s) picture address on a line of its own; consecutive lines make an album) show the same way, read straight from their site with no referrer, in the fixed 16:10 frame (their size is unknown); one that can't load becomes its ↗ link, and the lightbox names its host with "Open original ↗". Only http(s). Settings › General › "Show pictures from the web" (on; this device's shape layer) makes them links.
- **Shape** (`js/shape.js`, `js/shapeview.js`, `presets/`): the UI fits the person. A first-run question picks **Build software**, **Make content and campaigns** or **Everything**; Settings › Shape switches it, shows what it changes, resets it, shows everything, and edits your own layer as JSON. Layers: defaults < preset < yours < this device (Compact lives here). Yours is Storm's where it keeps one (`GET/PUT /api/chat/shape`, xo-space 8c6bc03), so it follows you to every device: read on load (a 404 keeps this browser's copy), written only on your change with `if_version`, another device's change applied live from the stream's `ui.shape` setting, and a conflict said quietly (your one-key change is put back on top; a larger one gives way). Marketing hides branch chips, runtime names, sub-agent counts, raw commands, Shells and the Map, says "task", and puts Recently made first. XO never reshapes itself on its own.
- **A coordinator's own ask** (it, or one of its sub-agents, asks with no thread): it sits above the composer of the project's or the Workspace's chat, the header's count line leads with "Coordinator needs you", and Home and the panel name it "xo-space › Coordinator". A thread with any open item reads Needs you in its list row, header and Now chip, whatever its row's state says yet.
- **Map** (`⌘\`, or Map at the top right of any conversation): where your agents are working, drawn. Two ways to see it, one icon apart: a **Diagram** (the folder as boxes and connectors) or a **Graph** (a living node graph that settles). Each agent is a coloured cursor with its name that moves to the file it reads or edits, or that its command names, and the way down to it lights in its colour. In a thread, its own worktree, with what it made or changed marked; in a project, the project's folder with every agent at work; elsewhere, your projects and the agents in them. Drag, zoom, Fit, Follow, full size. With a file open, the Map and the viewer are one right-hand panel with two modes, **Live** and **File**.
- **Composer**: `@project` aims a message at a project. The model chip shows the routing in effect. The line above it follows the world: "Sending is paused" shows only while it's true.
- **Creating a project**: "Create XO Project" in Home's header, always, and "+ New" on the sidebar's Projects label.
- **Stone and glass** (design-research/2026-11-vision/direction): the chrome is stone (neutral, crisp, shadowless; controls 32 px with 6 px corners), the work is glass (soft bubbles, vivid pictures). One scale for everything in `css/tokens.css` (**Plan F**): 8 type sizes with whole-pixel line heights and tracking by size, 3 weights, radii 6 · 12 · 20 · 22, one floating elevation, one motion curve (a hover engages in 120 ms and releases in 200, a press in 60; nothing overshoots), three lights (green done, blue working, amber needs you). Icons outside the sidebar draw one 1.5 px line at any size. Documents in Files read in a serif. `tests/design-budget.test.mjs` fails the build when a stylesheet strays from the scale. The left sidebar keeps its own look (the owner's decision).
- Light and dark themes. Geist type and the XO palette, with XO green as the accent. Motion honours reduced-motion settings.

Plain HTML, CSS and vanilla ES modules: no build step, no npm, no CDN.

## Start

```sh
python3 serve.py                 # foreground, http://127.0.0.1:5180
./start.sh --background          # detached (pid in .server.pid, log in .server.log)
./start.sh --status | --stop
```

| var      | default                 | meaning                       |
|----------|-------------------------|-------------------------------|
| `PORT`   | `5180`                  | port to listen on             |
| `XO_API` | `http://127.0.0.1:5002` | the XO Space API to proxy to  |
| `HOST`   | `127.0.0.1`             | bind address                  |

`serve.py` (standard library only) serves the files and reverse-proxies `/api/*` to `XO_API`:
- It answers only requests addressed to it as `localhost` or an IP address on its own port, or as a hostname
  through a proxy on the same machine (Coder's app proxy: a loopback peer, and a Host not on serve.py's port,
  which a page reaching serve.py directly always sends). Anything else, static files included, gets a 421
  before any routing, so a DNS-rebinding page never reaches the backend.
- It answers only pages it served: a request from any other page, read or write, gets a 403.
- It never forwards the backend routes this UI doesn't use that expose secret values, raw files or file writes
  under `$HOME`, however they are spelled, and refuses a path with `#` or dot segments.
- It drops the browser's `Origin`, `Referer` and `Sec-Fetch-*` headers before forwarding.
- It adds the UI's writer key (`X-XO-UI-Writer`) to exactly two writes, saving a project file (`PUT
  /api/xo-projects/{p}/file`) and undoing a save (`POST …/edits/{id}/undo`), after its own same-origin
  check. It reads the key per request (cached by the file's change time) from
  `${QUIRQ_STATE_ROOT:-$HOME/.quirq}/space/ui-writer.key`, where XO Space keeps it. Without a key, a save
  gets a 503 and isn't forwarded. A page can never send the header itself.
- It relays Server-Sent Events unbuffered.
- It tunnels one WebSocket, a shell's terminal (`GET /api/terminal/sessions/{id}/ws`), after the same checks,
  forwarding only `Upgrade`, `Connection` and `Sec-WebSocket-*` (no `Origin`, cookies, Coder token or query),
  and refuses every other upgrade.

## The backend

The UI reads and writes your real XO workspace. **Sending a message starts real agents.**

- **Status:** `GET /status` at boot, every 20 s, and every 8 s while failing. An unreachable backend, the router being off or an unsupported backend shows as one calm line, and Send is disabled with the reason.
- **Threads:** every project's threads every 15 s, one poll at a time. A project that fails keeps its last good data. Thread details load in parallel, six at a time.
- **Conversations:** `GET /chats/{chat}/messages?limit=40`, plus an SSE `ChatStream` for the open chat (the Workspace while on Home). `message`, `thread` and `heartbeat` events are handled, with backoff and a polling fallback. Scrolling up grows history 40 → 80 → 160… (up to 1,000).
- **Files (hub #30):** the paperclip, a drop or a paste adds text, images or PDFs (25 MB each, 10 per message). Each uploads at once to the chat (`POST /chats/{chat}/attachments`) as a chip with progress, Retry and Remove; Send waits for them. A paste over 4,000 characters or 80 lines becomes `pasted-text-N.md`. Sent files open in the viewer through their message's own chat.
- **Sending:** `POST /chats/{chat}/messages {text, thread_ts?, attachments?}`. Your message appears at once and is replaced in place by the server's row. "Replying" follows the coordinator's real heartbeat. Errors use plain titles, with Retry and Edit.
- **Interrupt:** what a reply sent while the thread's agent works does depends on its runtime's `send_while_running` feature. On a runtime that steers (Claude Code, Codex) it joins the running turn and the composer says "sent into the current turn" (behind `STEER_LIVE` in `js/app.js`, off until xo-space deploys the backend half). On one that queues (agy) it waits for the turn to end, and under your newest waiting reply **Interrupt** stops the turn and its sub-agents (`POST /chat/abort`, with the usual 3 s Undo), so the agent reads your message as its next turn.
- **Runtimes (mixed runtimes, xo-space's `ui-handoff-mixed-runtime.md`):** each thread runs on one runtime for its whole life. All of this is quiet while there is a single runtime and nothing is wrong.
  - A thread's header names its runtime after its state when there is more than one runtime. Its list names only the exceptions.
  - **The composer's picker** chooses in one order: runtime, then model, then effort.
    - A project: Auto (its coordinator picks per thread) or one runtime for its coordinator and its new threads
      (`PATCH /chats/{id}` agent, and the project's `…/runtime-policy` default), with the 3 s Undo.
    - A thread: its runtime is fixed for life, so choosing another one shows that runtime's models and what
      happens, then **Continue on …** (`POST …/threads/{ts}/continue`). The two threads link to each other;
      the old one reads "Continued", and sending in it picks it back up. The thread menu opens the same place.
  - **Settings › Runtimes:** each runtime's health in words, its account and a meter per usage window, read
    every 30 s while the page is open; then four defaults that save as they change: the usual runtime, the
    runtimes XO may use, starting elsewhere at a limit, and how coordinators choose.
  - **A usage limit:** one card per runtime (decided with `move` or `wait`), shown in Needs you and at the end of each thread waiting on it. Those threads' headers read "Waiting for … until …".
  - A coordinator's steer, interrupt or stop on a thread shows as one quiet row (`thread.control`).
- **Open thread:** polled every 4 s while its agent is busy and every 15 s otherwise. "Working" means the session is actually busy: storm's `busy` (on a turn, or a sub-agent working on after it), kept live between reads by the same rule from the stream's session status, `run.*` events and `runs` counts (`timeline.js` `sessionBusy`). Waiting on you is never Working. An idle one reads "Idle".
- **Coordinator messages:** storm keeps what a coordinator and a thread write each other as hops (`GET /chats/{chat}/hops?thread=`, the text in `note`), not as messages. A thread shows them in place: the coordinator's brief, follow-ups and answers as its messages, the thread's own questions as a quiet "Asked the coordinator" line, and your messages they cite. A hop that arrives on the stream has no note, so the open thread reads its hops again.
- **Asks:** a thread waiting on you is titled from its agent's last message. You answer in words, as a thread reply.
- **Since you left and Made (design-research/12):** each place (Home, a project) remembers per browser when you last
  looked (leaving it, hiding the tab or closing it). Back after 8 h or more, a card under the header says what moved:
  needs you, not saved, not pushed, stopped, finished, still going, one line per thread with what it did. The git
  words come from `GET /chat/worktrees` (`would_lose`). **Made** beside All threads lists what a project's threads
  shared (each thread's `outputs`), with pins per browser; a file opens in the viewer beside its own thread. Home shows
  Recently made, and ⌘K finds made files by name.
  A newer backend (xo-space `xo/thread-046666`) makes it exact, and each part falls back when its route or field
  is missing: Made from `GET /chat/chats/{chat}/made` (files, links, branches; pins via `PUT|DELETE …/made/{id}/pin`;
  a 404 means the fallback), the thread's `summary` and branch `git` state (merged and its PR, pushed, unpushed), the
  worktrees' `removed` list, and "seen" per chat (`seen` on the chat, `PUT …/seen`; the later of it and this browser's).
  `?away=3d` (or `12h`) in the URL shows the cards as if you had been away that long, without storing anything.
- **Shells (`/api/terminal/*`):** only when `GET /terminal/status` says `enabled`; otherwise no shell UI shows at all.
  - Where they open: **Shell** beside All threads on a project (its folder), beside Next move on the Workspace
    (the projects root), and in a thread's header (its worktree from `/chat/worktrees`, else the project folder).
    Where shells already run, the button shows their count and opens their list.
  - The dock under the main column holds them as tabs and survives navigation. Closing a tab only detaches; the
    shell keeps running. A reload reattaches this browser tab's shells with their recent output.
  - The **Shells** toggle in the sidebar's foot (the running count; the same as `` mod+` ``) shows or hides the dock,
    opening on the list when nothing is attached. The list: status, the program in front, watching or
    detached and when it closes, with Open, Rename, Close and Close all detached. Closing asks first when
    something other than the shell is running. The list is polled every 15 s while on screen, else every 60 s.
  - The socket: `…/ws` through serve.py, the ticket as the first message (never in the URL), a fresh ticket on every
    reconnect (with backoff; none after 4404, 4403 or 4429, too many viewers, which is said in words), `pause`/`resume` from xterm's write callbacks (100 KB / 10 KB).
  - Inside a shell every key is the shell's (Esc, Ctrl+K…) except the toggle (`` mod+` ``). Ctrl+Shift+C / V copy and paste.

**The backend does not have these yet**, so the UI hides or degrades them (see `docs/requirements.md`):
- approvals with an approve/deny route (R2);
- stopping a running agent;
- resolving a thread from the UI (R1);
- per-chat model choice (R6; the chip is read-only);
- a `before` history cursor (R5).

## Code

| File | Role |
|---|---|
| `index.html` | the shell: sidebar, Home, conversation, dock, panel, sheets |
| `css/tokens.css` | **Plan F**, the one scale: palette, type sizes and line heights, tracking, weights, radii, elevation, motion, hover and press fills, the three lights, Geist faces. Other sheets use these names and never define a scale of their own |
| `css/base.css`, `css/app.css` | reset and the UI |
| `js/app.js` | views, rendering, navigation, composer, sending |
| `js/world.js`, `js/storm.js` | the world the views render, from the real API |
| `js/api.js`, `js/stream.js` | HTTP client and SSE `ChatStream` |
| `js/attach.js` | files on a message: checks before upload, a large paste as a file, the composer's upload tray |
| `js/model.js`, `js/timeline.js`, `js/markdown.js`, `js/util.js` | pure helpers: thread state, checklists, message rows and dedupe, asks, `@target`, safe markdown |
| `js/decide.js`, `js/kit.js`, `js/pacing.js` | decisions, the decision kit and commit window, and pacing (what speaks up and what waits) |
| `js/intel.js` | the model and depth chip |
| `js/runtimes.js` | runtimes, the pure part: names, health in words, usage windows, the runtime policy, moves, the limit card |
| `js/rtsettings.js` | Settings › Runtimes: each runtime's health, and the defaults |
| `js/content.js` | what an ask costs you, what it frees, and its evidence |
| `js/ui.js` | icons and motion helpers |
| `js/gestures.js` | touch gestures on a phone: swipe back or open the sidebar, drag sheets away, swipe between asks, long-press Copy (design-research/11) |
| `css/foundation.css` | the foundation (design-research/14): loaded last; flush side panels with one hairline, one left edge, one press, whole pixels, inset focus rings, nothing looping unless an agent works |
| `js/motion.js` | one motion system (design-research/15): arrive (fade and settle), glide (FLIP), update in place, pictures fade in once decoded; `syncList` keeps a list in step without redrawing it |
| `js/stage.js` | the panel (design-research/13): one card on the right, tools as labelled tabs (Files, Made, Map; apps later, past four into More), one header button (`mod+\`) that opens on Files first and then on the last tool, full size, Esc; the Map mounts into its tab |
| `js/files.js` | Files: the project's (or a thread's worktree's) files a folder at a time, the README first, the file beside the tree or one at a time, what agents touched marked; the one place a file opens (the viewer lives in it) |
| `js/record.js`, `js/recordview.js` | a project's record (design-research/12): what its threads made (Made, Recently made on Home, ⌘K) and Since you left; the pure part, then the screen |
| `js/fileicons.js` | one resolver for every file's icon (Files, Made, the viewer, the Map, file chips): the swarm's Pierre Trees set (`js/vendor/pierre`, Apache-2.0), matched as Pierre matches; folders a Lucide line glyph |
| `js/map.js` | the Map: the folder drawn as a diagram (`/xo-projects/{p}/tree`, a level at a time), agents as cursors (from the stream's activity rows), pan and zoom, the Live · File switch with the viewer |
| `js/shells/dock.js` | shells: the dock, its tabs and list, the sidebar's toggle; what `app.js` calls |
| `js/shells/term.js` | one shell on screen: xterm.js, its WebSocket, reconnects, flow control, theme |
| `js/shells/model.js` | shells, the pure part: row words, counts, flow-control watermarks, backoff |
| `js/vendor/xterm/` | xterm.js 6.0.0 and addon-fit 0.11.0, copied byte for byte (pinned hashes in its README) |
| `js/media.js`, `css/media.css` | pictures and files on a message or a turn: single images, albums, file cards, the 16:10 fallback, dedupe of `shared_files` against a message by `made_id`, titles and names cut in the middle, pictures from the web and their link fallback |
| `js/lightbox.js` | a picture opened over the conversation: grows from its place, ← → through the conversation's pictures, Esc or swipe down to put it back, Open in Files |
| `js/shape.js` | the shape: the list of surfaces, the four layers, merge per key with a fallback per key and a problems list, versions; your layer kept on Storm (read, compare-and-set writes, conflicts, the live event) |
| `js/shapeview.js`, `css/shape.css` | Settings › Shape, the first-run question, Advanced settings, Home's order, density |
| `presets/*.json` | the presets (Build software, Make content and campaigns), served as static files until Storm serves them |

## Tests

```sh
node tests/logic.test.mjs        # pure modules; the live-data part only sends GETs through :5180
node tests/attach.test.mjs       # files on a message and the hop line; no network
node tests/shells.test.mjs       # shells' pure parts, and the vendored xterm hashes; no network
python3 tests/serve.test.py      # serve.py: the Host allowlist and the WebSocket tunnel, against fake backends
node tests/storm.test.mjs        # the stream parser and the turn store; no network
node tests/busy.test.mjs         # "Working": storm's busy, the live rule between reads, waiting on you; fake fetch and stream
node tests/turnview.test.mjs     # how a turn renders: changed-file chips, runtime notices; no network
node tests/runtimes.test.mjs     # runtimes, policy, moves and the usage-limit card; no network
node tests/files.test.mjs        # Files: which folder a view shows, where an opened file sits in it; no network
node tests/record.test.mjs       # Made and Since you left: kinds, order, groups, git words, the headline; no network
node tests/map.test.mjs          # the Map's pure parts: folders, paths, what a session touched, the diagram's layout; no network
node tests/media.test.mjs        # pictures in the conversation: fitting, albums, the fallback frame, dedupe by made_id, titles, names cut in the middle; no network
node tests/shape.test.mjs        # the shape: layers, per-key fallback, unknown keys, order, capabilities, migration, Storm's copy (a fake); no network
node tests/design-budget.test.mjs  # Plan F: sizes, weights, line heights, radii, curves and shadows come from css/tokens.css
```

Measuring the live UI (read-only; every non-GET request is aborted in the browser): `design-research/2026-11-vision/audit/tools/` (`XO_URL=http://127.0.0.1:<port>/ node capture.cjs dark|light`, `titlebar.cjs`, `hoverscan.cjs`, `states.cjs`, `boot.cjs`; `PRESET=engineering|marketing|everything` answers the first-run question).

The browser suites (Playwright) live outside the repo:
- a 59-check suite for Live, which mocks or blocks every non-GET request;
- a no-writes-on-load check.

**Never let a test send a non-GET request to a live backend.**

## History

- The classic UI this replaced is tagged `classic-ui` in git.
- The design research, the 17 concepts this UI converged from and the full session handoff are kept locally, outside git:
  - `docs/` (start with `docs/README.md`);
  - `/home/coder/xo-archive/2026-10-14/`.
