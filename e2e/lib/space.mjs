// @ts-check

/** @import { Seed, Space, FrameMeta } from "./types.d.ts" @import { IncomingMessage } from "node:http" */

// The fake Space: the repo's files, /api from a seeded store, and a live /api/chat/stream, on 127.0.0.1:0.

import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { createStore, answer } from "./store.mjs";

/** @type {Record<string, string>} */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".wasm": "application/wasm", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".md": "text/markdown" };

/** Read a request's body as JSON (null when empty or not JSON). @param {IncomingMessage} req @returns {Promise<any>} */
function bodyOf(req) {
  return new Promise((ok) => {
    let b = "";
    req.on("data", (c) => { b += c; });
    req.on("end", () => { try { ok(b ? JSON.parse(b) : null); } catch { ok(null); } });
    req.on("error", () => ok(null));
  });
}

/** @param {{root: string, seed?: Seed}} o @returns {Promise<Space>} */
export async function startSpace({ root, seed = {} }) {
  const ROOT = resolve(root);
  const store = createStore(seed);
  /** @type {Set<import("node:http").ServerResponse>} */
  const streams = new Set();
  let open = 0; // API requests being answered; the stream never counts
  const log = /** @type {string[]} */ ([]);

  /** A frame to every stream; a frame for a row just numbered keeps that row's seq. @param {string} type @param {unknown} [data] @param {FrameMeta} [meta] */
  function push(type, data = {}, { chat_id = null, thread_ts = null, session_id = null, turn_id = null, seq = null } = {}) {
    const n = seq ?? ++store.seq;
    const env = { type, id: String(n), seq: n, ts: store.now, chat_id, session_id, thread_ts, turn_id, run_id: null, data };
    const text = `id: ${n}\nevent: ${type}\ndata: ${JSON.stringify(env)}\n\n`;
    for (const s of streams) s.write(text);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://e2e");
    let p = decodeURIComponent(url.pathname);
    if (p === "/api/chat/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      const env = { type: "snapshot", id: null, seq: null, ts: null, chat_id: null, session_id: null, thread_ts: null, turn_id: null, run_id: null, data: { seq: store.seq, turns: [] } };
      res.write(`event: snapshot\ndata: ${JSON.stringify(env)}\n\n`);
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    if (p.startsWith("/api/")) {
      open++;
      try {
        const body = req.method === "GET" || req.method === "HEAD" ? null : await bodyOf(req);
        const { answer: a, frames } = answer(store, { method: req.method || "GET", path: p, query: url.searchParams, body });
        log.push(`${req.method} ${p}${url.search} → ${a.status}`);
        res.writeHead(a.status, { "Content-Type": a.type || "application/json", "Cache-Control": "no-store" });
        res.end(typeof a.body === "string" ? a.body : JSON.stringify(a.body));
        for (const f of frames) push(f.type, f.data, f);
      } finally { open--; }
      return;
    }
    if (p === "/") p = "/index.html";
    const f = join(ROOT, p);
    let st = null;
    try { st = statSync(f); } catch { /* none */ }
    if (!f.startsWith(ROOT + sep) || !st || st.isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(f).pipe(res);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(undefined)));
  const addr = server.address();
  const base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  return {
    base, store, push, log,
    get open() { return open; },
    async close() {
      for (const s of streams) s.end();
      streams.clear();
      server.closeAllConnections();
      await new Promise((ok) => server.close(() => ok(undefined)));
    },
  };
}
