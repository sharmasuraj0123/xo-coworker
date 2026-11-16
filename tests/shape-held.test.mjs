// XO's refusal of your shape change (or XO out of reach) is said where you made the change, in sight, never only at
// Shape's top (the create-project grader on 4d33649, S115 with C104/C105, all four cells: a PUT refused with 413 while
// this browser kept the change; the line was drawn at the page's top, at y=-277 after JSON's Save on a desktop, and on a
// phone at y=-9 behind the head after Reset, y=-198 after Show everything, y=-476 after Save, while focus stayed where
// you acted). The answer comes later than the action, so the place is remembered as the change is made, and the line is
// brought whole into its scroller's view when the answer arrives. Compact is this device's only: it sends nothing.
// Drawn at the top only when no change was made on this page (one held from before a reload). The drawn line is the
// grader's contracts/shape-shared-error (SHAPE-SHARED-ERROR).
//   node tests/shape-held.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/shapeview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
// a function's body: its declaration first (a variable of the same name elsewhere isn't it), else a const arrow
const fn = (name) => { let i = src.search(new RegExp(`function ${name}\\(`)); if (i < 0) i = src.indexOf(`const ${name} = `); assert.ok(i >= 0, name); const e = src.indexOf("\n  }\n", i); return src.slice(i, e > 0 ? e : i + 2000); };

t("one line for what's held, drawn by one function, at a place", () => {
  assert.match(src, /const heldAt = \(where\) =>/, "heldAt(where)");
  assert.equal((src.match(/XO refused your last shape change\./g) || []).length, 1, "the words are written once");
});
t("never only at the top: the top draws it only when no change was made on this page", () => {
  const top = fn("topHtml");
  assert.match(top, /heldAt\(null\)/, "the top: a held change from before this page");
  assert.match(top, /heldAt\("preset"\)/, "under the cards (a preset chosen, or Reset, which hands focus to the card)");
  assert.match(top, /heldAt\("acts"\)/, "after Show everything's row");
  assert.doesNotMatch(top, /\(held \? held\.why === "refused"/, "the old top-only line is gone");
  assert.match(fn("jsonRender"), /heldAt\("json"\)/, "beside the JSON's text, after JSON's Save");
});
t("each change that's sent records where it was made, as it's made; Compact sends nothing and records nothing", () => {
  assert.match(src, /said\(shape\.resetToPreset\(\), [^\n]*, "preset"\)/);
  assert.match(src, /said\(shape\.showEverything\(\), [^\n]*, "acts"\)/);
  assert.match(fn("said"), /if \(where !== "device"\) V\.sharedAt = where;/);
  assert.match(fn("choose"), /V\.sharedAt = "preset";/);
  assert.match(fn("save"), /V\.sharedAt = "json";/);
});
t("when the answer arrives, the line is drawn and brought whole into sight (its scroller's least move); focus stays", () => {
  assert.match(src, /shape\.onHeld\?\.\(\(\) => \{ if \(page && !page\.hidden && !document\.querySelector\("#settings"\)\.hidden\) \{ render\(\); inSightHeld\(\); \} \}\);/);
  assert.match(src, /const inSightHeld = \(\) => \{ const w = V\.sharedAt && box && box\.querySelector\("\[data-shp-held\]"\); if \(w\) bringWhole\(w\); \};/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
