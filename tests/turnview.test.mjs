// How a turn's blocks render (js/turnview.js): the files a turn changed, and the runtime's own
// diagnostics kept out of the conversation. No network.
//   node tests/turnview.test.mjs
import assert from "node:assert/strict";

// js/ui.js reads the reduced-motion setting when it loads
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { turnHtml, turnSegments, segmentTurn } = await import("../js/turnview.js");
const { createTurns } = await import("../js/blocks.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const turn = (status = "finished") => ({ id: "t1", status, at: "2026-10-26T11:44:48Z", end: { wall_ms: 7000 } });
const answer = { id: "a", type: "answer", done: true, text: "Done." };
const row = (i, kind, target, status = "ok") => ({ call_id: `x:${i}`, kind, status, line: `${kind} ${target}`, target });
const chips = (html) => (html.match(/class="tb-cfn">([^<]+)/g) || []).map((m) => m.split(">")[1]);

t("one tool group and no thinking (codex): its files still show as chips", () => {
  const act = { id: "g0", type: "activity", done: true, header: "Created 2 files", rows: [row(0, "create_file", "/p/alpha.txt"), row(1, "create_file", "/p/beta.md")] };
  assert.deepEqual(chips(turnHtml(turn(), [act, answer])), ["alpha.txt", "beta.md"]);
  // not while it runs, not when the group is open (its rows say it), not for a failed or shared file
  assert.deepEqual(chips(turnHtml(turn("running"), [{ ...act, done: false }])), []);
  assert.deepEqual(chips(turnHtml(turn(), [act, answer], { open: { g0: true } })), []);
  const mixed = { ...act, rows: [row(0, "create_file", "/p/a.md"), row(1, "edit_file", "/p/b.md", "error"), row(2, "delete_file", "/p/c.md"), row(3, "edit_file", "/p/d.md")] };
  const shared = { id: "f", type: "shared_files", done: true, files: [{ path: "d.md", name: "d.md" }] };
  assert.deepEqual(chips(turnHtml(turn(), [mixed, shared, answer])), ["a.md"]);
});

t("folded work (claude) keeps its chips under the fold, once", () => {
  const think = { id: "th", type: "thinking", done: true, header: "Thought for 2s" };
  const act = { id: "g0", type: "activity", done: true, header: "Created a file", rows: [row(0, "create_file", "/p/one.md")] };
  const html = turnHtml(turn(), [think, act, answer]);
  assert.deepEqual(chips(html), ["one.md"]);
  assert.match(html, /tb-work/);
});

t("a runtime's unknown-wire notice stays out of the conversation", () => {
  const notice = { call_id: "notice:8", kind: "notice", status: "ok", line: "codex sent something this runtime doesn't know (x/y)", summary: "unknown_wire" };
  const info = console.info; const logged = []; console.info = (m) => logged.push(m);
  try {
    const alone = turnHtml(turn(), [answer, { id: "g1", type: "activity", done: true, header: notice.line, rows: [notice] }]);
    assert.ok(!alone.includes("doesn't know"), "a group of only that notice goes");
    assert.ok(alone.includes("Done."));
    const withWork = turnHtml(turn(), [{ id: "g2", type: "activity", done: true, header: "Ran a command", rows: [notice, row(0, "command", "ls")] }], { open: { g2: true } });
    assert.ok(!withWork.includes("doesn't know") && withWork.includes("command ls"), "other rows stay");
    assert.equal(logged.length, 1, "said once, to the console");
    // other notices are the agent's news and stay
    const other = turnHtml(turn(), [{ id: "g3", type: "activity", done: true, header: "Note", rows: [{ ...notice, summary: "rate_limited", line: "Slowed down" }] }], { open: { g3: true } });
    assert.ok(other.includes("Slowed down"));
  } finally { console.info = info; }
});

t("one left edge: a one-group turn's files sit inside its line's block, as under the fold", () => {
  const act = { id: "g0", type: "activity", done: true, header: "Created a file", rows: [row(0, "create_file", "/p/a.md")] };
  const html = turnHtml(turn(), [act, answer]);
  // the chips close inside the group's own div, so a layer that styles a block's content reaches them
  assert.match(html, /<div class="tb tb-act" data-b="g0">.*<ul class="tb-chg"[^]*<\/ul><\/div><div class="tb tb-answer/);
});

t("blocks and rows carry their keys, so what's new can arrive and a fold can glide", () => {
  const think = { id: "th", type: "thinking", done: true, header: "Thought for 2s" };
  const act = { id: "g0", type: "activity", done: false, header: "Running", rows: [row(0, "command", "ls", "running")] };
  const live = turnHtml({ ...turn("running"), id: "t9" }, [think, act]);
  assert.match(live, /class="tb tb-work is-live" data-b="work:t9"/);
  assert.match(live, /<li class="tb-row s-running" data-r="x:0"[^>]*>/);
  const open = turnHtml({ ...turn("running"), id: "t9" }, [think, act], { open: { "work:t9": true } });
  assert.match(open, /data-b="th"/);
  assert.match(open, /data-b="g0"/);
});

// ── a turn split where a message came during it: work, the message, later work, each where it happened ──
const T0 = Date.parse("2026-11-04T11:00:00Z");
const blk = (id, seq, type = "activity", done = true) => ({ id, seq, type, done, header: id, rows: type === "activity" ? [row(seq, "command", done ? "ok" : "running", "ls")] : undefined });
const say = (seq, sec) => ({ seq, at: T0 + sec * 1000 });

t("a finished turn that spoke halfway: its work before the message, then after it", () => {
  const tu = { id: "tu", status: "finished", seq: 100, lastSeq: 140, at: new Date(T0).toISOString(), end: { wall_ms: 90000 } };
  const segs = turnSegments(tu, [blk("a", 101, "thinking"), blk("b", 103), blk("c", 121, "thinking"), blk("d", 125)], [say(90, -5), say(110, 30), say(150, 95)]);
  // the message before the turn (90) and the one after it (150) don't cut it; the one at 110 does
  assert.deepEqual(segs.map((s) => [s.k, s.blocks.map((b) => b.id).join(""), s.seq, s.last]), [[0, "ab", 100, false], [1, "cd", 121, true]]);
  // each stretch is timed on its own: start to the message (30 s), the message to the turn's end (60 s)
  const [one, two] = segs.map((s) => segmentTurn(tu, s));
  assert.deepEqual([one.id, one.status, one.end.wall_ms], ["tu", "finished", 30000]);
  assert.deepEqual([two.id, two.status, two.end.wall_ms], ["tu#1", "finished", 60000]);
  assert.match(turnHtml(one, segs[0].blocks), /Worked 30s/);
  assert.match(turnHtml(two, segs[1].blocks), /Worked 1m 0s/);
  // one stretch's fold is its own
  assert.match(turnHtml(two, segs[1].blocks), /data-tb="work:tu#1"/);
});

t("a running turn: the latest stretch is the live one, under the latest message; the earlier is done", () => {
  const tu = { id: "tu", status: "running", seq: 100, lastSeq: 105, at: new Date(T0).toISOString(), end: null };
  // the agent spoke at 108, after the turn's last frame so far: a running turn is cut by it all the same
  let segs = turnSegments(tu, [blk("a", 101, "thinking"), blk("b", 103, "activity", false)], [say(108, 20)]);
  assert.deepEqual(segs.map((s) => [s.k, s.blocks.length, s.last]), [[0, 2, false], [1, 0, true]]);
  const early = segmentTurn(tu, segs[0]), now = segmentTurn(tu, segs[1]);
  assert.equal(early.status, "finished", "work before the message reads as done");
  assert.equal(now.status, "running");
  // the empty latest stretch still says it's working, under the message (working: a stretch after a message)
  const live = turnHtml(now, segs[1].blocks, { working: true, now: T0 + 32000 });
  assert.match(live, /class="turn is-live"/);
  assert.match(live, /Working · <span class="elapsed" data-since="\d+">12s</);
  assert.equal(turnHtml(now, segs[1].blocks), "", "without working: as before, nothing until there is work");
  // more work comes: it joins the live stretch, the one before the message doesn't move
  segs = turnSegments(tu, [blk("a", 101, "thinking"), blk("b", 103), blk("c", 112, "thinking", false), { id: "x", type: "text", done: false, text: "…" }], [say(108, 20)]);
  assert.deepEqual(segs.map((s) => s.blocks.map((b) => b.id).join("")), ["ab", "cx"], "a block with no seq stays with the one before it");
  assert.equal(segs[1].seq, 112, "the live stretch sorts at its own first frame");
});

t("a stopped turn whose last stretch is only its stop line keeps it, after the message; empty stretches go", () => {
  const tu = { id: "tu", status: "stopped", stopped: { last_step: "Read a.png" }, seq: 100, lastSeq: 140, at: new Date(T0).toISOString(), end: { wall_ms: 60000 } };
  const segs = turnSegments(tu, [blk("a", 101)], [say(110, 10), say(120, 20)]);
  assert.deepEqual(segs.map((s) => [s.k, s.blocks.length, s.last, s.seq]), [[0, 1, false, 100], [2, 0, true, 120.5]], "the stretch between two messages had no work: gone");
  assert.match(turnHtml(segmentTurn(tu, segs[1]), []), /Stopped after/);
  assert.doesNotMatch(turnHtml(segmentTurn(tu, segs[0]), segs[0].blocks), /Stopped/, "only the last stretch says it stopped");
  // no message during it: the turn as one, unchanged
  const whole = turnSegments(tu, [blk("a", 101)], []);
  assert.equal(whole.length, 1);
  assert.equal(segmentTurn(tu, whole[0]), tu);
});

t("blocks keep the seq of their first frame, so the split follows the frames as they came", () => {
  const T = createTurns();
  const f = (type, seq, data, turn = "tu") => T.apply({ type, envelope: { type, seq, turn_id: turn, session_id: "s", data } });
  f("turn.started", 100, {});
  f("block.started", 101, { block: { id: "a", type: "thinking", index: 0 } });
  f("block.finished", 102, { block: { id: "a", type: "thinking", index: 0, header: "Thought" } });
  f("block.started", 103, { block: { id: "b", type: "activity", index: 1, rows: [] } });
  T.apply({ type: "message", envelope: { type: "message", seq: 104, turn_id: null, data: { id: "m1" } } }); // the agent speaks
  f("block.finished", 106, { block: { id: "b", type: "activity", index: 1, rows: [] } }); // b began before it
  f("block.updated", null, { block_id: "c", type: "text", append: "Next" }); // live only: just after the newest seen
  const tu = T.get("tu");
  assert.deepEqual(T.blocksOf(tu).map((b) => [b.id, b.seq]), [["a", 101], ["b", 103], ["c", 106.5]]);
  const segs = turnSegments(tu, T.blocksOf(tu), [{ seq: 104, at: Date.now() }]);
  assert.deepEqual(segs.map((s) => s.blocks.map((b) => b.id).join("")), ["ab", "c"]);
});

t("tool rows keep call identity across progress, output and row-control changes", () => {
  const render = (rows) => turnHtml(turn("running"), [{ id: "g", type: "activity", rows }], { open: { g: true } });
  const first = { call_id: 'read:"one', kind: "read", line: "Reading a file", status: "running", progress: { duration_ms: 1000 } };
  const ids = (html) => [...html.matchAll(/data-call-id="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(render([first])), ["read:&quot;one"]);
  assert.deepEqual(ids(render([{ ...first, progress: { duration_ms: 2000 } }])), ["read:&quot;one"]);
  assert.deepEqual(ids(render([{ ...first, status: "ok", output: "contents" }])), ["read:&quot;one"]);
  assert.deepEqual(ids(render([first, { ...first, call_id: "read:two" }])), ["read:&quot;one", "read:two"]);
  assert.deepEqual(ids(render([{ ...first, kind: "subagent" }])), ["read:&quot;one"]);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
