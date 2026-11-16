// What the app says and does about routing Off is what xo-space does (chats/router.py effective(): a chat's own routing
// over the Space's; chats/delivery.py: only a new message to a chat's timeline is checked, a reply in a thread never
// is). Astra on dd15034 (C111): "New messages to the Workspace and projects are refused" was untrue for a chat with
// its own routing, and the composer refused to send there too. No browser.
//   node tests/routing-truth.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const T = await import("../js/timeline.js");
const w = (router, own = null) => ({ loaded: true, runtimes: [], pools: {}, router, projects: [{ id: "workspace", routing: null }, { id: "alpha", routing: own }] });
const OFF = { mode: "off" }, AGENT = { mode: "agent" };

await t("routingOf: a chat's own routing wins over the Space's; without one, the Space's", () => {
  assert.equal(typeof T.routingOf, "function", "timeline.js has routingOf");
  assert.deepEqual(T.routingOf(w(OFF, AGENT), "alpha"), AGENT);
  assert.deepEqual(T.routingOf(w(OFF), "alpha"), OFF);
  assert.deepEqual(T.routingOf(w(AGENT, OFF), "alpha"), OFF);
  assert.deepEqual(T.routingOf(w(OFF, AGENT), "workspace"), OFF);
});
await t("the composer: Space Off refuses a new message only where the Space's routing applies; a chat with its own takes it", () => {
  assert.equal(T.sendBlock(w(OFF, AGENT), { timeline: true, pid: "alpha" }), "", "alpha routes itself: it takes new messages");
  assert.match(T.sendBlock(w(OFF), { timeline: true, pid: "alpha" }), /router is off/i, "alpha uses the Space's: refused, as the server would");
  assert.match(T.sendBlock(w(AGENT, OFF), { timeline: true, pid: "alpha" }), /off/i, "alpha's own Off refuses even with the Space's on");
  assert.equal(T.sendBlock(w(OFF), { timeline: false, pid: "alpha" }), "", "a reply in a thread is never refused (delivery.py's thread path checks no routing)");
});
await t("the line above the composer says Off only where it applies, in words true to the server", () => {
  assert.equal(T.connLine(w(OFF, AGENT), { pid: "alpha" }), null, "no Off line in a chat that routes itself");
  const l = T.connLine(w(OFF), { pid: "alpha" });
  assert.ok(l && /router is off/i.test(l.text), "Off where the Space's routing applies");
  assert.doesNotMatch(l.sub, /Workspace and projects are refused/, "never that every Workspace and project refuses");
  assert.match(l.sub, /using it|use it/, "the chats using it");
  assert.match(l.sub, /threads/, "and that replies in threads still go");
});
await t("Settings' Off says what the server does: chats using this setting refuse new messages; replies inside threads still work", () => {
  const s = readFileSync(new URL("../js/settings.js", import.meta.url), "utf8");
  const m = /opt\("off", null, "Off", "([^"]+)"\)/.exec(s);
  assert.ok(m, "the Off choice");
  assert.doesNotMatch(m[1], /New messages to the Workspace and projects are refused/);
  assert.match(m[1], /using this setting|use this setting/);
  assert.match(m[1], /its own routing/);
  assert.match(m[1], /[Rr]eplies inside threads still work/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
