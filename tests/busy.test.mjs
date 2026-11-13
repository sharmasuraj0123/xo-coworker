// "Working": is an agent at work right now? Storm's `busy` on session and thread views (xo-space 8c6bc03:
// on a turn, or a sub-agent working on after it), kept live between reads by the same rule from the
// stream's session status and sub-agent runs (timeline.js sessionBusy, storm.js). Waiting on the person is
// never Working, and nor is a session a gate holds back (queued: the usage limit…, no process): that one is
// Waiting, saying for what and until when (timeline.js heldOf). The pure rule first, then storm.js end to end: fetch and the stream are fakes, nothing is
// sent anywhere, and nothing but GETs is asked.
//   node tests/busy.test.mjs
import assert from "node:assert/strict";
import { BUSY_STATES, readSub, sessionRead, sessionBusy, runWorks, heldOf, heldWords, heldShort } from "../js/timeline.js";

let passed = 0;
const pending = [];
const t = (name, fn) => {
  pending.push(async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
  });
};

// ── the rule ──────────────────────────────────────────────────────────────
t("on a turn is Working (starting, running, stopping); queued, warm, cold and parked aren't", () => {
  for (const st of ["starting", "running", "stopping"]) assert.equal(sessionBusy({ id: "s", state: st }), true, st);
  for (const st of ["queued", "warm", "cold", "parked", null]) assert.equal(sessionBusy({ id: "s", state: st }), false, String(st));
  assert.deepEqual([...BUSY_STATES].sort(), ["running", "starting", "stopping"]);
  assert.equal(sessionBusy(null), false);
});
t("held back by a gate (queued) is never Working: not with an older backend's busy, a stale run, or the runs counts", () => {
  // storm queues a session only with no process (engine _wait): nothing of it can be running
  const s = { id: "s", state: "queued", sub: true, readAt: 1 };
  assert.equal(sessionBusy(s), false);
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "running", seen: 5 }] }), false);
  assert.equal(sessionBusy(s, { agg: { running: 2, waiting: 0, at: 9 } }), false);
  // an older backend says busy: true for it; that isn't a sub-agent at work
  assert.equal(readSub({ state: "queued", busy: true }), false);
  assert.deepEqual(sessionRead({ state: "queued", busy: true }, 7), { sub: false, readAt: 7 });
  assert.equal(readSub({ state: "queued", busy: false }), false);
});
t("heldOf: the backend's waiting first; an older backend's pool (closed, paid, warn); else held for no named reason", () => {
  const reset = "2026-11-14T06:50:00Z";
  assert.equal(heldOf(null), null);
  for (const st of ["running", "starting", "warm", "cold", "waiting_on_person"]) assert.equal(heldOf({ state: st, waiting: { for: "limit" } }), null, st);
  // the backend's own word
  assert.deepEqual(heldOf({ state: "queued", waiting: { for: "limit", until: reset, pool: "claude_code:a", why: "usage limit" } }),
    { for: "limit", until: reset, why: "usage limit", asked: false });
  assert.deepEqual(heldOf({ state: "queued", waiting: { for: "memory", until: null } }), { for: "memory", until: null, why: null, asked: false });
  assert.equal(heldOf({ state: "queued", waiting: { for: "founder", until: reset } }).for, "founder");
  assert.equal(heldOf({ state: "queued", waiting: { for: "something new" } }).for, null, "a reason this UI doesn't know: held, not named");
  // its words name no time: the pool's reset fills it in
  assert.equal(heldOf({ state: "queued", pool: "p", waiting: { for: "limit", until: null } }, { p: { state: "closed", resets_at: reset } }).until, reset);
  // the paid gate: asked (your answer) or not (paid usage set to Never), as the pool's reason says
  assert.equal(heldOf({ state: "queued", pool: "p", waiting: { for: "paid" } }, { p: { state: "paid", reason: "paid_asked" } }).asked, true);
  assert.equal(heldOf({ state: "queued", pool: "p", waiting: { for: "paid" } }, { p: { state: "paid", reason: "paid_threshold" } }).asked, false);
  // an older backend: only "queued", and its pool
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "closed", resets_at: reset } }), { for: "limit", until: reset, why: null, asked: false });
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "paid", reason: null } }), { for: "paid", until: null, why: null, asked: true });
  assert.equal(heldOf({ state: "queued", pool: "p" }, { p: { state: "warn" } }).for, "near_limit");
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "open" } }), { for: null, until: null, why: null, asked: false });
  assert.deepEqual(heldOf({ state: "queued" }), { for: null, until: null, why: null, asked: false });
});
t("held words: the reset while it's ahead, never a time gone by; each gate in plain words", () => {
  const now = Date.parse("2026-11-14T05:00:00Z");
  const ahead = "2026-11-14T06:50:00Z", gone = "2026-11-14T04:00:00Z";
  const limit = (until) => ({ for: "limit", until, why: null, asked: false });
  assert.match(heldWords(limit(ahead), now), /^Waiting for the usage limit · starts at \d/);
  assert.ok(!/Working/.test(heldWords(limit(ahead), now)));
  assert.equal(heldWords(limit(gone), now), "Waiting for the usage limit to reset");
  assert.equal(heldWords(limit(null), now), "Waiting for the usage limit to reset");
  // a reset tomorrow says so; days away names the day
  assert.match(heldWords(limit(new Date(now + 24 * 3600e3).toISOString()), now), /starts tomorrow at \d/);
  assert.match(heldWords(limit("2026-11-17T06:50:00Z"), now), /starts [A-Z][a-z]{2} \d/);
  assert.match(heldShort(limit(ahead), now), /^Waiting · \d/);
  assert.match(heldShort(limit(new Date(now + 24 * 3600e3).toISOString()), now), /^Waiting · tomorrow \d/);
  assert.equal(heldShort(limit(gone), now), "Waiting");
  assert.equal(heldWords({ for: "paid", asked: true }, now), "Waiting for your choice on paid usage · it's in Needs you");
  assert.match(heldWords({ for: "paid", asked: false }, now), /^Waiting before paid usage/);
  assert.match(heldWords({ for: "near_limit" }, now), /^Waiting · near the usage limit/);
  assert.equal(heldWords({ for: "memory" }, now), "Waiting for memory to free up");
  assert.match(heldWords({ for: "founder", until: ahead }, now), /^Paused by you · until \d/);
  assert.equal(heldShort({ for: "founder" }, now), "Paused");
  assert.equal(heldWords({ for: null }, now), "Waiting to start");
  assert.equal(heldWords(null, now), "");
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

t("storm.js: held by the usage limit is Waiting, never Working or replying, on an older backend and a newer one; it starts at the reset", async () => {
  const at = "2026-11-13T21:00:00Z", reset = new Date(Date.now() + 3 * 3600e3).toISOString();
  const pool = "claude_code:acct-1";
  const thread = (ts, session, view, extra = {}) => ({ ts, chat_id: "chat_p", title: ts, state: "working", session_id: session, created_at: at, updated_at: at, session: view, ...extra });
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [
      // an older backend: queued, and busy: true for it
      thread("old", "cse_old", { state: "queued", busy: true }, { busy: true }),
      // a newer backend: busy false, and what holds it
      thread("new", "cse_new", { state: "queued", busy: false, waiting: { for: "limit", until: reset, pool, why: "usage limit" } }, { busy: false }),
    ] },
    "/chat/sessions": { sessions: [
      { id: "cse_old", seq: 1, chat_id: "chat_p", thread_ts: "old", role: "thread", agent: "claude_code", pool, state: "queued", busy: true },
      { id: "cse_new", seq: 2, chat_id: "chat_p", thread_ts: "new", role: "thread", agent: "claude_code", pool, state: "queued", busy: false, waiting: { for: "limit", until: reset, pool, why: "usage limit" } },
      { id: "cse_co", seq: 3, chat_id: "chat_p", role: "project-coordinator", agent: "claude_code", pool, state: "queued", busy: true },
      // an older coordinator, retired, left queued: never this chat's
      { id: "cse_co_old", seq: 0, chat_id: "chat_p", role: "project-coordinator", agent: "claude_code", pool, state: "queued", busy: true, retired_at: at },
    ] },
    "/chat/review": { items: [] },
    "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [{ id: pool, state: "closed", resets_at: reset, reason: "limit" }] },
    "/chat/runtimes": { runtimes: [] },
    "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
  await until(() => world.thread("old") && world.thread("old").held);
  await settle();
  for (const id of ["old", "new"]) {
    const th = world.thread(id);
    assert.equal(th.busy, false, `${id}: not Working`);
    assert.equal(th.held && th.held.for, "limit", `${id}: held by the limit`);
    assert.equal(th.held.until, reset, `${id}: until its reset`);
  }
  // the coordinator held by the same limit: not working, not replying, Waiting until the reset
  assert.equal(world.act.coordinatorBusy("demo"), null);
  assert.equal(world.act.replying("demo"), false);
  assert.deepEqual(world.act.coordinatorHeld("demo"), { for: "limit", until: reset, why: null, asked: false });
  assert.equal(world.act.sessionBusy("cse_co"), false);

  // the reset: the pool opens and the sessions start. Working again, held no more
  be.push("pool", { data: { pool, state: "open", resets_at: null, reason: null } });
  be.push("session", { session_id: "cse_new", seq: 20, data: { status: "starting" } });
  be.push("session", { session_id: "cse_co", seq: 21, data: { status: "running" } });
  await settle();
  assert.equal(world.thread("new").busy, true);
  assert.equal(world.thread("new").held, null);
  assert.equal(world.act.coordinatorHeld("demo"), null);
  assert.equal(world.act.coordinatorBusy("demo"), "cse_co");
  // the older backend's session, still queued once its pool is open: held for a reason it doesn't name, never Working
  assert.equal(world.thread("old").busy, false);
  assert.deepEqual(world.thread("old").held, { for: null, until: null, why: null, asked: false });
  // a newer backend's frame holds it again, saying why (here the memory guard)
  be.push("session", { session_id: "cse_new", seq: 22, data: { status: "queued", reason: "memory", waiting: { for: "memory", until: null, pool: null, why: "memory" } } });
  await settle();
  assert.equal(world.thread("new").busy, false);
  assert.equal(world.thread("new").held.for, "memory");
  // and any other status ends the wait, whatever the frame says beside it
  be.push("session", { session_id: "cse_new", seq: 23, data: { status: "running", waiting: { for: "memory" } } });
  await settle();
  assert.equal(world.thread("new").held, null);
  assert.equal(world.state.sessions.cse_new.waiting, null);
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

for (const run of pending) await run();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit(process.exitCode || 0); // the fake stream and storm's timers would keep node waiting
