// A thread read in pages, newest first (js/timeline.js): the cursor, when to ask for the next page, what
// a paged conversation shows, and a session's older frames applied after its newer ones (js/blocks.js).
// No network, no DOM.
//   node tests/paging.test.mjs
import assert from "node:assert/strict";

const { pageAfter, canPageOlder, pageFloor, inPage, framesShort } = await import("../js/timeline.js");
const { createTurns } = await import("../js/blocks.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const msg = (seq, who = "agent") => ({ id: `m${seq}`, seq, who, at: seq * 1000 });

t("the cursor: storm's next_before_seq, and none means the beginning", () => {
  let h = { loading: true, loaded: false };
  h = pageAfter(h, { messages: [msg(50), msg(60)], next_before_seq: 50 });
  assert.deepEqual([h.loaded, h.all, h.before, h.paged], [true, false, 50, true]);
  h = pageAfter(h, { messages: [msg(10), msg(20)], next_before_seq: null });
  assert.deepEqual([h.all, h.before, h.paged], [true, null, true], "read to the start; it had more than one page");
  // a thread that fits one page never had another: its beginning needn't be announced
  const one = pageAfter({}, { messages: [msg(1)] });
  assert.deepEqual([one.all, one.paged], [true, false]);
  // next_before_seq 0 is a cursor, not "none"
  assert.equal(pageAfter({}, { next_before_seq: 0 }).all, false);
});

t("the next older page is asked for once, and never while one is on its way", () => {
  const h = { loaded: true, all: false, before: 50 };
  assert.equal(canPageOlder(h), true);
  assert.equal(canPageOlder({ ...h, older: true }), false, "one on its way");
  assert.equal(canPageOlder({ ...h, loading: true }), false, "the first page still loading");
  assert.equal(canPageOlder({ ...h, all: true }), false, "nothing older");
  assert.equal(canPageOlder({ ...h, olderError: "timeout" }), false, "a failure waits for Try again");
  assert.equal(canPageOlder({ ...h, loaded: false }), false);
  assert.equal(canPageOlder({ ...h, before: null }), false);
  assert.equal(canPageOlder(null), false);
});

t("a paged thread shows what its pages hold: older items wait for their page", () => {
  const h = { loaded: true, all: false, before: 50 };
  const rows = [msg(60), msg(50), msg(70, "you")];
  const floor = pageFloor(h, rows);
  assert.equal(floor, 50);
  assert.equal(pageFloor({ ...h, all: true }, rows), null, "all read: nothing waits");
  assert.equal(pageFloor({ loaded: false }, rows), null);
  const at = 50000;
  // the root request (older), a coordinator's note between pages, a turn that ended before the page
  assert.equal(inPage({ who: "you", seq: 5, at: 5000 }, floor, at), false);
  assert.equal(inPage({ who: "coord", seq: 49, at: 49000 }, floor, at), false);
  assert.equal(inPage({ who: "turn", seq: 30, turn: { lastSeq: 45 } }, floor, at), false);
  // a turn that started before the page and ended in it: the work behind its oldest message shows
  assert.equal(inPage({ who: "turn", seq: 40, turn: { lastSeq: 55 } }, floor, at), true);
  assert.equal(inPage({ who: "agent", seq: 50 }, floor, at), true);
  // no seq: by time (a move's banner from the thread's start waits; your unsent message doesn't)
  assert.equal(inPage({ who: "system", at: 100 }, floor, at), false);
  assert.equal(inPage({ who: "you", at: 90000 }, floor, at), true);
  // the line at the top always shows
  assert.equal(inPage({ who: "hist", at: -Infinity }, floor, at), true);
  assert.equal(inPage({ who: "you", seq: 1 }, null), true, "not paged: everything");
});

t("a session's older frames are read until they reach the page's oldest message", () => {
  assert.equal(framesShort(16171, 11047), true);
  assert.equal(framesShort(11000, 11047), false, "already reach it");
  assert.equal(framesShort(null, 11047), false, "all read");
  assert.equal(framesShort(16171, null), false);
});

t("older frames applied after newer ones: a finished turn gets its blocks, and no stray open one", () => {
  const T = createTurns();
  const f = (type, seq, data, turn = "tu") => T.apply({ type, envelope: { type, seq, turn_id: turn, session_id: "s", ts: `2026-11-04T10:00:${String(seq % 60).padStart(2, "0")}Z`, data } });
  // the newest page first: the turn's end and its last block
  f("block.started", 105, { block: { id: "b2", type: "activity", index: 1, rows: [] } });
  f("block.finished", 106, { block: { id: "b2", type: "activity", index: 1, header: "Ran a command", rows: [] } });
  f("turn.finished", 107, { status: "finished" });
  // then the page before it (as a thread pages back): its start, a finished block, and one that only streamed
  f("turn.started", 100, {});
  f("block.started", 101, { block: { id: "b1", type: "thinking", index: 0 } });
  f("block.finished", 102, { block: { id: "b1", type: "thinking", index: 0, header: "Thought for 2s" } });
  f("block.started", 103, { block: { id: "stray", type: "text", index: null } });
  const tu = T.get("tu");
  assert.equal(tu.status, "finished", "still finished");
  assert.equal(tu.seq, 100, "it starts where its first frame is");
  assert.deepEqual(T.blocksOf(tu).map((b) => [b.id, b.done]), [["b1", true], ["b2", true]], "in order; the block that never finished was dropped when it ended");
  // a running turn still takes a block that starts
  f("turn.started", 200, {}, "t2");
  f("block.started", 201, { block: { id: "x", type: "text", index: null } }, "t2");
  assert.equal(T.blocksOf(T.get("t2")).length, 1);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
