# xo-coworker

**XO Space's web UI.** It works on the XO Space projects-chat backend and is built around one idea: protect the person's attention. The screen shows what is worth their time and the next action; everything that only needs an agent stays quiet.

- **Home**: what is worth your time across every project, ranked, then what is handled.
- **Needs you**: one decision at a time, with what it unblocks and its evidence; a bottom sheet on phones.
- **Workspace, projects and threads**: the coordinator across all projects, each project's threads, and each thread's own agent, branch, checklist and decision.
- **Map** (`⌘\`): where agents are working, drawn as a diagram or a graph of the folder.
- **Changes and Files**: every file a thread changed and its diff, any file whole, asking about lines, and editing that saves only on `⌘S`.
- **Shells**: terminals in the project or a thread's worktree, when Space enables them.
- **Shape**: the UI fits the person (Build software, Make content and campaigns, or Everything), switched only by the person.

The UI is HTML, CSS and vanilla ES modules with no CDN. Development serves the source as it is; production serves a bundled release. Styles use the shared values in `core/ui/tokens.css`; the style baselines track the literal values still left.

## Quick start

```sh
python3 serve.py                 # foreground, http://127.0.0.1:5180
./start.sh --background          # detached (pid in .server.pid, log in .server.log)
./start.sh --status | --stop
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5180` | port to listen on |
| `XO_API` | `http://127.0.0.1:5002` | the XO Space API to proxy to |
| `HOST` | `127.0.0.1` | bind address |
| `XO_SERVE_RAW` | unset | `1` serves the source even when a release is built |

`serve.py` picks what it serves when it starts:

- **Release:** when `dist/current` names a built release, it serves that release from `dist/`.
- **Source:** with no `dist/`, or with `XO_SERVE_RAW=1`, it serves the source files and fingerprints them once at startup, so restart it after editing assets.

`npm ci && npm run build` writes a release to `dist/` (bundled with esbuild) and points `dist/current` at it. Production is a Docker image that runs that build at image build time and starts `serve.py` the usual way.

`serve.py` uses only the standard library. Besides the files, it:

- answers only requests addressed to it as `localhost`, an IP on its own port, or through a proxy on the same machine; anything else gets a 421, so a DNS-rebinding page never reaches the backend;
- answers only pages it served (403 otherwise), and serves only the application's public files, never the rest of the repository;
- never forwards the backend routes that expose secret values, raw files or file writes under `$HOME`, and drops the browser's `Origin`, `Referer` and `Sec-Fetch-*` headers;
- adds the server-held UI writer key (`X-XO-UI-Writer`) to requests matching `WRITER_ROUTES` in `serve.py`. These cover project file writes, thread deletion and restoration, app installation and management, and all app bridge calls;
- relays event streams unbuffered and tunnels only a shell's terminal WebSocket.

**The UI reads and writes your real XO workspace. Sending a message starts real agents.** No test may send a non-GET request to a live backend.

To work on the code, run `npm ci` once for the build and check tools, then follow [DEVELOPING.md](DEVELOPING.md). The rules for every agent and person are in [AGENTS.md](AGENTS.md).

## Layout

The app is a small kernel, layers of shared code, and modules that plug into named places. Lowest layer first:

| Folder | What lives there |
|---|---|
| `core/kernel/` | Holds modules together without knowing any feature: places, activation, undo of everything a module registers, the bus, batched redraws, the layer stack. It imports nothing. |
| `core/platform/` | Browser plumbing: requests and typed responses, streams, storage, keys, touch, time words, small helpers. |
| `core/ui/` | What every view draws with: the tokens, icons, markdown, motion, redraw in place, accessibility helpers, shared components, the lightbox. |
| `core/services/` | Shared data and runtime services for world state, Storm, Shape, paths, notices and media. Services import lower layers. Media handles DOM elements and Storm observes document visibility. |
| `shell/` | The frame around everything: boot, the rail, the right panel, the phone layout, one layer stack for Esc, Back, inert and Tab, and the catalogue of places. |
| `modules/*/` | One feature per folder, such as Files, Map, Settings or Home. |
| `apps-host/` | Paused work on installed apps, including manifests, sandboxed frames, a tool bridge and Settings integration. |
| `js/app.js` | The static list of modules enabled at boot. |
| `css/` | Styles that have not moved to their owners yet. It may only shrink. |

`index.html` loads `boot.js`, which loads the frame, then `js/app.js`, which passes the enabled feature modules to the kernel in one static list. Outside the app: `tests/` (unit tests not yet beside their code), `e2e/` (the fast browser lane), `tests/browser/` (older browser suites), `tools/` (the checks, baselines, generators and the release build), `vendor/` and `fonts/`.

Folders with a `README.md` describe their own files. [architecture/places.md](architecture/places.md) lists every place a module or an app can fill, [architecture/decisions/](architecture/decisions/) records the owner's decisions, and [architecture/HANDOFF.md](architecture/HANDOFF.md) lists what the finished modular rebuild left to do.
