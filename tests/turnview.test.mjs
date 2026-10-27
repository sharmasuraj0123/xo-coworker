// How a turn's blocks render (js/turnview.js): the files a turn changed, and the runtime's own
// diagnostics kept out of the conversation. No network.
//   node tests/turnview.test.mjs
import assert from "node:assert/strict";

// js/ui.js reads the reduced-motion setting when it loads
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { turnHtml } = await import("../js/turnview.js");

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

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
