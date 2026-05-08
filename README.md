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

## License

[MIT](./LICENSE) · © 2026 W Axis Inc.
