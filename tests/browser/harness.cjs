// The browser suite's world: the app served from this folder by a small static server, and every /api request
// answered in the page from a mock world (a Workspace and one project, "demo"). Nothing reaches a Space.
// Used by tests/browser/flows.test.cjs and design-research/2026-11-lg/tools/inventory-states.cjs.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { install: installLaunchpad, SCENARIOS: LP } = require("../../design-research/2026-11-vision/launchpad/tools/mockspace.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".wasm": "application/wasm", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
// a stream the test writes to as it goes (Launchpad's /watch, routed here): SSE.push(event, end)
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

// ── the mock world: a Workspace, one project ("demo"), no threads; files and saves per test ──
const NOW = new Date().toISOString();
const chat = (id, kind, project) => ({ id, kind, project, project_pid: project ? `pid_${project}` : null, created_at: NOW, settings: {}, retired_at: null, routing: null, pin: { agent: null, model: null, effort: null }, seen: null });
const CHATS = [chat("chat_ws", "workspace", null), chat("chat_demo", "project", "demo")];
const policy = { allowed: null, default: null, preferences: null, fallback: null };
const STATIC = {
  "/api/chat/chats": { chats: CHATS },
  "/api/chat/status": { sessions: { by_state: { cold: 0, running: 0, warm: 0 }, live: 0, warm: 0, released: 0, parked: 0, held_back: [], paused: {}, store_failed: [], backing_off: {}, waiting_for_decision: {} }, queue: { by_priority: { now: 0, next: 0, later: 0 }, by_pool: {}, waiting: {} }, pools: [] },
  "/api/chat/shape": { shape: { shape: 1, preset: "everything" }, version: "test", updated_at: NOW },
  "/api/terminal/status": { enabled: false, reason: "off in tests", max_sessions: 0, detached_ttl_seconds: 0, running: 0, attached: 0 },
  "/api/terminal/sessions": { terminals: [] },
  "/api/chat/sessions": { sessions: [], next_after_seq: null },
  "/api/chat/review": { items: [], next_after_seq: null },
  "/api/chat/runtimes": { runtimes: [] },
  "/api/chat/runtime-policy": { space: policy, effective: { ...policy, fallback: false } },
  "/api/chat/router": { mode: "agent", decision_model: null, abstain_below: 0.5 },
};
function mockApi(W) {
  return async (r) => {
    const req = r.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    if (u.origin !== W.base) return r.abort();
    if (!p.startsWith("/api/")) return r.fallback();
    const json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
    if (p.startsWith("/api/deploy/")) return W.launchpad ? (W.onDeploy ? W.onDeploy(r, m, p) : r.fallback()) : json({ detail: { code: "not_found", message: "no deploys in tests" } }, 404);
    if (p === "/api/chat/stream") return r.fulfill({ status: 200, contentType: "text/event-stream", body: "retry: 600000\n\n" });
    if (STATIC[p]) return json(STATIC[p]);
    let k;
    if ((k = /^\/api\/chat\/chats\/([^/]+)\/(threads|messages|hops|made|runtime-policy)$/.exec(p))) {
      if (k[2] === "threads") return json({ threads: [] });
      if (k[2] === "messages") return json({ messages: k[1] === "chat_demo" && W.messages ? W.messages : [], next_after_seq: 0, next_before_seq: 0 });
      if (k[2] === "made") return json({ made: [], next_before: null });
      if (k[2] === "runtime-policy") return json({ space: policy, project: policy, effective: { ...policy, fallback: false } });
      if (W.hops) return W.hops(r, k[1], json);
      return json({ hops: [], next_after_seq: null, next_before_seq: null });
    }
    if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p)) return json({ name: "claude_code", models: [] });
    if (/^\/api\/xo-projects\/[^/]+\/changes$/.test(p)) return json({ project_id: "demo", worktree: null, root: "/demo", base_ref: "HEAD", base_commit: "c0", base_source: "head", head_commit: "c0", computed_at: NOW, truncated: false, total_files: 0, files: [] });
    if (/^\/api\/xo-projects\/[^/]+\/tree$/.test(p)) {
      const rel = u.searchParams.get("relative_path") || "";
      if (rel === "bad" && W.treeFails) { W.treeFails--; return json({ detail: { code: "unavailable", message: "Fixture offline" } }, 503); }
      if (rel === "bad" && W.treeGate) await W.treeGate; // the test says when the second read answers
      if (rel === "bad") return json({ dirs: [], files: [{ name: "inside.md", relative_path: "bad/inside.md", size_bytes: 9 }] });
      return json({ dirs: [{ name: "bad", relative_path: "bad" }], files: Object.keys(W.files).filter((f) => !f.includes("/")).map((f) => ({ name: f, relative_path: f, size_bytes: W.files[f].content.length })) });
    }
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "GET") {
      const rel = u.searchParams.get("relative_path"), f = W.files[rel];
      if (!f) return json({ detail: { code: "not_found", message: "No such file" } }, 404);
      return json({ kind: "code", name: rel, content: f.content, version: f.version, editable: true, size_bytes: f.content.length, place: "ordinary" });
    }
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "PUT") {
      const b = JSON.parse(req.postData() || "{}");
      W.saves.push(b);
      if (W.saveDelay) await new Promise((ok) => setTimeout(ok, W.saveDelay));
      if (W.saveGate) await W.saveGate; // the test says when the answer comes (no race with a slow machine)
      const f = W.files[b.relative_path];
      if (W.saveMode === "503") return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503);
      if (W.saveMode === "confirm" && b.confirm !== "runs_code") return json({ detail: { code: "confirm_required", message: "This file runs code" } }, 428);
      if (W.saveMode === "overlap" && !W.clashed) {
        W.clashed = true; f.content = "agent\ntwo\nthree\n"; f.version = "sha256:B";
        return json({ detail: { code: "file_changed", message: "changed", current: { content: f.content, version: f.version } } }, 409);
      }
      f.content = b.content; f.version = `sha256:saved${W.saves.length}`;
      return json({ version: f.version, edit_id: `edit-${W.saves.length}`, saved_at: new Date().toISOString() });
    }
    if (/^\/api\/xo-projects\/[^/]+\/edits\/[^/]+\/undo$/.test(p) && m === "POST") {
      W.undos = (W.undos || 0) + 1;
      return W.undoMode === "503" ? json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503) : json({ undone: true });
    }
    if (m !== "GET") return r.abort(); // a write this world doesn't know: never sent
    return json({ detail: { code: "not_found", message: "not in the test world" } }, 404);
  };
}

// test hooks, added to the served modules in the page only (the files on disk are untouched)
async function hooks(page) {
  await page.route("**/js/app.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()) + "\nwindow.__t={VW,S,world,go,typingRender,lrefRender,render};" }); });
  await page.route("**/js/viewer.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("function startEdit() {", "function startEdit() { window.__ED=ED; window.__V=V;") }); });
  await page.route("**/js/storm.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("  boot();", "  window.__storm={apply,stop:()=>{stream?.close();clearTimeout(statusT);clearTimeout(runtimesT);clearTimeout(recoverT);}};\n  boot();") }); });
}

/** The app in a new browser context, against the mock world W (files, saves, messages, hops …). */
async function openApp(browser, BASE, W = {}, { width = 1440, height = 900, motion = false } = {}) {
  Object.assign(W, { base: BASE, files: W.files || {}, saves: [] });
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: motion ? "no-preference" : "reduce" });
  // test-time only: every time focus falls to the page because the control that had it was removed or hidden,
  // it's recorded; done() fails the test on any (the app itself has no runtime focus restorer: this finds the bugs)
  await ctx.addInitScript(() => {
    window.__focusDrops = [];
    let last = null;
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}${a.value ? "=" + a.value : ""}]`).join("")} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)}"`;
    addEventListener("DOMContentLoaded", () => {
      document.addEventListener("focusin", (e) => { if (e.target !== document.body) last = e.target; }, true);
      // a blur on purpose (a click on the page, el.blur()) leaves the control where it was: not a drop
      document.addEventListener("focusout", (e) => { const t = e.target; if (last === t && t.isConnected && t.getClientRects().length) last = null; }, true);
      const check = () => {
        const a = document.activeElement;
        if ((!a || a === document.body) && last && (!last.isConnected || !last.getClientRects().length)) { window.__focusDrops.push(name(last)); last = null; }
      };
      new MutationObserver(() => queueMicrotask(check)).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "inert", "style"] });
    });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (W.launchpad) await installLaunchpad(page, W.launchpad);
  await page.route("**/*", mockApi(W));
  await hooks(page);
  // a loaded machine (other threads' crawls) can make a first load slow: that isn't what's being tested
  await page.goto(BASE + "/", { timeout: 30000 });
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached", timeout: 30000 });
  page.errors = errors;
  page.W = W;
  return page;
}
/** Playwright's Chromium, else a headless shell already downloaded (CHROMIUM_PATH names one); null if none starts. */
async function launch(chromium) {
  const shells = () => { const d = path.join(require("os").homedir(), ".cache/ms-playwright"); try { return fs.readdirSync(d).filter((x) => x.startsWith("chromium_headless_shell-")).sort().reverse().map((x) => path.join(d, x, "chrome-headless-shell-linux64/chrome-headless-shell")).filter((f) => fs.existsSync(f)); } catch { return []; } };
  try { return await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); }
  catch { const alt = shells()[0]; return alt ? chromium.launch({ executablePath: alt }).catch(() => null) : null; }
}
module.exports = { ROOT, SSE, serve, NOW, CHATS, STATIC, mockApi, hooks, openApp, launch, LP };
