// Writing to a resolved thread: xo-space says "stalled, needs a reply" for a moment before "working"; that never docks a needs-you card.
import assert from "node:assert/strict";

globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const h = realInterval(fn, ms); h.unref?.(); return h; };

function fakeBackend(routes) {
  const asked = [], queue = [];
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
    return new Response(JSON.stringify(body === undefined ? { detail: "Not Found" } : body), { status: body === undefined ? 404 : 200, headers: { "Content-Type": "application/json" } });
  };
  return { asked, push };
}
const until = async (cond, ms = 3000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 5)); } };
const settle = () => new Promise((r) => setTimeout(r, 80));

import { threadState } from "../core/services/world/timeline.js";

assert.equal(threadState("needs_reply", null, false, false, true), "working", "stalled on your own message");
assert.equal(threadState("needs_reply", null, false, false, false), "needs_reply", "a stall after the agent spoke");

const at = "2026-11-20T21:55:00Z";
const row = (ts, extra = {}) => ({ ts, chat_id: "chat_p", title: ts, state: "resolved", activity: "resolved", session_id: `cse_${ts}`, created_at: at, updated_at: at, session: { state: "warm", agent: "claude_code", model: "opus", effort: "medium" }, pin: {}, ...extra });
const msg = (id, seq, author_kind, text) => ({ id, seq, chat_id: "chat_p", thread_ts: "t1", author_kind, author_id: author_kind === "owner" ? "owner" : "thread", text, extra: {}, created_at: at });
const be = fakeBackend({
  "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
  "/chat/chats/chat_p/threads": { threads: [row("t1")] },
  "/chat/sessions": { sessions: [] },
  "/chat/review": { items: [] },
  "/chat/chats/chat_ws/hops": { hops: [] },
  "/chat/status": { pools: [] },
  "/chat/runtimes": { runtimes: [] },
  "/chat/router": { mode: "agent" },
});
const { createWorld } = await import("../js/world.js");
const world = createWorld();
be.push("snapshot", { data: { seq: 1, turns: [] } });
await until(() => world.state.loaded);
be.push("message", { seq: 10, chat_id: "chat_p", thread_ts: "t1", data: msg("m_agent", 10, "agent", "Done. Anything else?") });
await settle();

// the frames xo-space sent on 20 Nov (seq 448426, 448428, 448429): your message, the stall, then working
be.push("message", { seq: 20, chat_id: "chat_p", thread_ts: "t1", data: msg("m_you", 20, "owner", "how big of a change is this?") });
be.push("thread", { seq: 22, chat_id: "chat_p", thread_ts: "t1", data: { ts: "t1", state: "needs_reply", activity: "stalled", wait_reason: "open task has no running turn or pending input" } });
await settle();
assert.equal(world.thread("t1").state, "working", "the stall on your own message isn't waiting on you");
assert.deepEqual(world.thread("t1").asks, [], "no needs-you card");
be.push("thread", { seq: 23, chat_id: "chat_p", thread_ts: "t1", data: { ts: "t1", state: "working", activity: "waiting", wait_reason: "queued input" } });
await settle();
assert.equal(world.thread("t1").state, "working");

// the agent answers and stalls: that one waits on you
be.push("message", { seq: 30, chat_id: "chat_p", thread_ts: "t1", data: msg("m_agent2", 30, "agent", "Which one?") });
be.push("thread", { seq: 31, chat_id: "chat_p", thread_ts: "t1", data: { ts: "t1", state: "needs_reply", activity: "stalled", wait_reason: "open task has no running turn or pending input" } });
await settle();
assert.equal(world.thread("t1").state, "needs_reply");
assert.equal(world.thread("t1").asks.length, 1);
assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
console.log("stalled-own-message: 1 passed");
process.exit(0);
