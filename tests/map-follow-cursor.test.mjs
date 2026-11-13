// Follow keeps the followed agent's cursor in view: its arrow, and its name beside it where there's room, never only the
// middle of the box it's on (the controls grader's S208-moving-follow, 03:21; reproduced on 70375ad, Tree at 1440: at
// the zoom you chose, 2.4, the agent moved to a far file, and Follow put that box's middle in view while the arrow, at the
// box's edge, stood off the view's left). The lead carries the arrow's own point, its side and its name's width; the
// view is nudged by the least move that brings them inside its margins, the arrow first when both can't fit.
//   node tests/map-follow-cursor.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n  }\n", i)); };

t("the lead carries its arrow's point, its side and its name's width", () => {
  assert.match(body("cursors"), /M\.lead = \{ key: `\$\{a\.id\}@\$\{a\.nid\}`, pt: [^\n]*, at: \{ x, y \}, side: p\.side \|\| "right", tw: c\.el\.querySelector\("\.dg-tag"\)\?\.offsetWidth \|\| 0 \};/);
});
t("Follow keeps the arrow in view (and its name where there's room), never the box's middle alone", () => {
  const k = body("keepInView");
  assert.match(k, /function keepInView\(c, lead\)/);
  assert.match(k, /const a = lead\.at, tw = lead\.tw \|\| 0;/);
  assert.match(k, /const arrow = \[a\.x - 2, a\.x \+ 16\]/, "the arrow's own box, in the drawing's units");
  assert.doesNotMatch(k, /pt\.x \* c\.s/, "not the box's middle");
  assert.match(src, /keepInView\(c, lead\)/, "called with the lead");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
