// @ts-check

/** @import { Seed, Space, FrameMeta } from "./types.d.ts" @import { IncomingMessage, ServerResponse } from "node:http" */

// The fake Space: the repo's files, /api from a seeded store, and a live /api/chat/stream, on 127.0.0.1:0.

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { createStore, answer } from "./store.mjs";

/** @type {Record<string, string>} */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".wasm": "application/wasm", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".md": "text/markdown" };
const HEARTBEAT_MS = 15000;

/** A request's JSON body: {body} (null when empty), {bad} when it isn't JSON, {gone} when the client left first. @param {IncomingMessage} req @returns {Promise<{body?: unknown, bad?: string, gone?: true}>} */
function bodyOf(req) {
  return new Promise((ok) => {
    let b = "";
    req.on("data", (c) => { b += c; });
    req.on("end", () => { try { ok({ body: b ? JSON.parse(b) : null }); } catch (e) { ok({ bad: String(/** @type {Error} */ (e).message) }); } });
    req.on("error", () => ok({ gone: true }));
    req.on("close", () => { if (!req.complete) ok({ gone: true }); });
  });
}

/** @param {{root: string, seed?: Seed}} o @returns {Promise<Space>} */
export async function startSpace({ root, seed = {} }) {
  const ROOT = resolve(root);
  const store = createStore(seed);
  /** @type {Set<ServerResponse>} */
  const streams = new Set();
  /** @type {{seq: number, text: string}[]} */
  const sent = [];
  /** @type {Set<() => void>} */
  const waiters = new Set();
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, Promise<void>>} */
  const gates = new Map();
  let open = 0, served = 0;
  const done = () => { served++; if (--open === 0) for (const w of [...waiters]) w(); };

  /** A frame to every stream; a frame for a row just numbered keeps that row's seq. @param {string} type @param {unknown} [data] @param {FrameMeta} [meta] */
  function push(type, data = {}, { chat_id = null, thread_ts = null, session_id = null, turn_id = null, seq = null } = {}) {
    const n = seq ?? ++store.seq;
    const env = { type, id: String(n), seq: n, ts: store.now, chat_id, session_id, thread_ts, turn_id, run_id: null, data };
    const text = `id: ${n}\nevent: ${type}\ndata: ${JSON.stringify(env)}\n\n`;
    sent.push({ seq: n, text });
    for (const s of streams) s.write(text);
  }

  /** @param {IncomingMessage} req @param {ServerResponse} res */
  async function stream(req, res) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.flushHeaders();
    await gates.get(new URL(req.url || "/", "http://e2e").pathname);
    if (res.destroyed) return;
    const after = Number(req.headers["last-event-id"]);
    if (req.headers["last-event-id"] && Number.isFinite(after)) { for (const f of sent) if (f.seq > after) res.write(f.text); }
    else res.write(`event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", id: null, seq: null, ts: null, chat_id: null, session_id: null, thread_ts: null, turn_id: null, run_id: null, data: { seq: store.seq, turns: [] } })}\n\n`);
    const beat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_MS);
    beat.unref();
    streams.add(res);
    req.on("close", () => { clearInterval(beat); streams.delete(res); });
  }

  /** @param {IncomingMessage} req @param {ServerResponse} res @param {URL} url */
  async function api(req, res, url) {
    const method = req.method || "GET";
    await gates.get(url.pathname);
    const got = method === "GET" || method === "HEAD" ? { body: null } : await bodyOf(req);
    if (got.gone) { res.destroy(); return; }
    if (got.bad) {
      errors.push(`${method} ${url.pathname}: the body isn't JSON (${got.bad})`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: { code: "bad_json", message: got.bad } }));
      return;
    }
    const { answer: a, frames } = answer(store, { method, path: url.pathname, query: url.searchParams, body: got.body });
    res.writeHead(a.status, { "Content-Type": a.type || "application/json", "Cache-Control": "no-store" });
    res.end(typeof a.body === "string" ? a.body : JSON.stringify(a.body));
    for (const f of frames) push(f.type, f.data, f);
  }

  /** @param {ServerResponse} res @param {URL} url */
  function file(res, url) {
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; }
    const f = join(ROOT, p === "/" ? "/index.html" : p);
    let st = null;
    try { st = statSync(f); } catch { /* none */ }
    if (!f.startsWith(ROOT + sep) || !st || st.isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(f).on("error", (e) => { errors.push(`reading ${p}: ${e.message}`); res.destroy(); }).pipe(res);
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://e2e");
    if (url.pathname === "/api/chat/stream") return stream(req, res);
    open++;
    if (!url.pathname.startsWith("/api/")) { res.on("close", done); return file(res, url); }
    api(req, res, url).catch((e) => {
      errors.push(`${req.method} ${url.pathname}: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" ") : e}`);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: { code: "e2e_space_error", message: String(e) } }));
    }).finally(done);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(undefined)));
  const addr = server.address();
  const base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  return {
    base, store, push, errors,
    get misses() { return store.misses; },
    get open() { return open; },
    get served() { return served; },
    gate(path) {
      /** @type {() => void} */
      let release = () => {};
      gates.set(path, new Promise((ok) => { release = () => { gates.delete(path); ok(); }; }));
      return release;
    },
    idle(ms) {
      if (open === 0) return Promise.resolve(true);
      return new Promise((ok) => {
        const w = () => { clearTimeout(t); waiters.delete(w); ok(true); };
        const t = setTimeout(() => { waiters.delete(w); ok(false); }, ms);
        waiters.add(w);
      });
    },
    async close() {
      for (const s of streams) s.end();
      streams.clear();
      server.closeAllConnections();
      await new Promise((ok) => server.close(() => ok(undefined)));
    },
  };
}
