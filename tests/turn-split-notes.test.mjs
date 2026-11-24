// A running turn splits at a coordinator's note or an ask as it does at a message, so work done after one sits below it.
import assert from "node:assert/strict";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { turnSegments } = await import("../modules/conversation/blocks/turn.js");
const { createConversationMessages } = await import("../modules/conversation/messages.js");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the 21 Nov Chats turn: 6 steps, the steer and its note, 20 steps, the ask and answer, the rest", () => {
  const turn = { seq: 481386, status: "running", at: "2026-11-21T08:50:36Z" };
  const blocks = [];
  for (let i = 0; i < 6; i++) blocks.push({ seq: 481400 + i });
  for (let i = 0; i < 20; i++) blocks.push({ seq: 481950 + i });
  for (let i = 0; i < 30; i++) blocks.push({ seq: 482300 + i });
  const says = [{ seq: 481937, who: "control" }, { seq: 481938, who: "coord" }, { seq: 482206, who: "asked" }, { seq: 482226, who: "coord" }];
  const segs = turnSegments(turn, blocks, says);
  assert.deepEqual(segs.map((s) => s.blocks.length), [6, 20, 30]);
  assert.equal(segs.at(-1).last && segs.at(-1).seq > 482226, true);
});

t("the turn is split after the notes, asks, relays and steers are on the list, and reads them", () => {
  const at = new Date("2026-11-21T08:50:36Z").getTime();
  const time = (seconds) => new Date(at + seconds * 1000).toISOString();
  const thread = { id: "thread", project: "demo", sessionId: "session", loaded: true, busy: true, messages: [] };
  const turn = { id: "turn", session: "session", seq: 10, status: "running", at: time(0) };
  const blocks = [{ seq: 11, text: "Read" }, { seq: 14, text: "Edited" }];
  const hops = [
    { id: "note", kind: "relay", from_role: "project-coordinator", to_role: "thread", note: "Scope update", seq: 13 },
    { id: "ask", kind: "ask", from_role: "thread", to_role: "project-coordinator", note: "Ask first", seq: 15 },
    { id: "answer", kind: "answer", from_role: "project-coordinator", to_role: "thread", note: "Proceed", seq: 16, cause: "ask" },
  ].map((hop) => ({ ...hop, thread_ts: thread.id, created_at: time(hop.seq) }));
  const messagesOf = createConversationMessages({
    world: {
      state: {
        hist: {}, timeline: { demo: [] }, hops: new Map(hops.map((hop) => [hop.id, hop])),
        controls: { thread: [{ at: time(12), seq: 12, action: "steer" }] },
        turns: { running: () => turn, list: (pick) => [turn].filter(pick), blocksOf: () => blocks },
      },
      act: {},
    },
    shape: { on: () => false }, PROJ: () => "Demo", convThread: () => thread, chatOf: () => "demo",
    localMessages: { alias: () => null, list: () => [], mergeEchoes() {} },
  });
  const projected = messagesOf("t:thread").filter((message) => message.seq != null);
  assert.deepEqual(projected.map((message) => [message.who, message.seq]), [
    ["turn", 10], ["control", 12], ["coord", 13], ["turn", 14], ["asked", 15], ["coord", 16], ["turn", 16.5],
  ]);
  assert.deepEqual(projected.filter((message) => message.who === "turn").map((message) => message.blocks.length), [1, 1, 0]);
  assert.equal(projected[2].lead, "ctl:12");
  assert.equal(projected.at(-1).turn.status, "running");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
