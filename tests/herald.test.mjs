// The real herald (js/herald.js) and a message's own notice through its states (Astra on dfe1491, by running the real
// functions: a send failed, its Retry succeeded, and the notice still said "Not sent … open to follow the reply").
// Out → failed → Retry (out) → sent, each set whole; an unrelated Undo keeps its place; a queued notice changes too.
//   node tests/herald.test.mjs
import assert from "node:assert/strict";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e)); process.exitCode = 1; } };
let H;
await t("js/herald.js: the herald's own functions, and a message's notice for each state", async () => {
  H = await import("../js/herald.js");
  assert.equal(typeof H.createHerald, "function");
  assert.equal(typeof H.noticeFor, "function");
});
// a clock and timers the test moves by hand
const clock = () => { let now = 1000, timers = []; return { now: () => now, set: (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; }, clear: () => {}, tick(ms) { now += ms; const due = timers.filter((x) => x.at <= now); timers = timers.filter((x) => x.at > now); due.forEach((x) => x.fn()); } }; };
const make = () => { const c = clock(), state = { herald: null }; const her = H.createHerald({ state, now: c.now, setTimer: c.set, clearTimer: c.clear }); return { c, state, her }; };
const m = () => ({ id: "l1", conv: "p:demo", to: "demo", err: null });

await t("a send that fails, then is retried and goes: Sending → Not sent → Sending → Sent, its own notice each time", () => {
  const { state, her } = make(), msg = m();
  her.show(H.noticeFor(msg, "out"), 9000);
  assert.equal(state.herald.text, "Sending to demo…");
  msg.err = { title: "Message not sent" };
  assert.equal(her.forMsg(msg.id, () => H.noticeFor(msg, "failed"), 6000), true);
  assert.deepEqual([state.herald.kind, state.herald.text, state.herald.sub], ["stopped", "Not sent: Message not sent", "open the conversation to retry"]);
  // Retry: its attempt says it's out again (not "Not sent" while it's pending)
  her.forMsg(msg.id, () => H.noticeFor(msg, "out"));
  assert.deepEqual([state.herald.kind, state.herald.text], ["sent", "Sending to demo…"]);
  her.forMsg(msg.id, () => H.noticeFor(msg, "sent"));
  assert.deepEqual([state.herald.kind, state.herald.text, state.herald.sub], ["sent", "Sent to demo", "open to follow the reply"], "never 'Not sent … open to follow the reply'");
});
await t("an unrelated Undo keeps its place: the message's notice waits, and changes while it waits", () => {
  const { c, state, her } = make(), msg = m();
  her.show({ kind: "halt", text: "Stopping", undo: () => {}, undoUntil: c.now() + 3000 }, 3200);
  her.show(H.noticeFor(msg, "out"), 9000);
  assert.equal(state.herald.text, "Stopping", "the Undo stays on screen");
  msg.err = { title: "Message not sent" };
  assert.equal(her.forMsg(msg.id, () => H.noticeFor(msg, "failed"), 6000), true, "the queued notice is this message's");
  assert.equal(state.herald.text, "Stopping", "still the Undo");
  c.tick(3300);
  assert.equal(state.herald.text, "Not sent: Message not sent", "then the failure, never the stale 'Sending'");
});
await t("a failure never yields to a passing line; a passing line yields to it", () => {
  const { state, her } = make(), msg = m();
  her.show({ kind: "sent", text: "Sent to elsewhere", mid: "other" }, 9000);
  msg.err = { title: "Message not sent" };
  her.show(H.noticeFor(msg, "failed"), 6000);
  assert.equal(state.herald.text, "Not sent: Message not sent");
  her.show({ kind: "done", text: "A passing line" }, 4000);
  assert.equal(state.herald.text, "Not sent: Message not sent");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
