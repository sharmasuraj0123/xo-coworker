<div align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="XO Coworker" />

  # XO Coworker

  **A professional-grade chat UI for the XO Coworker agent runtime.**

  Next.js 15 · React 19 · TypeScript · Tailwind 4 · Tauri 2

  <sub>Inspired by LibreChat. Powered by xo-coworker-api.</sub>
</div>

---

## What is this?

XO Coworker is the chat surface for an AI agent workspace. It connects to a local `xo-coworker-api` and gives you a polished interface for running AI agents: real-time SSE streaming, rich artifacts (PDF, XLSX, DOCX, PPTX, mermaid, charts), workspace + activity panels, BYOK provider keys, multi-language support (EN/ZH), and an optional desktop build via Tauri.

Same UI runs three ways:

- **Web** — `npm run dev` and open the browser.
- **Desktop (Tauri)** — packaged native app that talks to a local backend.
- **Mobile (PWA)** — pair via QR code from desktop, control your agent from your phone over a Cloudflare tunnel.

## Quick Start

```bash
npm install --legacy-peer-deps
npm run dev
```

Open <http://localhost:3000>.

> The frontend expects `xo-coworker-api` running on `http://localhost:5002`. Override with `NEXT_PUBLIC_API_URL` if your backend lives elsewhere.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start Next.js dev server with Turbopack on port 3000 |
| `npm run build` | Production build (also copies the bundled `pdf.worker.min.mjs`) |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint check |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | `xo-coworker-api` base URL (serves `/api/*` and `/health`) | `http://localhost:5002` |
| `NEXT_PUBLIC_XO_COWORKER_API_URL` | Backend base URL used by desktop/remote-PWA direct calls (`/gateway/*`, `/codex/*`). Normally identical to `NEXT_PUBLIC_API_URL`. | `http://localhost:5002` |
| `DESKTOP_BUILD` | Set to `true` to produce a static export for Tauri packaging | unset |

## OpenClaw Gateway Configuration

Make sure your `~/.openclaw/openclaw.json` includes the following `gateway.http` block:

```json
"gateway": {
  "mode": "local",
  "controlUi": {
    "dangerouslyDisableDeviceAuth": true,
    "allowedOrigins": [
      "..."
    ]
  },
  "http": {
    "endpoints": {
      "chatCompletions": {
        "enabled": true
      },
      "responses": {
        "enabled": true
      }
    }
  }
}
```

> **Important:** The `http.endpoints` section above is essential. You must explicitly enable `chatCompletions` and `responses` — without these, the OpenClaw HTTP API endpoints will not be available and the bridge will fail to connect.

## Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | Next.js 15 (App Router + Turbopack), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix), MUI 7 |
| State | Zustand (client) + TanStack Query (server) |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Rich content | Mermaid, Recharts, react-pdf, docx-preview, xlsx, pptx-renderer |
| Animation | Framer Motion |
| i18n | i18next + react-i18next (EN, ZH) |
| Theming | next-themes (dark / light / system) |
| Desktop | `@tauri-apps/api` 2 |

## Project Layout

```
.
├── public/                      Static assets (favicon, manifest, vendor pdf.worker)
├── src/
│   ├── app/                     Next.js App Router
│   │   ├── (main)/              Desktop shell: chat, settings, automations, plugins, remote
│   │   └── (mobile)/            Mobile PWA: paired remote control
│   ├── components/              UI components: chat, activity, artifacts, settings, layout, ...
│   ├── hooks/                   Custom React hooks (useChat, useUpdateCheck, useMermaid, ...)
│   ├── i18n/                    i18next config + EN/ZH locale bundles
│   ├── lib/                     API client, constants, codex device-auth, remote connection
│   └── stores/                  Zustand stores (settings, sessions, artifacts, ...)
├── canvas-stub/                 No-op shim for the Node-only `canvas` module
├── next.config.ts               API rewrites + Tauri static-export toggle
├── package.json
└── ARCHITECTURE.md              Deep dive: routing, state, SSE flow, components
```

## Architecture at a Glance

```
Browser  ──▶  Next.js (this app)  ──/api/*──▶  xo-coworker-api (FastAPI, :5002)
                       ▲                              │
                       │                              ▼
              SSE chat streaming               Local agent runtimes
              (codex / claude-code)             (Codex, Claude Code, OpenClaw)
```

The web app proxies `/api/*` and `/health` through Next.js rewrites; desktop and remote-PWA builds skip the proxy and call the backend directly via `XO_COWORKER_API_BASE`. See [ARCHITECTURE.md](./ARCHITECTURE.md) for routing layout, state management, SSE data flow, and component details.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — full architecture deep dive (routing, state, SSE, components, theming).

## Project Section (Sidebar File Explorer)

The **Project Section** is the collapsible file tree in the left sidebar. It lets users browse and open files from the server filesystem directly inside the chat UI. It is not a "project management" feature — there are no project entities, IDs, or CRUD operations. The name comes from the UI label on the sidebar toggle button.

---

### Front-end layout

The sidebar is rendered by `frontend/src/components/layout/sidebar.tsx` and is only visible on desktop-width viewports (lg+). Its stacking order from top to bottom is:

```
Sidebar
├── SidebarHeader       ← logo / collapse button
├── SidebarNav          ← top-level navigation links
├── ProjectExplorer     ← collapsible file tree  ← this section
├── AgentsExplorer      ← agent shortcuts
└── SidebarFooter       ← settings, user info
```

`ProjectExplorer` (`frontend/src/components/layout/project-explorer.tsx`) is composed of three pieces:

| Component | Responsibility |
|-----------|---------------|
| `ProjectExplorer` | Root toggle button labeled "Project". On first expand it fetches `/home/coder` as the tree root. Renders up to 280 px of scrollable content. |
| `FolderNode` | Recursive component for each directory. Lazy-loads children on first expand via `POST /api/files/list-directory`. Maintains its own `isOpen`, `loading`, and `children` state with `useState`. |
| `FileNode` | Leaf node for each file. Clicking it resolves the artifact type from the file extension and calls `useArtifactStore.getState().openArtifact(...)`, which opens the file in the right-side artifact panel. |

**State management** is intentionally local — no global store is involved in the tree expand/collapse logic. The only global side-effect of clicking a file is writing to `useArtifactStore` (Zustand) so the artifact panel can render the file content.

**Hard-coded root:** The tree always seeds from `/home/coder/.openclaw/workspace`. It is not wired to any workspace setting or session directory.

---

### Front-end ↔ bridge communication

All HTTP calls use the thin `fetch` wrapper at `frontend/src/lib/api.ts`.

```
frontend (fetch)  →  Next.js rewrite (/api/* → http://localhost:8000)  →  bridge (FastAPI)
```

- **Web mode** — Next.js rewrites all `/api/*` requests to the bridge URL (default `http://localhost:8000`), configured in `frontend/next.config.ts`.
- **Desktop (Tauri)** — `api.ts` resolves the backend URL dynamically via `getBackendUrl()` instead of relying on the Next.js proxy.
- **Remote tunnel** — `getRemoteConfig()` prepends the tunnel URL and injects `Authorization: Bearer <token>` on every request.
- **No WebSockets** are used for file operations. All file API calls are standard request/response `POST`.

The `api.post<T>(url, body)` helper sets `Content-Type: application/json`, serialises the body, and returns the parsed JSON response. Network errors (connection refused / reset) are retried up to three times with exponential back-off.

---

### Endpoints required to render the Project Section

#### `POST /api/files/list-directory`

Lists the contents of a directory. Called on every expand of `ProjectExplorer` (root) and `FolderNode` (subdirectories).

**Request body:**

```json
{ "path": "/home/coder/some/directory" }
```

Passing `null` or omitting `path` defaults to the user's home directory.

**Response:**

```json
{
  "path": "/home/coder/some/directory",
  "parent": "/home/coder/some",
  "dirs":  [{ "name": "subdir", "path": "/home/coder/some/directory/subdir" }],
  "files": [{ "name": "file.py", "path": "/home/coder/some/directory/file.py" }]
}
```

The bridge sorts entries so directories come before files (alphabetically within each group) and restricts traversal to paths under `Path.home()` (returns HTTP 403 otherwise).

#### `POST /api/files/content`

Reads the text content of a file. Called by `FilePreviewRenderer` after a file is opened from the tree.

**Request body:**

```json
{ "path": "/home/coder/some/directory/file.py" }
```

**Response:**

```json
{ "content": "...file text...", "path": "/home/coder/some/directory/file.py" }
```

Same home-directory restriction applies (HTTP 403 for paths outside it). Binary files should use `POST /api/files/content-binary` instead, which returns a `FileResponse` download; the front-end selects the correct endpoint based on the file extension via `artifactTypeFromExtension`.

---

### End-to-end flow summary

1. User clicks the **"Project"** toggle in the sidebar.
2. `ProjectExplorer.toggle()` fires `POST /api/files/list-directory` with `path: "/home/coder"`.
3. The bridge returns `{ dirs, files }` for that path.
4. The tree renders `FolderNode` entries for each directory and `FileNode` entries for each file.
5. User expands a folder → `FolderNode.toggle()` fires another `POST /api/files/list-directory` for that folder's path (result cached in component state).
6. User clicks a file → `FileNode.handleClick()` calls `useArtifactStore.getState().openArtifact(...)`.
7. The artifact panel mounts `FilePreviewRenderer`, which fires `POST /api/files/content` to load the file text and renders it with syntax highlighting.

## License

[MIT](./LICENSE) · © 2026 W Axis Inc.
