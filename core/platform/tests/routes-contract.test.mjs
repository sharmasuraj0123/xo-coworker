// node core/platform/tests/routes-contract.test.mjs: every route the client calls is in xo-space's OpenAPI snapshot, with that method.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SNAP = JSON.parse(readFileSync(new URL("./fixtures/openapi-routes.json", import.meta.url), "utf8"));
const templates = Object.entries(SNAP.paths).map(([p, methods]) => ({ p, methods, re: new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`) }));

globalThis.location = /** @type {any} */ ({ href: "http://127.0.0.1:5180/" });
globalThis.history = /** @type {any} */ ({ state: null, replaceState() {} });
/** @type {{ method: string, path: string, from: string }[]} */
const seen = [];
let from = "";
const record = (method, url) => { const u = new URL(String(url), "http://127.0.0.1:5180/"); seen.push({ method: method.toUpperCase(), path: u.pathname, from }); };
globalThis.fetch = /** @type {any} */ (async (url, init = {}) => {
  record(init.method || "GET", url);
  return { ok: false, status: 204, statusText: "", type: "basic", text: async () => "", json: async () => ({}), blob: async () => ({}) };
});
globalThis.XMLHttpRequest = /** @type {any} */ (class { constructor() { this.upload = {}; } open(m, u) { record(m, u); } setRequestHeader() {} send() {} abort() {} });

const { api, attachmentUrl, attachmentText, uploadAttachment, terminalSocketUrl } = await import("../api.js");

const ARGS = { pinMade: [["c", "m", true], ["c", "m", false]] };
const call = async (name, fn, args) => { from = name; try { await fn(...args); } catch { /* the answer is fake; the request is what counts */ } };
for (const [name, fn] of Object.entries(api)) {
  if (name === "streamUrl") { from = `api.${name}`; record("GET", fn()); continue; }
  for (const args of ARGS[name] || [["x", "y", "z", "w"]]) await call(`api.${name}`, fn, args);
}
await call("attachmentText", attachmentText, ["c", "a"]);
await call("uploadAttachment", (...a) => { uploadAttachment(...a); }, ["c", { type: "", size: 1 }, "n"]);
from = "attachmentUrl"; record("GET", attachmentUrl("c", "a"));
await new Promise((r) => setTimeout(r, 20));

const wsPath = new URL(terminalSocketUrl("t")).pathname;
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };
t("the client was driven: every api route made a request", () => {
  assert.ok(seen.length >= Object.keys(api).length, `${seen.length} requests`);
  for (const name of Object.keys(api)) assert.ok(seen.some((s) => s.from === `api.${name}`), `api.${name} made no request`);
  for (const name of ["attachmentText", "uploadAttachment", "attachmentUrl"]) assert.ok(seen.some((s) => s.from === name), `${name} made no request`);
});
t("each request's path and method are in xo-space's OpenAPI", () => {
  const missing = [...new Set(seen.filter(({ method, path }) => !templates.some((x) => x.re.test(path) && x.methods.includes(method))).map(({ method, path, from: f }) => `${method} ${path} (${f})`))];
  assert.deepEqual(missing, [], `routes the client calls that xo-space doesn't define (snapshot ${SNAP.taken})`);
});
t("a shell's socket hangs off a terminal session xo-space defines (OpenAPI lists no sockets)", () => {
  const session = wsPath.replace(/\/ws$/, "");
  assert.notEqual(session, wsPath, "the socket is the session's /ws");
  assert.ok(templates.some((x) => x.re.test(session) && x.methods.includes("GET")), `${session} is a terminal session in the snapshot`);
});
console.log(`\n${passed} passed`);
