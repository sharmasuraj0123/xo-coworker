// Where focus goes when what had it goes, in the viewer (the controls grader on 9d1f71b, S138, all four cells: Enter on
// the Created notice's Close, while editing the new file, put focus on the viewer's own section, which shows no ring:
// headFocus took Edit, which the head doesn't have while editing, else the section). Checked from the source: while
// editing, the editor; else Edit where it shows; else the head's first control that shows; the section only with
// none. The walk is the flows case "S138 (Created)".
//   node tests/head-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("headFocus: the editor while editing; Edit where it shows; the head's first shown control; the section last", () => {
  const b = body("headFocus");
  assert.ok(b, "headFocus");
  const order = ["(ED.on && ED.ed)", 'shown(el, ".vw-top [data-vw-edit]")', "head.querySelectorAll(", "|| el;"].map((x) => b.indexOf(x));
  assert.ok(order.every((i) => i > 0), `each step is there (${order})`);
  assert.deepEqual([...order].sort((a, c) => a - c), order, "in that order");
  assert.ok(/getClientRects\(\)\.length && !x\.closest\("\[inert\]"\)/.test(b), "a control that shows, and can take focus");
});
t("the Created notice's Close hands focus there", () => {
  const i = src.indexOf('if (e.target.closest("[data-vw-toastx]")) {'), h = src.slice(i, i + 600);
  assert.ok(i > 0, "the Close handler");
  assert.ok(/const to = headFocus\(false\);/.test(h), "where focus goes, from headFocus");
  assert.ok(/if \(to === ED\.ed\) \{ Promise\.resolve\(ED\.ed\.focus\(\{ preventScroll: true \}\)\)\.then\(go, go\); return; \}/.test(h), "the notice waits for the editor to have focus");
  assert.ok(/to\.focus\(\{ preventScroll: true \}\); go\(\);/.test(h), "else focus first, then the notice goes");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
