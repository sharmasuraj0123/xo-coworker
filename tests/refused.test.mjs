import assert from "node:assert/strict";
import * as H from "../core/services/notices.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const clock = () => { let now = 1000; const timers = []; return { now: () => now, set: (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; }, clear: () => {}, tick(ms) { now += ms; for (const x of timers.splice(0)) if (x.at <= now) x.fn(); else timers.push(x); } }; };
const make = () => { const c = clock(), state = { herald: null }; return { c, state, her: H.createHerald({ state, now: c.now, setTimer: c.set, clearTimer: c.clear }) }; };

t("the refused notice: Not sent, why, and what was kept; a failure's kind, forced", () => {
  assert.equal(typeof H.refusedNotice, "function", "core/services/notices.js refusedNotice(block, kept)");
  const n = H.refusedNotice("Routing is off for this chat");
  assert.deepEqual([n.kind, n.text, n.sub, n.force], ["stopped", "Not sent: Routing is off for this chat", "your words are kept", true]);
  assert.equal(H.refusedNotice("XO can't be reached", "your text is kept").sub, "your text is kept");
});
t("shown at once over a passing line, and in its turn behind an Undo (the real herald)", () => {
  assert.equal(typeof H.refusedNotice, "function");
  const A = make();
  A.her.show({ kind: "sent", text: "Sent to demo" }, 4200);
  A.her.show(H.refusedNotice("Routing is off for this chat"), 6000);
  assert.equal(A.state.herald.text, "Not sent: Routing is off for this chat", "a passing receipt doesn't hold it back");
  const B = make();
  B.her.show({ kind: "halt", text: "Stopping", undo: () => {}, undoUntil: B.c.now() + 3000 }, 3000);
  B.her.show(H.refusedNotice("Routing is off for this chat"), 6000);
  assert.equal(B.state.herald.text, "Stopping", "an Undo keeps its place");
  B.c.tick(3100);
  assert.equal(B.state.herald && B.state.herald.text, "Not sent: Routing is off for this chat", "then the refusal, in its turn");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
