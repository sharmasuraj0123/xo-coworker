// A fake XO Space for storm.js: answered routes, a stream the test feeds, a clock it moves, nothing written by surprise.
import assert from "node:assert/strict";

/** @type {Map<string, Function[]>} */
export const listeners = new Map();
/** @type {{fn: Function, ms: number}[]} */
export const intervals = [];
let skew = 0;
const realNow = Date.now.bind(Date);
Date.now = () => realNow() + skew;
/** Moves storm's clock forward: Date.now only, timers keep real time. */
export const advance = (ms) => { skew += ms; };

globalThis.addEventListener = (type, fn) => { (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); };
globalThis.document = /** @type {any} */ ({ hidden: false });
globalThis.matchMedia = /** @type {any} */ (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
const realInterval = globalThis.setInterval;
globalThis.setInterval = /** @type {any} */ ((fn, ms) => { intervals.push({ fn, ms }); const h = realInterval(fn, ms); h.unref?.(); return h; });
export const fire = (type) => { for (const fn of listeners.get(type) || []) fn({ type }); };

/** An error answer: `fail(409, {code, message})`. */
export const fail = (status, detail) => ({ __fail: true, status, detail });

export const BASE_ROUTES = () => ({
  "GET /chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
  "GET /chat/chats/chat_p/threads": { threads: [] },
  "GET /chat/sessions": { sessions: [] },
  "GET /chat/review": { items: [] },
  "GET /chat/chats/chat_ws/hops": { hops: [] },
  "GET /chat/status": { pools: [] },
  "GET /chat/runtimes": { runtimes: [] },
  "GET /chat/router": { mode: "auto" },
});

/** Routes: "METHOD /path" → a body, (query, body) → body, or fail(); unknown is a 404. Each stream GET is a new connection. */
export function fakeBackend(extra = {}) {
  const routes = { ...BASE_ROUTES(), ...extra };
  /** @type {{method: string, path: string, query: Record<string, string>, body: any}[]} */
  const asked = [];
  /** @type {{queue: string[], wake: Function|null, ended: boolean, lastId: string|null}[]} */
  const conns = [];
  /** @type {{status: number, detail: any}[]} */
  const refusals = [];
  const enc = new TextEncoder();
  const poke = (c) => { if (c.wake) { const w = c.wake; c.wake = null; w(); } };
  globalThis.fetch = /** @type {any} */ (async (url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const u = new URL(String(url), "http://x/");
    const path = u.pathname.replace(/^\/api/, "");
    const body = opts.body ? JSON.parse(opts.body) : null;
    asked.push({ method, path, query: Object.fromEntries(u.searchParams), body });
    if (path === "/chat/stream" && refusals.length) {
      const no = /** @type {{status: number, detail: any}} */ (refusals.shift());
      conns.push({ queue: [], wake: null, ended: true, lastId: (opts.headers || {})["Last-Event-ID"] || null });
      return new Response(JSON.stringify({ detail: no.detail }), { status: no.status, headers: { "Content-Type": "application/json" } });
    }
    if (path === "/chat/stream") {
      const c = { queue: [], wake: null, ended: false, lastId: (opts.headers || {})["Last-Event-ID"] || null };
      conns.push(c);
      return { ok: true, status: 200, type: "basic", body: { getReader: () => ({ cancel() {}, read: async () => {
        while (!c.queue.length && !c.ended) await new Promise((r) => { c.wake = r; });
        if (!c.queue.length) return { value: undefined, done: true };
        return { value: enc.encode(/** @type {string} */ (c.queue.shift())), done: false };
      } }) } };
    }
    const r = routes[`${method} ${path}`];
    if (r === undefined) return new Response(JSON.stringify({ detail: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const out = typeof r === "function" ? await r(Object.fromEntries(u.searchParams), body) : r;
    if (out && out.__fail) return new Response(JSON.stringify({ detail: out.detail }), { status: out.status, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify(out ?? null), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const conn = () => conns[conns.length - 1];
  return {
    routes, asked, conns,
    /** A frame on the newest connection; `id` makes it a stored frame (resume point). */
    push(type, env = {}, id = null) {
      const c = conn();
      c.queue.push(`${id != null ? `id: ${id}\n` : ""}event: ${type}\ndata: ${JSON.stringify({ type, ...env })}\n\n`);
      poke(c);
    },
    /** The next stream connection is answered with this error. */
    refuseStream(status, detail) { refusals.push({ status, detail }); },
    end() { const c = conn(); c.ended = true; poke(c); },
    count: (method, path) => asked.filter((a) => a.method === method && a.path === path).length,
    writes: () => asked.filter((a) => a.method !== "GET"),
  };
}

export const until = async (cond, ms = 3000) => {
  const t0 = realNow();
  while (!cond()) { if (realNow() - t0 > ms) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 5)); }
};
/** storm commits a burst of frames after 30 ms and emits after 40 ms. */
export const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

/** A world on the fake backend, past its boot; its events are kept in order. */
export async function boot(be, { seq = 1, turns = [] } = {}) {
  const { createWorld } = await import("../js/world.js");
  const world = createWorld();
  /** @type {any[]} */
  const events = [];
  world.onEvent((e) => events.push(e));
  await until(() => be.conns.length > 0);
  be.push("snapshot", { data: { seq, turns } });
  await until(() => world.state.loaded);
  await settle();
  return { world, events };
}

export function runner() {
  let passed = 0;
  /** @type {(() => Promise<void>)[]} */
  const pending = [];
  const t = (name, fn) => pending.push(async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("  FAIL " + name + "\n" + (e && e.stack)); process.exitCode = 1; }
  });
  const done = async () => {
    for (const run of pending) await run();
    console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
    process.exit(process.exitCode || 0);
  };
  return { t, done, assert };
}

export const thread = (ts, extra = {}) => ({ ts, chat_id: "chat_p", title: ts, state: "working", created_at: "2026-11-19T10:00:00Z", updated_at: "2026-11-19T10:00:00Z", ...extra });
