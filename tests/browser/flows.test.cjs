// Browser tests for what the unit tests can't reach: the flows where timing, focus and the network meet.
//   G1  every decision path waits out the card's 300 ms re-arm; a held key (repeat) never decides anything
//   G2  a card withdrawn while you type on it hands over with the next card's letter keys paused
//   G3  a merge with a place still to choose never saves, by Ctrl/Cmd+S or the button
//   G4  a save that finishes after you opened another file only lands on the file that started it
//   G5  a hop's receipt survives a history read that left before it, and one that came before its hop
//   G6  Launchpad says a deploy stopped only once Space confirms it; a refused stop says so, with Stop again
//   G7  keyboard focus after an editor outcome: Edit after a save or a discard, Save after a failed save,
//       Keep editing for Cancel's question
//   G8  the whole-file capsule's × is named for the file, a line range's for its lines
//
// Self-contained: the app is served from this folder by a small static server, and every /api request is
// answered in the page from a mock world (the Launchpad routes by design-research's mockspace). Nothing
// reaches a Space; nothing is written anywhere.
//   node tests/browser/flows.test.cjs
// Needs Playwright's core and a Chromium: PLAYWRIGHT_CORE (default /tmp/pw/node_modules/playwright-core).
// Without them it says so and exits 2: not run is not passed.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const assert = require("assert/strict");

const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW} (set PLAYWRIGHT_CORE)`); process.exit(2); }
const { install: installLaunchpad, SCENARIOS: LP } = require("../../design-research/2026-11-vision/launchpad/tools/mockspace.cjs");

const ROOT = path.resolve(__dirname, "..", "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".wasm": "application/wasm", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
function serve() {
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
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
      if (k[2] === "messages") return json({ messages: [], next_after_seq: 0, next_before_seq: 0 });
      if (k[2] === "made") return json({ made: [], next_before: null });
      if (k[2] === "runtime-policy") return json({ space: policy, project: policy, effective: { ...policy, fallback: false } });
      if (W.hops) return W.hops(r, k[1], json);
      return json({ hops: [], next_after_seq: null, next_before_seq: null });
    }
    if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p)) return json({ name: "claude_code", models: [] });
    if (/^\/api\/xo-projects\/[^/]+\/changes$/.test(p)) return json({ project_id: "demo", worktree: null, root: "/demo", base_ref: "HEAD", base_commit: "c0", base_source: "head", head_commit: "c0", computed_at: NOW, truncated: false, total_files: 0, files: [] });
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "GET") {
      const rel = u.searchParams.get("relative_path"), f = W.files[rel];
      if (!f) return json({ detail: { code: "not_found", message: "No such file" } }, 404);
      return json({ kind: "code", name: rel, content: f.content, version: f.version, editable: true, size_bytes: f.content.length, place: "ordinary" });
    }
    if (/^\/api\/xo-projects\/[^/]+\/file$/.test(p) && m === "PUT") {
      const b = JSON.parse(req.postData() || "{}");
      W.saves.push(b);
      if (W.saveDelay) await new Promise((ok) => setTimeout(ok, W.saveDelay));
      const f = W.files[b.relative_path];
      if (W.saveMode === "503") return json({ detail: { code: "unavailable", message: "Fixture unavailable" } }, 503);
      if (W.saveMode === "overlap" && !W.clashed) {
        W.clashed = true; f.content = "agent\ntwo\nthree\n"; f.version = "sha256:B";
        return json({ detail: { code: "file_changed", message: "changed", current: { content: f.content, version: f.version } } }, 409);
      }
      f.content = b.content; f.version = `sha256:saved${W.saves.length}`;
      return json({ version: f.version, edit_id: `edit-${W.saves.length}`, saved_at: new Date().toISOString() });
    }
    if (m !== "GET") return r.abort(); // a write this world doesn't know: never sent
    return json({ detail: { code: "not_found", message: "not in the test world" } }, 404);
  };
}

// test hooks, added to the served modules in the page only (the files on disk are untouched)
async function hooks(page) {
  await page.route("**/js/app.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()) + "\nwindow.__t={VW,S,world,go,typingRender,lrefRender};" }); });
  await page.route("**/js/viewer.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("function startEdit() {", "function startEdit() { window.__ED=ED; window.__V=V;") }); });
  await page.route("**/js/storm.js", async (r) => { const x = await r.fetch(); await r.fulfill({ response: x, body: (await x.text()).replace("  boot();", "  window.__storm={apply,stop:()=>{stream?.close();clearTimeout(statusT);clearTimeout(runtimesT);clearTimeout(recoverT);}};\n  boot();") }); });
}

let browser, server, BASE, WIDTH = 1440, passed = 0, failed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
// the project's own page, as its row in the sidebar opens it (on a phone the sidebar is a drawer)
const toDemo = (page) => page.evaluate(() => window.__t.go("p:demo"));
async function app(W = {}, { width = WIDTH } = {}) {
  Object.assign(W, { base: BASE, files: W.files || {}, saves: [] });
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (W.launchpad) await installLaunchpad(page, W.launchpad);
  await page.route("**/*", mockApi(W));
  await hooks(page);
  await page.goto(BASE + "/");
  await page.waitForSelector('[data-go="p:demo"]');
  page.errors = errors;
  page.W = W;
  return page;
}
const done = async (page) => { const errs = page.errors; await page.context().close(); assert.deepEqual(errs, [], "page errors"); };

// ── the viewer's editor ───────────────────────────────────────────────────
const FILE = () => ({ content: "one\ntwo\nthree\n", version: "sha256:A" });
async function editing(page, rel = "a.js") {
  await toDemo(page);
  await page.evaluate((rel) => window.__t.VW.open({ project: "demo", rel, path: rel, name: rel }), rel);
  await page.locator("[data-vw-edit]").click();
  await page.waitForFunction(() => window.__ED && window.__ED.on && window.__ED.ed);
}
async function typeAll(page, text) {
  await page.locator("#viewer [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
  await page.waitForFunction(() => window.__ED.dirty);
}
const focusOf = (page) => page.evaluate(() => { const a = document.activeElement; return a ? [a.tagName, ...[...a.attributes].map((x) => x.name).filter((n) => n.startsWith("data-vw-"))].join(" ") : null; });

t("G3: Ctrl/Cmd+S on a merge with a place still to choose saves nothing", async () => {
  const page = await app({ files: { "a.js": FILE() }, saveMode: "overlap" });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.conflict && window.__ED.conflict.left === 1);
  await page.locator("#viewer").focus();
  await page.keyboard.press("ControlOrMeta+s");
  await page.locator("[data-vw-saveit]").click({ force: true });
  await page.waitForTimeout(300);
  assert.equal(page.W.saves.length, 1, "only the first save, the one that met the change");
  assert.ok(!/<<<<<<<|>>>>>>>/.test(page.W.files["a.js"].content), "no conflict markers written");
  assert.equal(await page.evaluate(() => window.__ED.on && window.__ED.conflict.left), 1, "still choosing");
  await done(page);
});

t("G4: a save that finishes after another file opened lands only on its own file", async () => {
  const page = await app({ files: { "a.js": FILE(), "b.js": { content: "SECOND FILE\n", version: "sha256:Z" } }, saveDelay: 500 });
  await editing(page);
  await typeAll(page, "first file saved slowly\n");
  await page.locator("[data-vw-saveit]").click();
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "b.js", path: "b.js", name: "b.js" }));
  await page.waitForTimeout(800);
  assert.equal(page.W.files["a.js"].content, "first file saved slowly\n", "a.js saved");
  assert.equal(await page.evaluate(() => window.__V.file.name), "b.js");
  assert.equal(await page.evaluate(() => window.__V.data.content), "SECOND FILE\n", "b.js shows its own text");
  assert.ok(!(await page.locator("#viewer").innerText()).includes("Saved a.js"), "no Saved/Undo for a.js on b.js");
  await done(page);
});

t("G7: focus after a keyboard save goes to Edit; a failed clicked save keeps Save; Cancel asks with Keep editing; Discard goes to Edit", async () => {
  const page = await app({ files: { "a.js": FILE() } });
  await editing(page);
  await typeAll(page, "mine\ntwo\nthree\n");
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForFunction(() => !window.__ED.on);
  assert.equal(await focusOf(page), "BUTTON data-vw-edit", "after a keyboard save");
  page.W.saveMode = "503";
  await page.locator("[data-vw-edit]").click();
  await page.waitForFunction(() => window.__ED.on && window.__ED.ed);
  await typeAll(page, "unsaved\n");
  await page.locator("[data-vw-saveit]").click();
  await page.waitForFunction(() => window.__ED.err);
  assert.equal(await focusOf(page), "BUTTON data-vw-saveit", "after a failed clicked save");
  assert.equal(await page.evaluate(() => window.__ED.ed.text()), "unsaved\n", "the text stays");
  await page.locator("[data-vw-cancel]").focus();
  await page.keyboard.press("Enter");
  assert.equal(await focusOf(page), "BUTTON data-vw-keep", "Cancel's question");
  await page.locator("[data-vw-discard]").click();
  await page.waitForFunction(() => !window.__ED.on);
  assert.equal(await focusOf(page), "BUTTON data-vw-edit", "after Discard");
  await done(page);
});

t("G8: the whole-file capsule's × is named for the file", async () => {
  const page = await app({ files: { "notes.md": { content: "# Notes\n", version: "sha256:N" } } });
  await toDemo(page);
  await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "notes.md", path: "notes.md", name: "notes.md" }));
  await page.locator("[data-vw-askfile]").click();
  await page.waitForSelector("#cref:not([hidden]) .cref-x");
  assert.equal(await page.locator("#cref .cref-x").getAttribute("aria-label"), "Take notes.md out of this message");
  // a line range keeps its line words
  await page.evaluate(() => { const S = window.__t.S; S.lref[S.view] = { path: "notes.md", a: 2, b: 4, name: "notes.md" }; });
  await page.evaluate(() => window.__t.lrefRender());
  assert.equal(await page.locator("#cref .cref-x").getAttribute("aria-label"), "Take the lines out of this message");
  await done(page);
});

// ── hops: the Workspace coordinator's receipt and the chat's history read, in either order ──
async function hopRace(receiptFirst) {
  let release;
  const gate = new Promise((ok) => (release = ok));
  const hop = { id: "race-ask", seq: 5, chat_id: "chat_demo", thread_ts: null, kind: "ask", from_role: "project-coordinator", to_role: "workspace-coordinator", state: "sent", created_at: NOW };
  const W = { hops: async (r, chatId, json) => { if (chatId !== "chat_demo") return json({ hops: [] }); await gate; return json({ hops: [{ ...hop }], next_after_seq: null, next_before_seq: null }); } };
  const page = await app(W);
  await page.evaluate(() => window.__storm.stop());
  if (!receiptFirst) await page.evaluate((h) => window.__storm.apply({ type: "hop", envelope: { seq: 5, chat_id: "chat_demo", ts: new Date().toISOString(), data: h } }), hop);
  await toDemo(page);
  await page.waitForTimeout(150); // the history read is out
  await page.evaluate(() => window.__storm.apply({ type: "hop", envelope: { seq: 99, chat_id: "chat_demo", ts: new Date().toISOString(), data: { id: "race-ask", state: "answered" } } }));
  release();
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => { window.__t.typingRender(); return { state: window.__t.world.state.hops.get("race-ask")?.state, line: document.querySelector("#typing")?.innerText || "" }; });
  assert.equal(got.state, "answered");
  assert.ok(!/Waiting for the Workspace coordinator/.test(got.line), `no false Waiting: "${got.line}"`);
  await done(page);
}
t("G5: a receipt during a history read that left before it stays answered", () => hopRace(false));
t("G5: a receipt that came before its hop was known still counts once the history arrives", () => hopRace(true));

// ── Launchpad: a stop is said only once Space confirms it ──
t("G6: a refused stop keeps the run, says why and offers Stop again; a confirmed one says stopped", async () => {
  let refuse = true;
  const calls = [];
  const W = { launchpad: "building", onDeploy: (r, m, p) => {
    // once Space has stopped it, its check no longer says a deploy is running
    if (/\/api\/deploy\/[^/]+\/check$/.test(p) && calls.length && !refuse) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(LP.ready.check) });
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { calls.push(m); return refuse ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: { code: "fixture_offline", message: "Fixture offline" } }) }) : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stopped: true, run_id: "r1" }) }); }
    return r.fallback();
  } };
  const page = await app(W);
  await toDemo(page);
  await page.locator("[data-lp-open]").click();
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3400);
  assert.deepEqual(calls, ["DELETE"]);
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "run", "still following the run");
  assert.match(await page.locator(".lp").innerText(), /Couldn't stop it: Fixture offline/);
  assert.match(await page.locator("#live").innerText(), /Couldn't stop the deploy/);
  assert.equal((await page.locator("[data-lp=stop]").innerText()).trim(), "Stop again");
  refuse = false;
  await page.locator("[data-lp=stop]").click();
  await page.waitForTimeout(3400);
  assert.deepEqual(calls, ["DELETE", "DELETE"]);
  assert.notEqual(await page.locator(".lp").getAttribute("data-screen"), "run", "the run is over");
  assert.match(await page.locator("#live").innerText(), /Deploy stopped/);
  await done(page);
});

// ── decisions (js/decide.js on its own, with a local world: no app, no API) ──
async function decisions(kind = "approval", count = 1) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/js\/(app|msgx|skeleton)\.js$/, (r) => r.abort());
  await page.route("**/api/**", (r) => r.fulfill({ status: 403, contentType: "application/json", body: '{"error":"test_only"}' }));
  await page.goto(BASE + "/");
  await page.evaluate(async ({ kind, count }) => {
    const { createDecisions } = await import("./js/decide.js");
    const calls = [];
    const threads = Array.from({ length: count }, (_, i) => ({ id: "t-" + i, title: "Task " + i, project: "demo", state: kind === "stopped" ? "failed" : "needs_approval", happened: "Test only", checklist: { total: 1, done: 0, items: [{ text: "Step", state: "todo" }] }, messages: [],
      asks: kind === "stopped" ? [] : [{ id: "ask-" + i, kind: kind === "question" ? "question" : "approval", title: "Choice " + i, risk: "routine", detail: "A local test.", ...(kind === "question" ? { options: ["First", "Second"] } : {}) }] }));
    const act = Object.fromEntries(["reply", "decide", "decideItem", "resolve"].map((name) => [name, async (...args) => { calls.push({ name, args }); return {}; }]));
    const world = { state: { threads, hosts: [] }, act };
    const P = { classify: (ns) => ns.forEach((n) => (n.admitted = true)), reviewStart() {}, reviewStop() {}, tired: () => false, reviewMin: () => 0, keepGoing() {}, rested() {}, bringIn() {} };
    const D = createDecisions({ world, P, PROJ: () => "Demo", announce: () => {}, render: () => {}, later: new Set(), waitSince: new Map() });
    window.d = { D, world, decided: () => D.decisions().map((x) => x.key) };
    D.open();
  }, { kind, count });
  page.errors = errors;
  return page;
}
const key = (page, k, o = {}) => page.evaluate(({ k, o }) => document.querySelector("#card").dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o })), { k, o });
const decided = (page) => page.evaluate(() => window.d.decided());

for (const [kind, sel] of [["approval", "[data-act=allow]"], ["stopped", "[data-act=retry]"], ["question", '[data-opt="0"]']]) {
  t(`G1: a fresh ${kind} card can't be decided in its first 300 ms (${sel})`, async () => {
    const page = await decisions(kind);
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    assert.deepEqual(await decided(page), [], "nothing decided at once");
    await page.waitForTimeout(360);
    await page.evaluate((s) => document.querySelector(s).click(), sel);
    assert.equal((await decided(page)).length, 1, "decided once the card is read");
    await ctxDone(page);
  });
}
t("G1: holding A (key repeats) decides only the card the first press was for", async () => {
  const page = await decisions("approval", 3);
  await page.waitForTimeout(360);
  await key(page, "a");
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(80); await key(page, "a", { repeat: true }); }
  assert.deepEqual(await decided(page), ["ask-0|Choice 0"]);
  await ctxDone(page);
});
t("G2: a card withdrawn while you type its note hands over with the next card's keys paused", async () => {
  const page = await decisions("approval", 2);
  await page.locator("[data-act=back]").click();
  await page.locator(".c-note-in").fill("a word still being typ");
  await page.evaluate(() => { window.d.world.state.threads.shift(); window.d.D.sync(); });
  await page.waitForTimeout(500);
  await key(page, "a");
  assert.deepEqual(await decided(page), [], "the letter didn't decide the next card");
  assert.match(await page.locator("#card .c-hint").innerText(), /keys are paused/);
  // Esc is the deliberate reset: then A decides it
  await key(page, "Escape");
  await key(page, "a");
  assert.deepEqual(await decided(page), ["ask-1|Choice 1"]);
  await ctxDone(page);
});
async function ctxDone(page) { const errs = page.errors; await page.context().close(); assert.deepEqual(errs, [], "page errors"); }

(async () => {
  server = await serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
  try { browser = await chromium.launch(); }
  catch (e) { console.error(`not run: Chromium didn't start (${e.message.split("\n")[0]})`); server.close(); process.exit(2); }
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  // the app's flows at a desktop and a phone width; the decision module's on its own once
  for (const width of [1440, 390]) {
    WIDTH = width;
    for (const { name, fn } of tests) {
      if (only && !only.test(name)) continue;
      if (width !== 1440 && /^G[12]:/.test(name)) continue;
      const label = `${name} [${width}]`;
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) { failed++; console.error("  FAIL " + label + "\n" + (e.stack || e)); }
    }
  }
  await browser.close(); server.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
