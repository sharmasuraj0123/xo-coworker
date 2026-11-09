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
  "/api/chat/runtimes": { runtimes: [{ name: "claude_code", default: true, health: { agent: "claude_code", usable: true, why_not: null, installed: true, logged_in: true, account: "acct-test", cli_version: "1.0", pool: "claude_code:acct-test", limit: "open", resets_at: null, windows: {}, error: null, checked_at: NOW }, cli: { version: "1.0", logged_in: true, account: "acct-test", limits: {} }, features: { agent: "claude_code", cli_version: "1.0", contract_version: "1.0", features: { model: { support: "native", values: [] }, effort: { support: "native", values: [] } } } }] },
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
    // W.pins: what a chat's PATCH saved (model, effort), so the world's refresh reads it back as the server would
    if (p === "/api/chat/chats") return json({ chats: CHATS.concat(W.extraChats || []).map((c) => (W.pins && W.pins[c.id] ? { ...c, pin: { ...c.pin, ...W.pins[c.id] } } : c)) });
    if (p === "/api/chat/runtimes" && W.runtimes) return json({ runtimes: W.runtimes });
    if (STATIC[p]) return json(STATIC[p]);
    let k;
    if ((k = /^\/api\/chat\/chats\/([^/]+)\/(threads|messages|hops|made|runtime-policy)$/.exec(p))) {
      if (k[2] === "threads") return json({ threads: (W.threadsBy && W.threadsBy[k[1]]) || [] }); // W.threadsBy: server rows
      // a thread's own page (?thread=ts): W.threadPages[ts] when a case gives it (the name W.threadMsgs is
      // Conversation's own suite's); else as before
      if (k[2] === "messages" && W.threadPages && u.searchParams.get("thread")) return json({ messages: W.threadPages[u.searchParams.get("thread")] || [], next_after_seq: 0, next_before_seq: 0 });
      if (k[2] === "messages") return json({ messages: k[1] === "chat_demo" && W.messages ? W.messages : [], next_after_seq: 0, next_before_seq: 0 });
      if (k[2] === "made") return json({ made: (W.madeBy && W.madeBy[k[1]]) || (k[1] === "chat_demo" && W.made) || [], next_before: null });
      if (k[2] === "runtime-policy") return json({ space: policy, project: policy, effective: { ...policy, fallback: false } });
      if (W.hops) return W.hops(r, k[1], json);
      return json({ hops: [], next_after_seq: null, next_before_seq: null });
    }
    if (/^\/api\/chat\/chats\/[^/]+\/made\/[^/]+\/pin$/.test(p) && (m === "PUT" || m === "DELETE")) { W.pins = (W.pins || 0) + 1; return json({ pinned: m === "PUT" }); }
    if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p)) {
      if (W.modelsGate) await W.modelsGate; // the test says when the catalog answers
      // W.modelsFor(name): a runtime's catalog as the test answers it (null: the usual Claude list)
      if (W.modelsFor) { const name = decodeURIComponent(p.split("/")[4]); const b = await W.modelsFor(name); if (b) return json(b); }
      return json({ name: "claude_code", models: W.models || [
        { id: "default", name: "Default", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: true, takes_effort: true, family: null, family_default: false, description: "The CLI's own choice" },
        { id: "opus", name: "Opus", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: false, takes_effort: true, family: "opus", family_default: true, description: "For complex work" },
        { id: "sonnet", name: "Sonnet", efforts: ["low", "medium", "high"], default_effort: null, context_window: null, is_default: false, takes_effort: true, family: "sonnet", family_default: true, description: "Efficient" } ] });
    }
    if (/^\/api\/chat\/chats\/[^/]+$/.test(p) && m === "PATCH") {
      W.patches = (W.patches || 0) + 1;
      const body = JSON.parse(req.postData() || "{}");
      W.patchBodies = (W.patchBodies || []).concat([body]);
      if (W.patchGate) await W.patchGate;
      if (W.patchMode === "503") return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503);
      const id = decodeURIComponent(p.split("/").pop());
      if ("model" in body || "effort" in body) { W.pins = W.pins || {}; W.pins[id] = { ...(W.pins[id] || {}), ...("model" in body ? { model: body.model === "default" ? null : body.model } : {}), ...("effort" in body ? { effort: body.effort } : {}) }; }
      return json({});
    }
    // W.changesUnsupported: Space can't say what changed here (not a git repository): the turns' list stands in
    if (W.changesUnsupported && /^\/api\/xo-projects\/[^/]+\/changes$/.test(p)) return json({ detail: { code: "not_a_repository", message: "Not a git repository" } }, 404);
    if (/^\/api\/xo-projects\/[^/]+\/changes$/.test(p)) {
      // W.changes: [{path, status, additions, deletions, patch | patch_omitted: "response_budget" + full}]; a file
      // sent without its patch is read on its own (?path=), held by W.changesGate when the test says
      const all = W.changes || [], one = u.searchParams.get("path");
      const head = { project_id: "demo", worktree: null, root: "/demo", base_ref: "HEAD", base_commit: "c0", base_source: "head", head_commit: "c0", computed_at: NOW, truncated: false };
      // W.changesGateFor[path]: one file's own read held (the test says when it answers)
      // W.changeReads[path]: how many times one file's change was read; W.changesFailFor[path]: refused that many times
      if (one) { W.changeReads = W.changeReads || {}; W.changeReads[one] = (W.changeReads[one] || 0) + 1; if (W.changesGate) await W.changesGate; if (W.changesGateFor && W.changesGateFor[one]) await W.changesGateFor[one]; if (W.changesFailFor && W.changesFailFor[one] > 0) { W.changesFailFor[one]--; return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503); } return json({ ...head, total_files: 1, files: all.filter((f) => f.path === one).map(({ full, ...f }) => ({ ...f, patch: full || f.patch, patch_omitted: null })) }); }
      return json({ ...head, total_files: all.length, files: all.map(({ full, ...f }) => f) });
    }
    // a clone Space runs: started at once, running until stopped; W.cloneStopMode "503" refuses the stop
    // each clone its own id (clone-1, clone-2 …); W.cloneDone: ids that have finished; W.cloneStopGates[id]: a held
    // Stop for that clone
    if (p === "/api/xo-projects" && m === "POST") { W.cloneN = (W.cloneN || 0) + 1; return json({ clone_id: `clone-${W.cloneN}` }, 202); }
    if ((k = /^\/api\/xo-projects\/clones\/([^/]+)$/.exec(p))) {
      const id = decodeURIComponent(k[1]);
      if (m === "DELETE") {
        W.cloneStops = (W.cloneStops || 0) + 1;
        if (W.cloneStopGates && W.cloneStopGates[id]) await W.cloneStopGates[id];
        return W.cloneStopMode === "503" ? json({ detail: { code: "unavailable", message: `Fixture unavailable (${id})` } }, 503) : json({ cancelled: true });
      }
      if (W.cloneDone && W.cloneDone.has(id)) return json({ state: "done", phase: "done", percent: 100, received_bytes: 2048, idle_seconds: 0 });
      return json({ state: "running", phase: "receiving", percent: 12, received_bytes: 1024, idle_seconds: 0 });
    }
    if (/^\/api\/xo-projects\/[^/]+\/tree$/.test(p)) {
      const rel = u.searchParams.get("relative_path") || "";
      if (!rel && W.rootFails) { W.rootFails--; return json({ detail: { code: "unavailable", message: "Fixture offline" } }, 503); }
      if (!rel && W.rootGate) await W.rootGate;
      if (!rel && W.rootEmpty) return json({ dirs: [], files: [] });
      if (rel === "bad" && W.treeFails) { W.treeFails--; return json({ detail: { code: "unavailable", message: "Fixture offline" } }, 503); }
      if (rel === "bad" && W.treeGate) await W.treeGate; // the test says when the second read answers
      if (rel === "bad") return json({ dirs: [], files: [{ name: "inside.md", relative_path: "bad/inside.md", size_bytes: 9 }] });
      // W.dirs: more folders at the top (a wide map), each empty
      if (W.dirs && W.dirs.includes(rel)) return json({ dirs: [], files: [] });
      return json({ dirs: [{ name: "bad", relative_path: "bad" }, ...(W.dirs || []).map((d) => ({ name: d, relative_path: d }))], files: Object.keys(W.files).filter((f) => !f.includes("/")).map((f) => ({ name: f, relative_path: f, size_bytes: W.files[f].content.length })) });
    }
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "GET") {
      const rel = u.searchParams.get("relative_path"), f = W.files[rel];
      if (W.fileGate && !u.searchParams.get("purpose")) await W.fileGate; // the test says when a read answers
      if (!f) return json({ detail: { code: "not_found", message: "No such file" } }, 404);
      // Edit's own read (the whole file, its version): held by W.editGate, refused W.editReadFails times
      if (u.searchParams.get("purpose") === "edit") {
        if (W.editGate) await W.editGate;
        // per file: W.editGateFor[rel] holds that file's edit read; W.editStatusFor[rel] answers it with that status
        if (W.editGateFor && W.editGateFor[rel]) await W.editGateFor[rel];
        if (W.editStatusFor && W.editStatusFor[rel]) return json({ detail: { code: W.editStatusFor[rel] === 413 ? "too_large" : "unavailable", message: "Fixture" } }, W.editStatusFor[rel]);
        if (W.editReadFails) { W.editReadFails--; return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503); }
      }
      return json({ kind: "code", name: rel, content: f.content, version: f.version, editable: true, size_bytes: f.content.length, place: "ordinary" });
    }
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "PUT") {
      const b = JSON.parse(req.postData() || "{}");
      W.saves.push(b);
      if (W.saveDelay) await new Promise((ok) => setTimeout(ok, W.saveDelay));
      if (W.saveGate) await W.saveGate; // the test says when the answer comes (no race with a slow machine)
      // a save with no version makes the file (Files' New file)
      const f = W.files[b.relative_path] || (W.files[b.relative_path] = { content: "", version: null });
      if (W.saveMode === "503") return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503);
      if (W.saveMode === "confirm" && b.confirm !== "runs_code") return json({ detail: { code: "confirm_required", message: "This file runs code" } }, 428);
      if (W.saveMode === "overlap" && !W.clashed) {
        W.clashed = true; f.content = W.agentText || "agent\ntwo\nthree\n"; f.version = "sha256:B";
        return json({ detail: { code: "file_changed", message: "changed", current: { content: f.content, version: f.version } } }, 409);
      }
      f.content = b.content; f.version = `sha256:saved${W.saves.length}`;
      return json({ version: f.version, edit_id: `edit-${W.saves.length}`, saved_at: new Date().toISOString() });
    }
    // a picture a thread made: the app's own mark stands in for it (W.pictures: answer image reads)
    if (W.pictures && /^\/api\/xo-projects\/[^/]+\/image$/.test(p)) return r.fulfill({ status: 200, contentType: "image/svg+xml", body: W.pictures });
    if (/^\/api\/xo-projects\/[^/]+\/download$/.test(p)) {
      const f = W.files[u.searchParams.get("relative_path")];
      W.downloads = (W.downloads || 0) + 1;
      if (W.downloadGate) await W.downloadGate;
      return f ? r.fulfill({ status: 200, contentType: "application/octet-stream", body: f.content }) : json({ detail: { code: "not_found", message: "No such file" } }, 404);
    }
    if (/^\/api\/xo-projects\/[^/]+\/edits\/[^/]+\/undo$/.test(p) && m === "POST") {
      W.undos = (W.undos || 0) + 1;
      return W.undoMode === "503" ? json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503) : json({ undone: true });
    }
    if ((k = /^\/api\/chat\/sessions\/([^/]+)\/runs$/.exec(p))) {
      const sid = decodeURIComponent(k[1]);
      if (W.runsGate && W.runsGate[sid]) await W.runsGate[sid];
      if (W.runsFail && W.runsFail[sid]) return json({ detail: { code: "unavailable", message: "Fixture offline" } }, 503);
      return json((W.runs && W.runs[sid]) || { runs: [], counts: {} });
    }
    if ((k = /^\/api\/chat\/runs\/([^/]+)\/stop$/.exec(p)) && m === "POST") { W.runStops = (W.runStops || 0) + 1; return json({ stopping: [k[1]] }); }
    if (p === "/api/config/workspace") return json({ roots: { home: "/home/test" }, default: "home" });
    if (p === "/api/files/mkdir" && m === "POST") {
      W.creates = (W.creates || 0) + 1;
      if (W.createGate) await W.createGate;
      if (W.createMode === "503") return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503);
      const b = JSON.parse(req.postData() || "{}"), id = String(b.path || "").split("/").pop();
      W.extraChats = (W.extraChats || []).concat(chat(`chat_${id}`, "project", id)); // this test's world only
      return json({ created: true, path: b.path });
    }
    if (p === "/api/connectors/github/status") return json({ status: "needs_auth" });
    if (p === "/api/connectors/github/cli/start" && m === "POST") {
      W.ghStarts = (W.ghStarts || 0) + 1;
      if (W.ghGate) await W.ghGate;
      return W.ghMode === "connected" ? json({ status: "connected", username: "tester" }) : json({ detail: { code: "unavailable", message: "GitHub didn't answer" } }, 503);
    }
    // continuing a thread on another runtime: held by W.continueGate, then refused (409 still_busy)
    if (/^\/api\/chat\/chats\/[^/]+\/threads\/[^/]+\/continue$/.test(p) && m === "POST") {
      W.continues = (W.continues || []).concat([JSON.parse(req.postData() || "{}")]);
      if (W.continueGate) await W.continueGate;
      return json({ detail: { code: "still_busy", message: "The thread didn't stop in time" } }, 409);
    }
    if (m !== "GET") return r.abort(); // a write this world doesn't know: never sent
    return json({ detail: { code: "not_found", message: "not in the test world" } }, 404);
  };
}

// test hooks, added to the served modules in the page only (the files on disk are untouched)
async function hooks(page) {
  await page.route("**/js/app.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()) + "\nwindow.__t={VW,S,world,go,typingRender,lrefRender,render,D,openRuns,IQ,heraldShow,CHG};" }); });
  await page.route("**/js/viewer.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("function startEdit() {", "function startEdit() { window.__ED=ED; window.__V=V;") }); });
  await page.route("**/js/storm.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("  boot();", "  window.__storm={apply,stop:()=>{stream?.close();clearTimeout(statusT);clearTimeout(runtimesT);clearTimeout(recoverT);}};\n  boot();") }); });
}

/** The app in a new browser context, against the mock world W (files, saves, messages, hops …). */
// theme: set on every load only when asked for; otherwise the page keeps what's stored (a suite that stores its own
// theme and reloads, as Settings' does, keeps it: an always-on default put dark back on each reload)
async function openApp(browser, BASE, W = {}, { width = 1440, height = 900, motion = false, theme = null } = {}) {
  Object.assign(W, { base: BASE, files: W.files || {}, saves: [] });
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: motion ? "no-preference" : "reduce" });
  // test-time only: every time focus falls to the page because the control that had it was removed or hidden,
  // it's recorded; done() fails the test on any (the app itself has no runtime focus restorer: this finds the bugs)
  if (theme) await ctx.addInitScript((theme) => { try { localStorage.setItem("cv-theme", theme); } catch { /* none */ } }, theme);
  await ctx.addInitScript(() => {
    window.__focusDrops = [];
    let last = null;
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}${a.value ? "=" + a.value : ""}]`).join("")} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)}"`;
    addEventListener("DOMContentLoaded", () => {
      document.addEventListener("focusin", (e) => { if (e.target !== document.body) last = e.target; }, true);
      // a blur on purpose (a click on the page, el.blur()) leaves the control where it was: not a drop. Judged a
      // microtask later: Chrome fires focusout for a removed node while it's still connected (Launchpad & Shell
      // thread's finding: judged at once, every removal looked like a deliberate blur and no drop was recorded)
      document.addEventListener("focusout", (e) => { const t = e.target; queueMicrotask(() => { if (last === t && t.isConnected && t.getClientRects().length) last = null; }); }, true);
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
module.exports = { ROOT, SSE, serve, NOW, CHATS, STATIC, mockApi, hooks, openApp, launch, LP, chat };
