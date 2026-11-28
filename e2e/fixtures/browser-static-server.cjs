// @ts-check
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};
// a stream the test writes to as it goes (Launchpad's /watch, routed here): SSE.push(event, end)
const SSE = {
  /** @type {import("node:http").ServerResponse[]} */
  clients: [],
  /** @type {unknown[]} */
  head: [],
  /** @param {unknown} ev */
  push(ev, end = false) {
    for (const client of this.clients) {
      client.write(`data: ${JSON.stringify(ev)}\n\n`);
      if (end) client.end();
    }
    if (end) this.clients = [];
  },
};
function serve() {
  const server = http.createServer((q, s) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p === "/__sse") {
      s.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
      for (const ev of SSE.head) s.write(`data: ${JSON.stringify(ev)}\n\n`);
      SSE.clients.push(s); q.on("close", () => { SSE.clients = SSE.clients.filter((c) => c !== s); });
      return;
    }
    if (p === "/") p = "/index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(s);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

module.exports = { ROOT, SSE, serve };
