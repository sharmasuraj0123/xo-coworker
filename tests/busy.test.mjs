// "Working": is an agent at work right now? Storm's `busy` on session and thread views (xo-space 8c6bc03:
// on a turn, or a sub-agent working on after it), kept live between reads by the same rule from the
// stream's session status and sub-agent runs (timeline.js sessionBusy, storm.js). Waiting on the person is
// never Working. The pure rule first, then storm.js end to end: fetch and the stream are fakes, nothing is
// sent anywhere, and nothing but GETs is asked.
//   node tests/busy.test.mjs
import assert from "node:assert/strict";
import { BUSY_STATES, readSub, sessionRead, sessionBusy, runWorks } from "../js/timeline.js";

let passed = 0;
const pending = [];
const t = (name, fn) => {
  pending.push(async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
  });
};

// ── the rule ──────────────────────────────────────────────────────────────
t("on a turn is Working (queued, starting, running, stopping); warm, cold and parked aren't", () => {
  for (const st of ["queued", "starting", "running", "stopping"]) assert.equal(sessionBusy({ id: "s", state: st }), true, st);
  for (const st of ["warm", "cold", "parked", null]) assert.equal(sessionBusy({ id: "s", state: st }), false, String(st));
  assert.deepEqual([...BUSY_STATES].sort(), ["queued", "running", "starting", "stopping"]);
  assert.equal(sessionBusy(null), false);
});
t("waiting on the person is never Working: not with storm's busy, a sub-agent run, or the runs counts", () => {
  const s = { id: "s", state: "waiting_on_person", sub: true, readAt: 1 };
  assert.equal(sessionBusy(s), false);
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "running", seen: 5 }] }), false);
  assert.equal(sessionBusy(s, { agg: { running: 2, waiting: 0, at: 9 } }), false);
  // a read of it says nothing beyond its status that could make it Working
  assert.equal(readSub({ state: "waiting_on_person", busy: false }), false);
});
t("a read's busy beyond its status: a sub-agent working on after the turn; an older backend says nothing", () => {
  assert.equal(readSub({ state: "warm", busy: true }), true);
  assert.equal(readSub({ state: "warm", busy: false }), false);
  assert.equal(readSub({ state: "running", busy: true }), false, "explained by the turn: nothing known beyond it");
  assert.equal(readSub({ state: "warm" }), undefined);
  assert.deepEqual(sessionRead({ state: "warm" }), {}, "no busy, no read evidence (the stream's runs keep counting)");
  assert.deepEqual(sessionRead({ state: "warm", busy: true }, 42), { sub: true, readAt: 42 });
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: true, readAt: 10 }), true);
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: false, readAt: 10 }), false);
});
t("a sub-agent run after the turn is Working until it ends (run.finished); a hidden one doesn't count", () => {
  const s = { id: "s", state: "warm" };
  const run = { session: "s", state: "running", seen: 5 };
  assert.equal(sessionBusy(s, { runs: [run] }), true);
  assert.equal(sessionBusy(s, { runs: [{ ...run, state: "waiting" }] }), true, "a sub-agent asking still holds the agent (storm counts it)");
  assert.equal(sessionBusy(s, { runs: [{ ...run, state: "finished", ended_at: "2026-11-04T10:00:00Z" }] }), false);
  assert.equal(sessionBusy(s, { runs: [{ ...run, hidden: true }] }), false);
  assert.equal(sessionBusy(s, { runs: [{ ...run, session: "other" }] }), false);
  assert.equal(runWorks({ state: "lost" }), false);
});
t("the newest word wins: the runs counts after a read, a run named after the counts, a read after a run", () => {
  // the read said a sub-agent works on; the counts since say none: not Working
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: true, readAt: 10 }, { agg: { running: 0, waiting: 0, at: 20 } }), false);
  // the counts are older than the read: the read stands
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: true, readAt: 30 }, { agg: { running: 0, waiting: 0, at: 20 } }), true);
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: false, readAt: 10 }, { agg: { running: 1, waiting: 0, at: 20 } }), true);
  // a run the stream named after the counts said none: Working
  assert.equal(sessionBusy({ id: "s", state: "warm" }, { runs: [{ session: "s", state: "running", seen: 30 }], agg: { running: 0, waiting: 0, at: 20 } }), true);
  // a run whose end we never heard, older than a read that says nothing works: not Working
  assert.equal(sessionBusy({ id: "s", state: "warm", sub: false, readAt: 50 }, { runs: [{ session: "s", state: "running", seen: 30 }] }), false);
});

// ── storm.js end to end ───────────────────────────────────────────────────
// A browser-ish global: storm.js listens for the tab coming back and the network returning.
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
// its housekeeping interval mustn't keep node alive
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const h = realInterval(fn, ms); h.unref?.(); return h; };

/** The fake backend: GET routes answered from `routes` (else 404), and one stream the test feeds frames into. */
function fakeBackend(routes) {
  const asked = [];
  const queue = [];
  let wake = null;
  const enc = new TextEncoder();
  const push = (type, env) => { queue.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...env })}\n\n`); if (wake) { const w = wake; wake = null; w(); } };
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^api/, "").split("?")[0];
    asked.push(`${method} ${path}`);
    if (method !== "GET") throw new Error(`a ${method} was sent: tests never write`);
    if (path === "/chat/stream") {
      return { ok: true, status: 200, type: "basic", body: { getReader: () => ({ cancel() {}, read: async () => {
        while (!queue.length) await new Promise((r) => { wake = r; });
        return { value: enc.encode(queue.shift()), done: false };
      } }) } };
    }
    const body = routes[path];
    return new Response(JSON.stringify(body === undefined ? { detail: "Not Found" } : typeof body === "function" ? body() : body), { status: body === undefined ? 404 : 200, headers: { "Content-Type": "application/json" } });
  };
  return { asked, push };
}
const until = async (cond, ms = 3000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 5)); } };
const settle = () => new Promise((r) => setTimeout(r, 80)); // storm commits a burst of frames after 30 ms

t("storm.js: a thread's Working follows busy from its view, then the stream's status and sub-agents; waiting on you never", async () => {
  const at = "2026-11-04T10:00:00Z";
  const thread = (ts, session, view, extra = {}) => ({ ts, chat_id: "chat_p", title: ts, state: "working", session_id: session, created_at: at, updated_at: at, session: view, ...extra });
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [
      thread("sub", "cse_sub", { state: "warm", busy: true }, { busy: true }),              // a sub-agent works on after the turn
      thread("held", "cse_held", { state: "waiting_on_person", busy: true }, { busy: true }), // waiting on you (a background run too)
      thread("idle", "cse_idle", { state: "warm", busy: false }, { busy: false }),
      thread("old", "cse_old", { state: "running" }),                                        // an older backend: no busy at all
    ] },
    "/chat/sessions": { sessions: [] },
    "/chat/review": { items: [] },
    "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [] },
    "/chat/runtimes": { runtimes: [] },
    "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
  await settle();
  const busy = (id) => world.thread(id).busy;
  assert.deepEqual(["sub", "held", "idle", "old"].map(busy), [true, false, false, true], "from the views");

  // the stream: the sub-agent's counts drop to none → not Working any more
  be.push("runs", { session_id: "cse_sub", data: { session: "cse_sub", running: 0, waiting: 0, tokens: 0 } });
  await settle();
  assert.equal(busy("sub"), false);
  // a sub-agent starts after the turn on an idle session → Working until run.finished
  be.push("run.started", { session_id: "cse_idle", ts: at, data: { run_id: "run_1", info: { title: "Explorer", kind: "subagent" } } });
  await settle();
  assert.equal(busy("idle"), true);
  be.push("run.finished", { session_id: "cse_idle", ts: at, data: { run_id: "run_1", state: "finished", status: "ok" } });
  await settle();
  assert.equal(busy("idle"), false);
  // a status on a turn and back
  be.push("session", { session_id: "cse_idle", seq: 9, data: { status: "running" } });
  await settle();
  assert.equal(busy("idle"), true);
  be.push("session", { session_id: "cse_idle", seq: 10, data: { status: "warm" } });
  await settle();
  assert.equal(busy("idle"), false);
  // waiting on you stays not Working, whatever runs
  be.push("run.started", { session_id: "cse_held", ts: at, data: { run_id: "run_2", info: { title: "Writer" } } });
  be.push("session", { session_id: "cse_held", seq: 11, data: { status: "waiting_on_person" } });
  await settle();
  assert.equal(busy("held"), false);
  assert.equal(world.act.sessionBusy("cse_held"), false);
  // the decision made, the turn ends, its sub-agent works on: Working until it ends
  be.push("session", { session_id: "cse_held", seq: 12, data: { status: "warm" } });
  await settle();
  assert.equal(busy("held"), true);
  assert.equal(world.act.sessionBusy("cse_held"), true);
  be.push("run.finished", { session_id: "cse_held", ts: at, data: { run_id: "run_2", state: "finished" } });
  await settle();
  // the read said a sub-agent works on, and nothing says which: it holds until storm's counts come
  assert.equal(busy("held"), true);
  be.push("runs", { session_id: "cse_held", data: { session: "cse_held", running: 0, waiting: 0, tokens: 0 } });
  await settle();
  assert.equal(busy("held"), false);
  // the older backend's thread: its status alone
  be.push("session", { session_id: "cse_old", seq: 13, data: { status: "warm" } });
  await settle();
  assert.equal(busy("old"), false);
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

for (const run of pending) await run();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit(process.exitCode || 0); // the fake stream and storm's timers would keep node waiting
