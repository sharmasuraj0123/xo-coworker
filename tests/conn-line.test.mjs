import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { createNoticeLine } from "../modules/conversation/notice-line.js";

const T = await import("../core/services/world/conn.js");
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
const RTS = [{ name: "claude_code", cli: { logged_in: true, account: "a" } }, { name: "codex", cli: { logged_in: true, account: "b" } }];
const LIMIT = { "claude_code:a": { pool: "claude_code:a", state: "closed", resets_at: "2026-11-26T19:00:00Z" }, "codex:b": { pool: "codex:b", state: "open" } };
t("one runtime at its limit pauses only what runs on it: a Codex thread or chat says nothing", () => {
  const st = w(AGENT, null, { runtimes: RTS, pools: LIMIT });
  assert.equal(T.connLine(st, { thread: true, pool: "codex:b" }), null, "a Codex thread");
  assert.equal(T.connLine(st, { pid: "alpha", pool: "codex:b" }), null, "a project whose coordinator runs on Codex");
  assert.equal(T.connLine(st, { thread: true, pool: null }), null, "no pool known");
  const held = T.connLine(st, { thread: true, pool: "claude_code:a" });
  assert.match(held.text, /^Paused until /);
  assert.match(held.sub, /^Claude Code's usage limit/);
});
const { document } = await dom('<main id="app"><div id="dock"><div id="herald"></div></div></main><div id="panel"><div id="tpdock"><div id="tpherald"></div></div></div>');
const main = { view: "home" }, reply = { view: "t:x" };
let composer = main;
const line = createNoticeLine({
  notice: () => null, world: { state: w(AGENT, OFF) }, MK: main, composerNow: () => composer,
  panelHost: () => document.getElementById("panel"), connDest: (v) => (v === "t:x" ? { thread: true } : { pid: "alpha" }), placeRegion: () => null,
});
line.heraldRender([]);
assert.match(document.getElementById("herald").textContent, /off for this chat/i);
composer = reply;
line.heraldRender([]);
assert.equal(document.getElementById("tpherald").textContent, "");
assert.equal(document.getElementById("herald").textContent, "");
const side = createNoticeLine({
  notice: () => null, world: { state: w(AGENT, null, { runtimes: RTS, pools: LIMIT }) }, MK: main, composerNow: () => reply,
  panelHost: () => document.getElementById("panel"), connDest: () => ({ thread: true, pool: "codex:b" }), placeRegion: () => null,
});
side.heraldRender([]);
assert.equal(document.getElementById("tpherald").textContent, "", "a Codex thread in the panel isn't paused by Claude Code's limit");
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
