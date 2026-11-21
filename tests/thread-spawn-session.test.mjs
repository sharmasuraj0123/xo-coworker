// A thread born while the page is open: its spawn frame carries no session or pin, so storm.js reads the
// thread once to learn the model and effort it runs on (the composer's chip said "Auto" until a reload).
//   node tests/thread-spawn-session.test.mjs
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

const at = "2026-11-20T21:53:27Z";
const row = (ts, extra = {}) => ({ ts, chat_id: "chat_p", title: ts, state: "working", session_id: `cse_${ts}`, created_at: at, updated_at: at, ...extra });
const be = fakeBackend({
  "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
  "/chat/chats/chat_p/threads": { threads: [row("old", { session: { state: "warm", agent: "claude_code", model: "opus", effort: "high" }, pin: { model: "opus", effort: "high" } })] },
  "/chat/chats/chat_p/threads/born": row("born", { session: { state: "running", agent: "claude_code", model: "opus", effort: "medium" }, pin: { agent: "claude_code", model: "opus", effort: "medium" } }),
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
await settle();
assert.equal(world.thread("old").session.model, "opus", "a listed thread has its session from the list");

// the spawn frame, as xo-space sends it (rows.add_thread): the thread's row, no session, no pin
const { session, pin, ...spawn } = row("born");
be.push("thread", { seq: 2, chat_id: "chat_p", thread_ts: "born", data: spawn });
await until(() => world.thread("born")?.session);
assert.deepEqual({ model: world.thread("born").session.model, effort: world.thread("born").session.effort }, { model: "opus", effort: "medium" });
assert.equal(world.thread("born").pin.effort, "medium");

// later partial frames keep what was read, and read nothing again
be.push("thread", { seq: 3, chat_id: "chat_p", thread_ts: "born", data: { ts: "born", state: "working", activity: "working" } });
await settle();
assert.equal(world.thread("born").session.model, "opus");
assert.equal(be.asked.filter((a) => a === "GET /chat/chats/chat_p/threads/born").length, 1, "one read per thread");
assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
console.log("thread-spawn-session: 1 passed");
process.exit(0);
