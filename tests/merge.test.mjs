// Your edit and an agent's, merged (js/merge.js): what one side changed is taken, what both changed the same
// way once, and what both changed differently is marked for the merge view; line endings survive. No browser.
//   node tests/merge.test.mjs
import assert from "node:assert/strict";
import { linesOf, changes, merge3 } from "../js/merge.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const L = (...xs) => xs.map((x) => x + "\n").join("");

t("lines keep their own endings, and a last line without one", () => {
  assert.deepEqual(linesOf("a\r\nb\nc"), ["a\r\n", "b\n", "c"]);
  assert.deepEqual(linesOf(""), []);
  assert.equal(linesOf("x\r\ny\r\n").join(""), "x\r\ny\r\n");
});

t("changes: applying them to a gives b (random cases)", () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let round = 0; round < 400; round++) {
    const a = Array.from({ length: rnd(12) }, () => "abcde"[rnd(5)]);
    const b = Array.from({ length: rnd(12) }, () => "abcde"[rnd(5)]);
    const cs = changes(a, b);
    const out = []; let at = 0;
    for (const c of cs) { assert.ok(c.aStart >= at, "in order"); out.push(...a.slice(at, c.aStart), ...b.slice(c.bStart, c.bEnd)); at = c.aEnd; }
    out.push(...a.slice(at));
    assert.deepEqual(out, b, `a=${a.join("")} b=${b.join("")}`);
  }
});

t("each side's separate change is kept, with no conflict", () => {
  const base = L("one", "two", "three", "four", "five");
  const r = merge3(base, L("one", "TWO", "three", "four", "five"), L("one", "two", "three", "four", "FIVE"));
  assert.equal(r.conflicts, 0);
  assert.equal(r.text, L("one", "TWO", "three", "four", "FIVE"));
});

t("the same change on both sides lands once", () => {
  const base = L("a", "b", "c");
  const r = merge3(base, L("a", "B", "c"), L("a", "B", "c"));
  assert.deepEqual(r, { text: L("a", "B", "c"), conflicts: 0 });
});

t("both changed the same lines differently: one marked place, both versions in it", () => {
  const base = L("a", "b", "c", "d");
  const r = merge3(base, L("a", "mine", "c", "d"), L("a", "theirs", "c", "d"));
  assert.equal(r.conflicts, 1);
  assert.equal(r.text, L("a", "<<<<<<< yours", "mine", "=======", "theirs", ">>>>>>> the agent's", "c", "d"));
});

t("only one side changed: that side, whole", () => {
  const base = L("x", "y");
  assert.equal(merge3(base, base, L("x", "Y", "z")).text, L("x", "Y", "z"));
  assert.equal(merge3(base, L("w", "x", "y"), base).text, L("w", "x", "y"));
  assert.equal(merge3(base, base, base).text, base);
});

t("CRLF files stay CRLF, markers included; a last line without an ending stays so where nothing clashed", () => {
  const base = "a\r\nb\r\nc";
  const r = merge3(base, "a\r\nB\r\nc", "a\r\nb\r\nC");
  assert.deepEqual(r, { text: "a\r\nB\r\nC", conflicts: 0 });
  const c = merge3("a\r\nb\r\n", "a\r\nmine\r\n", "a\r\ntheirs\r\n");
  assert.equal(c.text, "a\r\n<<<<<<< yours\r\nmine\r\n=======\r\ntheirs\r\n>>>>>>> the agent's\r\n");
});

t("lines added at the same place by both sides are one marked place", () => {
  const r = merge3(L("a", "b"), L("a", "mine", "b"), L("a", "theirs", "b"));
  assert.equal(r.conflicts, 1);
  assert.equal(r.text, L("a", "<<<<<<< yours", "mine", "=======", "theirs", ">>>>>>> the agent's", "b"));
});

t("a deletion against an edit of the same line is a conflict, never a silent loss", () => {
  const r = merge3(L("a", "b", "c"), L("a", "c"), L("a", "B", "c"));
  assert.equal(r.conflicts, 1);
  assert.match(r.text, /=======\nB\n>>>>>>>/);
});

console.log(`\n${passed} passed`);
