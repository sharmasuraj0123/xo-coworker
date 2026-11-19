import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkManifest } from "../manifest.js";
import { createBridge, fromView, MAX_BYTES } from "../bridge.js";
import { message, tick, fakeTimers } from "./dom.mjs";

const app = /** @type {any} */ (checkManifest(JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"))).app);
const view = { sent: /** @type {any[]} */ ([]), postMessage(m, o) { this.sent.push({ m, o }); } };
const other = { postMessage() {} };
const win = new EventTarget();
/** @type {any[]} */
const log = [];
const T = fakeTimers();
const b = createBridge({
  app, granted: ["files.read", "files.write", "composer.draft"], win, frame: () => /** @type {any} */ (view), now: T.now, timers: T,
  handlers: {
    callTool: async (n, a) => { log.push(["tool", n, a]); return { content: [{ type: "text", text: "ok" }] }; },
    readResource: async (u) => { log.push(["res", u]); return { contents: [] }; },
    draft: (t) => log.push(["draft", t]),
    context: (p) => log.push(["context", p]),
    openLink: (u) => { log.push(["link", u]); return true; },
    displayMode: (m) => (m === "fullscreen" ? "fullscreen" : "inline"),
    resize: (h) => log.push(["resize", h]),
    hostContext: () => ({ theme: "dark" }),
    initialized: () => log.push(["ready"]),
  },
});
let id = 0;
/** @param {string} method @param {unknown} [params] @param {object} [ev] */
async function ask(method, params, ev = {}) {
  const n = ++id;
  view.sent.length = 0;
  win.dispatchEvent(Object.assign(message({ jsonrpc: "2.0", id: n, method, params }, view), ev));
  await tick(); await tick();
  return view.sent.find((s) => s.m.id === n)?.m;
}

assert.equal(fromView(/** @type {any} */ (message({}, view, "null")), /** @type {any} */ (view)), true);
assert.equal(fromView(/** @type {any} */ (message({}, view, "http://127.0.0.1:3000")), /** @type {any} */ (view)), false, "a frame with our origin isn't sandboxed: refused");
assert.equal(fromView(/** @type {any} */ (message({}, other, "null")), /** @type {any} */ (view)), false);

win.dispatchEvent(message({ jsonrpc: "2.0", id: 99, method: "ping" }, other));
await tick();
assert.equal(view.sent.length, 0, "another frame gets nothing");
view.sent.length = 0;
win.dispatchEvent(message({ jsonrpc: "2.0", id: 98, method: "ping" }, view, "https://evil.example"));
await tick();
assert.equal(view.sent.length, 0, "a non-opaque origin gets nothing");

assert.match((await ask("tools/call", { name: "word_read" })).error.message, /initialize first/);
const init = await ask("ui/initialize", { protocolVersion: "2026-01-26" });
assert.equal(init.result.protocolVersion, "2026-01-26");
assert.deepEqual(init.result.hostContext, { theme: "dark" });
assert.equal(view.sent[0].o, "*");
await ask("ui/notifications/initialized");
assert.equal(b.ready, true);

assert.deepEqual((await ask("tools/call", { name: "word_read", arguments: { path: "a" } })).result.content[0].text, "ok");
assert.match((await ask("tools/call", { name: "agent_only" })).error.message, /no tool "agent_only"/);
assert.match((await ask("tools/call", { name: "__proto__" })).error.message, /no tool/);
assert.match((await ask("tools/call", { name: "word_read", arguments: [1] })).error.message, /object/);
assert.match((await ask("resources/read", { uri: "ui://other.app/x" })).error.message, /own app's/);
assert.ok((await ask("resources/read", { uri: "ui://dev.example.word/card" })).result);

assert.match((await ask("xo/route", { method: "GET", path: "/api/chat/status" })).error.message, /doesn't offer/);

assert.ok((await ask("ui/message", { role: "user", content: [{ type: "text", text: "Tighten §2" }] })).result);
assert.deepEqual(log.find((l) => l[0] === "draft"), ["draft", "Tighten §2"]);
assert.match((await ask("ui/update-model-context", { content: [] })).error.message, /may not tell the agent/);
assert.match((await ask("ui/open-link", { url: "http://example.com" })).error.message, /only https/);
assert.match((await ask("ui/open-link", { url: "javascript:alert(1)" })).error.message, /only https/);
assert.match((await ask("ui/open-link", { url: "https://u:p@example.com" })).error.message, /only https/);
assert.deepEqual((await ask("ui/open-link", { url: "https://example.com/a" })).result, { opened: true });
assert.match((await ask("sampling/createMessage", {})).error.message, /doesn't offer/);
assert.match((await ask("xo/oneshot", {})).error.message, /doesn't offer/);
assert.deepEqual((await ask("ui/request-display-mode", { mode: "pip" })).result, { mode: "inline" });

assert.match((await ask("tools/call", { name: "word_read", arguments: { blob: "x".repeat(MAX_BYTES) } })).error.message, /1 MiB/);
assert.ok(!log.some((l) => l[0] === "tool" && l[2].blob), "an oversized call never reaches the backend");

T.advance(10000);
let refused = 0;
for (let i = 0; i < 60; i++) {
  win.dispatchEvent(message({ jsonrpc: "2.0", id: 1000 + i, method: "ping" }, view));
}
await tick();
refused = view.sent.filter((s) => s.m.error && /slow down/.test(s.m.error.message)).length;
assert.equal(refused, 10, "a burst of 50, then refused");
T.advance(1000);
assert.ok((await ask("ping")).result, "20 a second come back");

const p = b.request("ui/resource-teardown", {}, 500);
const req = view.sent[view.sent.length - 1].m;
win.dispatchEvent(message({ jsonrpc: "2.0", id: req.id, result: { ok: 1 } }, view));
assert.deepEqual(await p, { ok: 1 });
const late = b.request("ping", undefined, 500);
T.advance(600);
await assert.rejects(late, /didn't answer/);

b.close();
view.sent.length = 0;
win.dispatchEvent(message({ jsonrpc: "2.0", id: 5000, method: "ping" }, view));
await tick();
assert.equal(view.sent.length, 0, "a closed bridge answers nothing");
console.log("ok bridge: own frame and opaque origin only, allow-listed methods, grants, no direct routes, size and rate caps");
