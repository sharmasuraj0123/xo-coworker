// Where focus goes when what had it goes, in the viewer (the controls grader on 9d1f71b, S138, all four cells: focus
// once landed on the viewer's own section, which shows no ring). Checked from the source: the text, when the file
// shows in the editor (there's no Edit any more: a text file is always ready to type in); else the head's first
// control that shows; the section only with none. A file just made opens with the caret in it.
//   node tests/head-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = ["viewer.js", "viewer-head.js", "viewer-text.js"].map((file) => readFileSync(new URL(`../modules/files/${file}`, import.meta.url), "utf8")).join("\n");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("headFocus: the text in the editor; the head's first shown control; the section last", () => {
  const b = body("headFocus");
  assert.ok(b, "headFocus");
  const order = ["(TX.h && showsText() && TX.h.view.contentDOM)", "head.querySelectorAll(", "|| el;"].map((x) => b.indexOf(x));
  assert.ok(order.every((i) => i > 0), `each step is there (${order})`);
  assert.deepEqual([...order].sort((a, c) => a - c), order, "in that order");
  assert.ok(/getClientRects\(\)\.length && !x\.closest\("\[inert\]"\)/.test(b), "a control that shows, and can take focus");
});
t("a file just made opens with the caret in its text (no Created notice to close first)", () => {
  assert.match(src, /V\.focusText = !!f\.created;/);
  const b = body("drawText");
  assert.ok(b && /V\.focusText\) \{ V\.focusText = false; h\.focus\(\); \}/.test(b), "the editor takes focus once it's there");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
