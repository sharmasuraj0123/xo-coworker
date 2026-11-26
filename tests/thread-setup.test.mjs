// A coordinator's change_thread_setup: its line is the system message, never a stop; the thread re-reads its session. An idle "working" thread doesn't read Running.
import assert from "node:assert/strict";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.addEventListener = () => {};
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const h = realInterval(fn, ms); h.unref?.(); return h; };
const { createConversationMessages } = await import("../modules/conversation/messages.js");
const { createIntelCatalog } = await import("../modules/chats/intel-catalog.js");

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; } };

await t("a setup control adds no control row; a stop still does", () => {
  const thread = { id: "thread", project: "demo", sessionId: "session", loaded: true, busy: false, messages: [] };
  const messagesOf = createConversationMessages({
    world: {
      state: {
        hist: {}, timeline: { demo: [] }, hops: new Map(),
        controls: { thread: [{ at: "2026-11-26T10:00:00Z", seq: 5, action: "stop", by: "project-coordinator" }, { at: "2026-11-26T10:01:00Z", seq: 12, action: "setup", by: "project-coordinator" }] },
        turns: { running: () => null, list: () => [], blocksOf: () => [] },
      },
      act: {},
    },
    shape: { on: () => false }, PROJ: () => "Demo", convThread: () => thread, chatOf: () => "demo",
    localMessages: { alias: () => null, list: () => [], mergeEchoes() {} },
  });
  const controls = messagesOf("t:thread").filter((m) => m.who === "control").map((m) => m.ctl.action);
  assert.deepEqual(controls, ["stop"]);
});

await t("an idle thread that reads working (an open task) isn't Running in the model panel", () => {
  const th = { state: "working", busy: false, session: { model: "m1", effort: "high" } };
  const world = { state: { runtimes: [] }, thread: () => th, project: () => null };
  const cat = createIntelCatalog({}, { world, PROJ: (x) => x, simple: () => false });
  assert.equal(cat.running("t:x").working, false);
  th.busy = true;
  assert.equal(cat.running("t:x").working, true);
});

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

await t("storm: a setup control re-reads the thread, so its header shows the new model and effort", async () => {
  const at = "2026-11-26T10:00:00Z";
  const row = (session) => ({ ts: "task", chat_id: "chat_p", title: "task", state: "working", activity: "working", session_id: "cse_task", created_at: at, updated_at: at, session, busy: false });
  const routes = {
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [row({ state: "warm", busy: false, model: "m1", effort: "low" })] },
    "/chat/sessions": { sessions: [] }, "/chat/review": { items: [] }, "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [] }, "/chat/runtimes": { runtimes: [] }, "/chat/router": { mode: "auto" },
  };
  const be = fakeBackend(routes);
  const { createWorld } = await import("../core/services/world/store.js");
  const world = createWorld();
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
  await settle();
  assert.equal(world.thread("task").session.effort, "low");
  routes["/chat/chats/chat_p/threads/task"] = row({ state: "warm", busy: false, model: "m1", effort: "high" });
  be.push("thread.control", { seq: 30, ts: at, chat_id: "chat_p", thread_ts: "task", session_id: "cse_task", data: { action: "setup", by: "project-coordinator", by_session: "cse_co" } });
  await until(() => world.thread("task").session.effort === "high");
  assert.equal(world.thread("task").stop, null);
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit(process.exitCode || 0);
