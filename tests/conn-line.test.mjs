import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { createNoticeLine } from "../modules/conversation/notice-line.js";

const T = await import("../core/services/world/timeline.js");
const w = (router, own = null, extra = {}) => ({ loaded: true, runtimes: [], pools: {}, router, projects: [{ id: "workspace", routing: null }, { id: "alpha", routing: own }], ...extra });
const OFF = { mode: "off" }, AGENT = { mode: "agent" };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a reply in a thread: no routing-Off line (it's never routed), as the gate lets it go", () => {
  assert.equal(T.connLine(w(OFF), { thread: true }), null, "Space Off, a thread's reply: no line");
  assert.equal(T.connLine(w(AGENT, OFF), { thread: true }), null, "its chat's own Off, a thread's reply: no line");
  assert.equal(T.sendBlock(w(OFF), { timeline: false }), "", "and the gate lets it go");
});
t("a draft to a chat whose routing is off: the line says so, as the gate refuses it", () => {
  assert.match(T.connLine(w(OFF), { pid: "workspace" }).text, /router is off/i);
  assert.match(T.connLine(w(AGENT, OFF), { pid: "alpha" }).text, /off for this chat/i);
});
t("a real failure shows wherever you are, a thread's reply too", () => {
  assert.equal(T.connLine(w(AGENT, null, { conn: "down" }), { thread: true }).kind, "down");
  assert.match(T.connLine(w(AGENT, null, { runtimes: [{ name: "claude_code", cli: { logged_in: false } }] }), { thread: true }).text, /isn't connected/);
});
const { document } = await dom('<main id="app"><div id="dock"><div id="herald"></div></div></main><div id="panel"><div id="tpdock"><div id="tpherald"></div></div></div>');
const main = {}, reply = {};
let composer = main;
const line = createNoticeLine({
  S: { view: "home", herald: null }, world: { state: w(AGENT, OFF) }, MK: main, composerNow: () => composer,
  panelHost: () => document.getElementById("panel"), connDest: () => ({ pid: "alpha" }), placeRegion: () => null,
});
line.heraldRender([]);
assert.match(document.getElementById("herald").textContent, /off for this chat/i);
composer = reply;
line.heraldRender([]);
assert.equal(document.getElementById("tpherald").textContent, "");
assert.equal(document.getElementById("herald").textContent, "");
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
