// The line above the composer and the send gate are one rule (Launchpad grader on 83929bb): both ask about where the
// draft goes (composerDest()). A reply in a thread is never routed, so no routing-Off line shows beside its Send; a
// draft naming a chat whose routing is off shows it; a real connection or runtime failure shows wherever you are.
// No browser.
//   node tests/conn-line.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const T = await import("../js/timeline.js");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
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
t("the app draws the line for the composer's destination (the gate's), not this place's chat", () => {
  assert.match(app, /connLine\(world\.state, connDest\(\)\)/, "the line asks about connDest()");
  assert.match(app, /function connDest\(\) \{[^}]*composerDest\(\)/, "which is composerDest(), the gate's");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
