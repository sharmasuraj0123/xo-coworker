// "Working": is an agent at work right now? Storm's `busy` on session and thread views (xo-space 8c6bc03:
// on a turn, or a sub-agent working on after it), kept live between reads by the same rule from the
// stream's session status and sub-agent runs (timeline.js sessionBusy, storm.js). Waiting on the person is
// never Working, and nor is a session a gate holds back (queued: the usage limit…, no process): that one is
// Waiting, saying for what and until when (timeline.js heldOf). The pure rule first, then storm.js end to end: fetch and the stream are fakes, nothing is
// sent anywhere, and nothing but GETs is asked.
//   node tests/busy.test.mjs
import assert from "node:assert/strict";
import { BUSY_STATES, readSub, sessionRead, sessionBusy, runWorks, heldOf, heldWords, heldShort, heldClock, heldBadge, soonestHeld, queuedButWorking, threadState, statusLater } from "../js/timeline.js";
const sp = (x) => String(x).replace(/\u00a0/g, " "); // the time is one phrase (no-break spaces); read as plain spaces

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
t("held back by a gate (queued) is never Working: not with an older backend's busy, a run or counts from before it", () => {
  // storm queues a session only with no process (engine _wait): nothing of it can be running
  const s = { id: "s", state: "queued", sub: true, readAt: 1, statusAt: 10, statusSeq: 50 };
  assert.equal(sessionBusy(s), false);
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "running", seen: 5 }] }), false, "a run last heard of before it was queued");
  assert.equal(sessionBusy(s, { agg: { running: 2, waiting: 0, at: 9 } }), false, "counts from before it was queued");
  assert.equal(sessionBusy(s, { turn: { status: "running", seq: 40 } }), false, "a turn the stream started before it was queued (its end missed)");
  // an older backend says busy: true for it; that isn't a sub-agent at work
  assert.equal(readSub({ state: "queued", busy: true }), false);
  assert.deepEqual(sessionRead({ state: "queued", busy: true }, 7), { sub: false, readAt: 7 });
  assert.equal(readSub({ state: "queued", busy: false }), false);
});
t("work seen after a session said queued outlives it: a turn started, a sub-agent named, counts above none (its frame is late)", () => {
  const s = { id: "s", state: "queued", statusAt: 10, statusSeq: 50 };
  assert.equal(sessionBusy(s, { turn: { status: "running", seq: 51 } }), true);
  assert.equal(queuedButWorking(s, { turn: { status: "running", seq: 51 } }), true);
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "running", seen: 11, seenSeq: 52 }] }), true, "a run frame after it");
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "running", seen: 99 }] }), false, "a runs list read: never evidence (no stream seq)");
  assert.equal(sessionBusy(s, { agg: { running: 1, waiting: 0, at: 11 } }), true);
  assert.equal(sessionBusy(s, { agg: { running: 0, waiting: 0, at: 11 } }), false, "counts of none say nothing works");
  assert.equal(sessionBusy(s, { runs: [{ session: "s", state: "finished", ended_at: "x", seen: 11, seenSeq: 52 }] }), false);
  // a status with no seq known (a local guess): any running turn the stream holds is evidence
  assert.equal(queuedButWorking({ id: "s", state: "queued", statusAt: 10 }, { turn: { status: "running", seq: 3 } }), true);
  assert.equal(queuedButWorking({ id: "s", state: "warm" }, { turn: { status: "running", seq: 99 } }), false, "only a queued status is overruled");
  // in the stream's order where both say it: a run or counts read (or framed) before the status don't count,
  // whatever the clock said when they came back
  const q = { id: "s", state: "queued", statusAt: 10, statusSeq: 50 };
  assert.equal(queuedButWorking(q, { runs: [{ session: "s", state: "running", seen: 99, seenSeq: 40 }] }), false);
  assert.equal(queuedButWorking(q, { runs: [{ session: "s", state: "running", seen: 5, seenSeq: 60 }] }), true);
  assert.equal(queuedButWorking(q, { agg: { running: 1, waiting: 0, at: 99, seq: 40 } }), false);
  assert.equal(queuedButWorking(q, { agg: { running: 1, waiting: 0, at: 5, seq: 60 } }), true);
});
t("which status is newest: the stream's order (a read stands where it was sent), then the moment", () => {
  // a read sent at seq 10 and answered after a frame at seq 12: the frame stands
  assert.equal(statusLater({ statusSeq: 10, statusAt: 900 }, { statusSeq: 12, statusAt: 500 }), false);
  assert.equal(statusLater({ statusSeq: 12, statusAt: 500 }, { statusSeq: 10, statusAt: 900 }), true);
  // a read sent after the frame at seq 12 was seen (both at 12): the later moment, the read
  assert.equal(statusLater({ statusSeq: 12, statusAt: 600 }, { statusSeq: 12, statusAt: 500 }), true);
  assert.equal(statusLater({ statusAt: 7 }, { statusSeq: 3, statusAt: 5 }), true, "no seq: by moment");
});
t("held is one shown state: a done, stopped or needs-reply thread whose next input waits is on its way again", () => {
  for (const st of ["done", "failed", "needs_reply"]) assert.equal(threadState(st, null, false, true), "working", st);
  for (const st of ["done", "failed", "needs_reply"]) assert.equal(threadState(st, null, false, false), st, `${st}, not held`);
  // the founder's pause, an open approval and a resolved thread keep theirs
  for (const st of ["paused", "needs_approval", "resolved"]) assert.equal(threadState(st, null, false, true), st, st);
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
  assert.equal(heldOf({ state: "queued", pool: "p", waiting: { for: "paid" } }, { p: { state: "paid", reason: null } }).asked, false, "no reason read: not claimed asked");
  // an older backend: only "queued", and its pool
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "closed", resets_at: reset } }), { for: "limit", until: reset, why: null, asked: false });
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "paid", reason: "paid_asked" } }), { for: "paid", until: null, why: null, asked: true });
  assert.equal(heldOf({ state: "queued", pool: "p" }, { p: { state: "warn" } }).for, "near_limit");
  assert.deepEqual(heldOf({ state: "queued", pool: "p" }, { p: { state: "open" } }), { for: null, until: null, why: null, asked: false });
  assert.deepEqual(heldOf({ state: "queued" }), { for: null, until: null, why: null, asked: false });
});
t("held words: one verb (starts), the reset while it's ahead, never a time gone by; each gate in plain words", () => {
  const now = new Date(2026, 10, 14, 5, 0).getTime(); // local time: the owner's clock
  const at = (d, h, m = 0) => new Date(2026, 10, 14 + d, h, m).toISOString();
  const limit = (until) => ({ for: "limit", until, why: null, asked: false });
  assert.match(sp(heldWords(limit(at(0, 6, 50)), now)), /^Waiting for the usage limit · starts at 6:50\sAM$/);
  assert.ok(!/Working/.test(heldWords(limit(at(0, 6, 50)), now)));
  assert.equal(heldWords(limit(at(0, 4)), now), "Waiting for the usage limit to reset");
  assert.equal(heldWords(limit(null), now), "Waiting for the usage limit to reset");
  assert.match(sp(heldWords(limit(at(1, 1, 31)), now)), /starts tomorrow at 1:31\sAM$/);
  assert.match(sp(heldWords(limit(at(3, 6, 50)), now)), /starts [A-Z][a-z]{2} at 6:50\sAM$/);
  assert.match(sp(heldWords(limit(at(9, 6, 50)), now)), /starts on \S+ \S+ at 6:50\sAM$/, "a date: on … at …");
  // the time never breaks across lines: everything after "starts " is one phrase
  const tail = heldWords(limit(at(1, 1, 31)), now).split(" · ")[1];
  assert.ok(/^starts/.test(tail) && !/ /.test(tail), `no breaking space in "${tail}"`);
  // the short forms use the same verb
  assert.match(sp(heldShort(limit(at(0, 6, 50)), now)), /^Starts 6:50\sAM$/);
  assert.match(sp(heldShort(limit(at(1, 1, 31)), now)), /^Starts tomorrow 1:31\sAM$/);
  assert.match(sp(heldClock(at(1, 1, 31), now)), /^tomorrow 1:31\sAM$/);
  assert.equal(heldShort(limit(at(0, 4)), now), "Waiting");
  // the paid gate: the question when it's asked; otherwise nothing claimed about the setting
  assert.equal(heldWords({ for: "paid", asked: true }, now), "Waiting for your choice on paid usage · it's in Needs you");
  assert.equal(heldWords({ for: "paid", asked: false }, now), "Waiting before paid usage · see Settings › Runtimes");
  assert.ok(!/Never/.test(heldWords({ for: "paid", asked: false }, now)));
  assert.match(heldWords({ for: "near_limit" }, now), /^Waiting · near the usage limit/);
  assert.equal(heldWords({ for: "memory" }, now), "Waiting for memory to free up");
  assert.match(sp(heldWords({ for: "founder", until: at(0, 6, 50) }, now)), /^Paused by you · until 6:50\sAM$/);
  assert.equal(heldShort({ for: "founder" }, now), "Paused");
  assert.equal(heldBadge({ for: "founder" }), "Paused");
  assert.equal(heldBadge({ for: "limit" }), "Waiting");
  // a reason this UI doesn't name: the backend's own words, else a plain wait
  assert.equal(heldWords({ for: null, why: "the new gate" }, now), "Waiting · the new gate");
  assert.equal(heldWords({ for: null }, now), "Waiting to start");
  assert.equal(heldWords(null, now), "");
});
t("of several held, the soonest start; one with no time when none has", () => {
  const now = Date.parse("2026-11-14T05:00:00Z");
  const a = { for: "limit", until: "2026-11-14T09:00:00Z" }, b = { for: "limit", until: "2026-11-14T06:00:00Z" }, c = { for: "memory", until: null }, gone = { for: "limit", until: "2026-11-14T04:00:00Z" };
  assert.equal(soonestHeld([a, null, c, b, gone], now), b);
  assert.equal(soonestHeld([c, gone], now), c);
  assert.equal(soonestHeld([null], now), null);
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
    return new Response(JSON.stringify(body === undefined ? { detail: "Not Found" } : typeof body === "function" ? await body() : body), { status: body === undefined ? 404 : 200, headers: { "Content-Type": "application/json" } });
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

t("storm.js: held is one shown state, and work seen after a stale queued wins (a turn started, a newer read)", async () => {
  const at = "2026-11-13T21:00:00Z", reset = new Date(Date.now() + 3 * 3600e3).toISOString();
  const pool = "claude_code:acct-1";
  const thread = (ts, session, state, view) => ({ ts, chat_id: "chat_p", title: ts, state, session_id: session, created_at: at, updated_at: at, session: view, busy: false });
  const q = { state: "queued", busy: true };
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [
      thread("done", "cse_done", "done", q), thread("asked", "cse_asked", "needs_reply", q), thread("stale", "cse_stale", "working", q), thread("read", "cse_read", "working", q),
    ] },
    "/chat/sessions": { sessions: ["done", "asked", "stale", "read"].map((x, i) => ({ id: `cse_${x}`, seq: i + 1, chat_id: "chat_p", thread_ts: x, role: "thread", agent: "claude_code", pool, state: "queued", busy: true }))
      .concat([{ id: "cse_co", seq: 9, chat_id: "chat_p", role: "project-coordinator", agent: "claude_code", pool, state: "queued", busy: true }]) },
    "/chat/review": { items: [] },
    "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [{ id: pool, state: "closed", resets_at: reset, reason: "limit" }] },
    "/chat/runtimes": { runtimes: [] },
    "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  be.push("snapshot", { data: { seq: 100, turns: [] } });
  await until(() => world.state.loaded);
  await until(() => world.thread("stale") && world.thread("stale").held);
  await settle();
  // a done thread and one that asked you, each with your next message held: Waiting, not Done or Needs you
  for (const id of ["done", "asked"]) {
    assert.equal(world.thread(id).state, "working", `${id}: on its way again`);
    assert.equal(world.thread(id).held.for, "limit", `${id}: held`);
    assert.equal(world.thread(id).busy, false);
  }
  // a turn the stream starts after "queued" (the status frame that ended the wait is late): Working, Stop's target
  be.push("turn.started", { session_id: "cse_stale", turn_id: "turn_1", seq: 200, ts: at, data: { origin: "person" } });
  be.push("turn.started", { session_id: "cse_co", turn_id: "turn_2", seq: 201, ts: at, data: { origin: "person" } });
  await settle();
  assert.equal(world.thread("stale").busy, true);
  assert.equal(world.thread("stale").held, null);
  assert.equal(world.act.coordinatorHeld("demo"), null);
  assert.equal(world.act.coordinatorBusy("demo"), "cse_co");
  assert.equal(world.act.replying("demo"), true);
  // a thread read newer than the live record's last status: its session runs
  be.push("thread", { chat_id: "chat_p", data: { ts: "read", chat_id: "chat_p", state: "working", busy: true, session: { state: "running", busy: true } } });
  await settle();
  assert.equal(world.thread("read").busy, true);
  assert.equal(world.thread("read").held, null);
  // and a later queued frame holds it again
  be.push("session", { session_id: "cse_read", seq: 300, data: { status: "queued" } });
  await settle();
  assert.equal(world.thread("read").busy, false);
  assert.equal(world.thread("read").held.for, "limit");
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

t("storm.js: at boot a listed queued session stands at the snapshot's seq: a turn left running in history doesn't make it Working", async () => {
  const at = "2026-11-13T21:00:00Z";
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [{ ts: "t3", chat_id: "chat_p", title: "t3", state: "working", session_id: "cse_3", created_at: at, updated_at: at, busy: false, session: { state: "queued", busy: false, waiting: { for: "limit", until: null, pool: "p", why: "usage limit reached" } } }] },
    "/chat/sessions": { sessions: [{ id: "cse_3", seq: 1, chat_id: "chat_p", thread_ts: "t3", role: "thread", agent: "claude_code", pool: "p", state: "queued", busy: false, waiting: { for: "limit", until: null, pool: "p", why: "usage limit reached" } }] },
    "/chat/review": { items: [] },
    "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [] },
    "/chat/runtimes": { runtimes: [] },
    "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  // the snapshot at seq 500 lists a turn of that session that started at 50 and never said it ended
  be.push("snapshot", { data: { seq: 500, turns: [{ turn_id: "turn_old", session_id: "cse_3", chat_id: "chat_p", thread_ts: "t3", seq: 50, blocks: [] }] } });
  await until(() => world.state.loaded);
  await until(() => world.thread("t3"));
  await settle();
  assert.equal(world.state.sessions.cse_3.statusSeq, 500, "the read stands where the stream was when it was sent");
  assert.equal(world.thread("t3").busy, false);
  assert.equal(world.thread("t3").held.for, "limit");
  // a turn the stream starts after it: that one is work
  be.push("turn.started", { session_id: "cse_3", turn_id: "turn_new", seq: 501, ts: at, data: { origin: "person" } });
  await settle();
  assert.equal(world.thread("t3").busy, true);
});

t("storm.js: a read sent before a status frame and answered after it doesn't undo that frame (it stands where it was sent)", async () => {
  const at = "2026-11-13T21:00:00Z";
  let release;
  const gate = new Promise((r) => { release = r; });
  const queuedView = { state: "queued", busy: false, waiting: { for: "limit", until: null, pool: "p", why: "usage limit reached" } };
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [] },
    "/chat/sessions": { sessions: [{ id: "cse_2", seq: 1, chat_id: "chat_p", thread_ts: "t2", role: "thread", agent: "claude_code", pool: "p", state: "queued", busy: false, waiting: queuedView.waiting }] },
    // the thread is read while its session is still queued; the answer is held back until after the frame
    "/chat/chats/chat_p/threads/t2": async () => { await gate; return { ts: "t2", chat_id: "chat_p", title: "t2", state: "working", session_id: "cse_2", created_at: at, updated_at: at, busy: false, session: queuedView }; },
    "/chat/review": { items: [] },
    "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [] },
    "/chat/runtimes": { runtimes: [] },
    "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  be.push("snapshot", { data: { seq: 5, turns: [] } });
  await until(() => world.state.loaded);
  // a thread this tab doesn't know yet: it's read
  be.push("thread", { chat_id: "chat_p", seq: 20, data: { ts: "t2" } });
  await until(() => be.asked.includes("GET /chat/chats/chat_p/threads/t2"));
  // the wait ends on the stream while the read is out
  be.push("session", { session_id: "cse_2", seq: 40, data: { status: "running" } });
  await until(() => world.state.sessions.cse_2.state === "running");
  release();
  await until(() => world.thread("t2"));
  await settle();
  assert.equal(world.thread("t2").busy, true, "the frame stands: Working");
  assert.equal(world.thread("t2").held, null);
  // a later status frame says queued again: that one stands
  be.push("session", { session_id: "cse_2", seq: 41, data: { status: "queued", waiting: queuedView.waiting } });
  await settle();
  assert.equal(world.thread("t2").busy, false);
  assert.equal(world.thread("t2").held.for, "limit");
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

for (const run of pending) await run();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit(process.exitCode || 0); // the fake stream and storm's timers would keep node waiting
