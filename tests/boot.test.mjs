import assert from "node:assert/strict";

let passed = 0;
const pending = [];
const t = (name, fn) => pending.push(async () => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
});

globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const realInterval = globalThis.setInterval, realTimeout = globalThis.setTimeout;
globalThis.setInterval = (fn, ms) => { const h = realInterval(fn, ms); h.unref?.(); return h; };
globalThis.setTimeout = (fn, ms, ...a) => { const h = realTimeout(fn, ms, ...a); h.unref?.(); return h; };

function fakeBackend(routes, { streamDown = false } = {}) {
  const asked = [];
  const queue = [];
  let wake = null;
  const enc = new TextEncoder();
  const push = (type, env) => { queue.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...env })}\n\n`); if (wake) { const w = wake; wake = null; w(); } };
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^api/, "").split("?")[0];
    asked.push(path);
    if (method !== "GET") throw new Error(`a ${method} was sent: tests never write`);
    if (path === "/chat/stream") {
      if (streamDown) return new Response("down", { status: 503 });
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
const until = async (cond, ms = 3000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await new Promise((r) => realTimeout(r, 5)); } };

const ROUTES = {
  "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_a", kind: "project", project: "a" }, { id: "chat_b", kind: "project", project: "b" }] },
  "/chat/chats/chat_a/threads": { threads: [] },
  "/chat/chats/chat_b/threads": { threads: [] },
  "/chat/sessions": { sessions: [] },
  "/chat/review": { items: [] },
  "/chat/chats/chat_ws/hops": { hops: [] },
  "/chat/status": { pools: [] },
  "/chat/runtimes": { runtimes: [] },
  "/chat/router": { mode: "auto" },
  "/chat/runtime-policy": { effective: { allowed: ["claude_code"] } },
  "/chat/chats/chat_a/runtime-policy": { effective: { allowed: ["codex"] }, project: {} },
  "/chat/chats/chat_b/runtime-policy": { effective: { allowed: ["claude_code"] }, project: {} },
};
const policyReads = (asked) => asked.filter((p) => /^\/chat\/chats\/[^/]+\/runtime-policy$/.test(p));

t("reads wait for the subscription: nothing but the stream is asked before its first frame", async () => {
  const be = fakeBackend(ROUTES);
  const { createWorld } = await import("../js/world.js?a");
  const world = createWorld();
  await new Promise((r) => realTimeout(r, 60));
  assert.deepEqual(be.asked, ["/chat/stream"]);
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
});

t("the first draw never waits for the projects' own policies; they follow it, each read once, a composer's on asking", async () => {
  const be = fakeBackend(ROUTES);
  const { createWorld } = await import("../js/world.js?b");
  const world = createWorld();
  let atLoaded = null;
  world.subscribe(() => { if (world.state.loaded && atLoaded == null) atLoaded = policyReads(be.asked).length; });
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
  assert.equal(atLoaded, 0, "no project policy read before the first draw");
  assert.ok(be.asked.includes("/chat/runtime-policy"), "the Space's policy is part of it");
  await until(() => world.state.chatPolicy.chat_a && world.state.chatPolicy.chat_b);
  world.act.loadChatPolicy("chat_a");
  world.act.loadChatPolicy("chat_a");
  await new Promise((r) => realTimeout(r, 40));
  assert.deepEqual(policyReads(be.asked).sort(), ["/chat/chats/chat_a/runtime-policy", "/chat/chats/chat_b/runtime-policy"]);
  assert.deepEqual(world.state.chatPolicy.chat_a.effective, { allowed: ["codex"] });
  assert.deepEqual(world.act.policyFor("a"), { allowed: ["codex"] });
});

t("a stream that can't connect doesn't hold the first load for a timer: it goes ahead when the stream says so", async () => {
  fakeBackend(ROUTES, { streamDown: true });
  const { createWorld } = await import("../js/world.js?c");
  const world = createWorld();
  const t0 = Date.now();
  await until(() => world.state.loaded, 3000);
  assert.ok(Date.now() - t0 < 1500, `loaded after ${Date.now() - t0} ms`);
});

for (const run of pending) await run();
console.log(`${passed} passed`);
process.exit(process.exitCode || 0);
