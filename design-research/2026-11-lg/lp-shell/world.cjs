// A self-contained world for Launchpad and the Shells dock: the app served from this worktree by a small
// static server, every /api request answered in the page (a Workspace, one project "demo" with one thread),
// Launchpad's routes by design-research's mockspace (one scenario per page), and the shells' REST routes and
// WebSocket mocked here. Nothing reaches a Space; nothing is written anywhere.
//
//   const W = require("./world.cjs");
//   const { browser, base, close } = await W.start();
//   const page = await W.open(browser, base, { width: 1440, theme: "dark", launchpad: "ready", shells: true });
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");

const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
const { chromium } = require(PW);
const EXE = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const { install: installLaunchpad, SCENARIOS } = require("../../2026-11-vision/launchpad/tools/mockspace.cjs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".wasm": "application/wasm", ".ico": "image/x-icon" };
// a stream a test writes to as it goes (Launchpad's /watch, routed here): SSE.push(event, end)
const SSE = { clients: [], head: [], push(ev, end = false) { for (const c of this.clients) { c.write(`data: ${JSON.stringify(ev)}\n\n`); if (end) c.end(); } if (end) this.clients = []; } };

function serve() {
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p === "/__sse") {
      s.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
      for (const ev of SSE.head) s.write(`data: ${JSON.stringify(ev)}\n\n`);
      SSE.clients.push(s); q.on("close", () => { SSE.clients = SSE.clients.filter((c) => c !== s); });
      return;
    }
    if (p === "/") p = "/index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(s);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const NOW = new Date().toISOString();
const chat = (id, kind, project) => ({ id, kind, project, project_pid: project ? `pid_${project}` : null, created_at: NOW, settings: {}, retired_at: null, routing: null, pin: { agent: null, model: null, effort: null }, seen: null });
const CHATS = [chat("chat_ws", "workspace", null), chat("chat_demo", "project", "demo")];
const THREAD = { ts: "t_demo", chat_id: "chat_demo", title: "Tighten the billing retries", state: "active", created_at: NOW, updated_at: NOW, status_md: "- [x] Read the retry code\n- [ ] Cap the backoff", branch: "xo/thread-demo", worktree_path: "/home/coder/demo/.xo/worktrees/thread-demo" };
const policy = { allowed: null, default: null, preferences: null, fallback: null };
const STATIC = {
  "/api/chat/chats": { chats: CHATS },
  "/api/chat/status": { sessions: { by_state: { cold: 0, running: 0, warm: 0 }, live: 0, warm: 0, released: 0, parked: 0, held_back: [], paused: {}, store_failed: [], backing_off: {}, waiting_for_decision: {} }, queue: { by_priority: { now: 0, next: 0, later: 0 }, by_pool: {}, waiting: {} }, pools: [] },
  "/api/chat/shape": { shape: { shape: 1, preset: "everything" }, version: "test", updated_at: NOW },
  "/api/chat/sessions": { sessions: [], next_after_seq: null },
  "/api/chat/review": { items: [], next_after_seq: null },
  "/api/chat/runtimes": { runtimes: [] },
  "/api/chat/runtime-policy": { space: policy, effective: { ...policy, fallback: false } },
  "/api/chat/router": { mode: "agent", decision_model: null, abstain_below: 0.5 },
};

// ── shells: the backend's T, in memory per page ──
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const term = (o) => ({ id: "sh_1", name: "demo", scope: "project", project: "demo", path: "/home/coder/demo", cwd: "/home/coder/demo", status: "running", exit_code: null, ended_reason: null, foreground: "bash", viewers: 0, created_at: ago(40 * 60e3), detached_since: ago(12 * 60e3), closes_at: new Date(Date.now() + 22 * 3600e3).toISOString(), ended_at: null, ...o });
const SHELL_SETS = {
  none: () => [],
  some: () => [
    term({ id: "sh_1", name: "demo", foreground: "npm", viewers: 0 }),
    term({ id: "sh_2", name: "Workspace", scope: "workspace", project: null, path: "/home/coder", cwd: "/home/coder", detached_since: ago(2 * 3600e3) }),
    term({ id: "sh_3", name: "Tighten the billing retries", path: THREAD.worktree_path, cwd: THREAD.worktree_path, foreground: "bash", viewers: 0, detached_since: ago(3 * 60e3) }),
    term({ id: "sh_4", name: "tests", status: "exited", exit_code: 1, foreground: null, viewers: 0, ended_at: ago(9 * 60e3) }),
  ],
};
// what a shell prints when it attaches: a prompt and a little colour, as bash would
const BANNER = "\x1b[2m# replayed output\x1b[0m\r\n\x1b[1;32mcoder@xo\x1b[0m:\x1b[1;34m~/demo\x1b[0m (\x1b[33mmain\x1b[0m) $ git status --short\r\n \x1b[31mM\x1b[0m js/billing/retry.js\r\n\x1b[32m??\x1b[0m tests/retry.test.mjs\r\n\x1b[1;32mcoder@xo\x1b[0m:\x1b[1;34m~/demo\x1b[0m (\x1b[33mmain\x1b[0m) $ npm test\r\n\r\n> demo@1.0.0 test\r\n> node --test\r\n\r\n\x1b[32m✔\x1b[0m retries back off (12ms)\r\n\x1b[32m✔\x1b[0m caps at 15 s (3ms)\r\n\x1b[1;32mcoder@xo\x1b[0m:\x1b[1;34m~/demo\x1b[0m (\x1b[33mmain\x1b[0m) $ ";

function mockApi(W) {
  return async (r) => {
    const req = r.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    if (u.origin !== W.base) return r.abort();
    if (!p.startsWith("/api/")) return r.fallback();
    const json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
    // a test's own answer first: it answers through the json it's handed (then nothing else does), or returns
    if (W.api) { let took = false; await W.api(r, m, p, (o, status) => { took = true; return json(o, status); }, u); if (took) return; }
    if (p.startsWith("/api/deploy/")) return W.launchpad ? (W.onDeploy ? W.onDeploy(r, m, p) : r.fallback()) : json({ detail: { code: "not_found", message: "no deploys here" } }, 404);
    if (p === "/api/chat/stream") return new Promise(() => {}); // held open: a live stream with nothing to say
    // shells
    if (p === "/api/terminal/status") return json(W.shells ? { enabled: true, reason: null, max_sessions: 8, detached_ttl_seconds: 86400, running: W.terms.filter((t) => t.status === "running").length, attached: 0 } : { enabled: false, reason: "off here", max_sessions: 0, detached_ttl_seconds: 0, running: 0, attached: 0 });
    if (p === "/api/terminal/sessions" && m === "GET") return W.listFail ? json({ detail: { code: "unavailable", message: W.listFail } }, 503) : json({ terminals: W.terms });
    if (p === "/api/terminal/sessions" && m === "POST") {
      if (W.createFail) return json({ detail: { code: "too_many", message: W.createFail } }, 409);
      const b = JSON.parse(req.postData() || "{}");
      const t = term({ id: `sh_n${++W.seq}`, name: b.name || "Shell", scope: b.project ? "project" : "workspace", project: b.project || null, path: b.path || (b.project ? `/home/coder/${b.project}` : "/home/coder"), cwd: b.path || (b.project ? `/home/coder/${b.project}` : "/home/coder"), viewers: 1, detached_since: null, closes_at: null, created_at: NOW });
      W.terms.push(t);
      return json({ terminal: t, ticket: "tk-" + t.id, ticket_expires_in: 30 });
    }
    let k;
    if ((k = /^\/api\/terminal\/sessions\/([^/]+)(\/attach)?$/.exec(p))) {
      const t = W.terms.find((x) => x.id === k[1]);
      if (!t) return json({ detail: { code: "terminal_not_found", message: "No such shell" } }, 404);
      if (k[2]) return json({ ticket: "tk-" + t.id, ticket_expires_in: 30 });
      if (m === "GET") return json({ terminal: t });
      if (m === "PATCH") { if (W.renameFail) return json({ detail: { code: "unavailable", message: W.renameFail } }, 503); t.name = JSON.parse(req.postData() || "{}").name; return json({ terminal: t }); }
      if (m === "DELETE") { if (W.closeFail) return json({ detail: { code: "unavailable", message: W.closeFail } }, 503); W.terms = W.terms.filter((x) => x !== t); W.closed.push(t.id); return json({ closed: true }); }
    }
    if (STATIC[p]) return json(STATIC[p]);
    if ((k = /^\/api\/chat\/chats\/([^/]+)\/(threads|messages|hops|made|runtime-policy|worktrees)$/.exec(p))) {
      if (k[2] === "threads") return json({ threads: k[1] === "chat_demo" && W.thread !== false ? [THREAD] : [] });
      if (k[2] === "messages") return json({ messages: [], next_after_seq: 0, next_before_seq: 0 });
      if (k[2] === "made") return json({ made: [], next_before: null });
      if (k[2] === "worktrees") return json({ worktrees: [{ thread_ts: THREAD.ts, path: THREAD.worktree_path, exists: true }] });
      if (k[2] === "runtime-policy") return json({ space: policy, project: policy, effective: { ...policy, fallback: false } });
      return json({ hops: [], next_after_seq: null, next_before_seq: null });
    }
    if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p)) return json({ name: "claude_code", models: [] });
    if (/^\/api\/xo-projects\/[^/]+\/changes$/.test(p)) return json({ project_id: "demo", worktree: null, root: "/demo", base_ref: "HEAD", base_commit: "c0", base_source: "head", head_commit: "c0", computed_at: NOW, truncated: false, total_files: 0, files: [] });
    if (m !== "GET") return r.abort(); // a write this world doesn't know: never sent
    return json({ detail: { code: "not_found", message: "not in this world" } }, 404);
  };
}

/** The shells' socket: auth → ready and the banner; whatever is typed is echoed. W.ws(ws) can take over. */
async function mockSockets(page, W) {
  await page.routeWebSocket(/\/api\/terminal\/sessions\/[^/]+\/ws/, (ws) => {
    const id = decodeURIComponent(/sessions\/([^/]+)\/ws/.exec(ws.url())[1]);
    W.sockets.push({ id, ws });
    if (W.ws && W.ws(ws, id) === false) return;
    ws.onMessage((msg) => {
      if (typeof msg === "string") {
        let o; try { o = JSON.parse(msg); } catch { return; }
        if (o.type === "auth") {
          const t = W.terms.find((x) => x.id === id);
          if (!t) { ws.close({ code: 4404, reason: "This shell was closed." }); return; }
          t.viewers = (t.viewers || 0) + 1;
          ws.send(JSON.stringify({ type: "ready", terminal: t }));
          ws.send(Buffer.from(BANNER));
        }
        return;
      }
      ws.send(msg); // echo what was typed
    });
  });
}

async function start() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined });
  return { browser, base, server, close: async () => { await browser.close(); server.close(); } };
}

/**
 * A page of the app in this world. opts: width (1440), height (900), theme ("dark"), dpr (1), launchpad (a
 * mockspace scenario, or null for no deploy routes), shells (true: on), terms ("none" | "some"), motion
 * ("reduce" | "no-preference"), and any W fields (onDeploy, api, ws, createFail, …).
 */
async function open(browser, base, opts = {}) {
  const { width = 1440, height = 900, theme = "dark", dpr = 1, motion = "no-preference" } = opts;
  const phone = width <= 760;
  const W = { base, shells: true, seq: 0, sockets: [], closed: [], ...opts };
  W.terms = (SHELL_SETS[opts.terms || "none"] || SHELL_SETS.none)();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: motion, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([t]) => { try { localStorage.setItem("cv-theme", t); localStorage.removeItem("xo-stage"); localStorage.removeItem("xo-lp-state"); localStorage.removeItem("xo-shells-dock"); sessionStorage.removeItem("xo-shells"); } catch { /* */ } }, [theme]);
  // the clipboard answers as a real one would: granted (W.clip = "ok"), refused ("deny"), or absent ("none")
  await ctx.addInitScript(([mode]) => {
    window.__clip = [];
    if (mode === "none") { try { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); } catch { /* */ } return; }
    const c = { writeText: (s) => (mode === "deny" ? Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) : (window.__clip.push(String(s)), Promise.resolve())), readText: () => Promise.resolve(window.__clip.at(-1) || "") };
    try { Object.defineProperty(navigator, "clipboard", { value: c, configurable: true }); } catch { /* */ }
  }, [opts.clip || "ok"]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (W.launchpad) await installLaunchpad(page, W.launchpad);
  await page.route("**/*", mockApi(W));
  await mockSockets(page, W);
  await page.route("**/js/app.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()) + "\nwindow.__t={S,world,go};" }); });
  await page.goto(base + "/");
  await page.waitForSelector('[data-go="p:demo"]');
  page.errors = errors;
  page.W = W;
  return page;
}

const toProject = (page) => page.evaluate(() => window.__t.go("p:demo"));
const toThread = (page) => page.evaluate(() => window.__t.go("t:t_demo"));
/** The Launchpad section, open: from the header's Deploy. */
async function openLaunchpad(page, where = "project") {
  if (where === "thread") await toThread(page); else await toProject(page);
  await page.waitForSelector("[data-lp-open]");
  await page.locator("[data-lp-open]").first().click();
  await page.waitForSelector(".fr-lp .lp");
}

module.exports = { start, open, toProject, toThread, openLaunchpad, SSE, SCENARIOS, THREAD, BANNER };
