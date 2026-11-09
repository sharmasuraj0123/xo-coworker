// Find opens once the caret has landed (the controls grader on e55c2d8, S242: Ctrl+End then Ctrl+F at once in a long
// file left focus in the editor; traced on 4198351: __syncRenderView → #ae → #D, whose frame callback focuses the caret
// after Find's own focus). The editor wrapper holds a Find key while the view is still moving from your last key, until
// it's still for two frames and the editor's frame callbacks have run, then hands the key to the editor as pressed: the
// order is fixed; nothing moves focus back. Checked from the source; drawn, the flows case "S242 (race)".
//   node tests/find-race.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/diffview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = src.indexOf("const settle = (e) => {"), body = src.slice(i, src.indexOf("\n      };\n", i));

t("a Find key while the view is moving from the last key is held, then handed on as pressed", () => {
  assert.ok(i > 0, "settle()");
  assert.match(body, /if \(!findKey\(e\)\) \{ keyTop = scroller\.scrollTop; return; \}/, "every other key notes where the view was");
  assert.match(body, /if \(keyTop == null \|\| scroller\.scrollTop === keyTop\) return;/, "nothing moving: Find opens at once, as ever");
  assert.match(body, /e\.preventDefault\(\); e\.stopImmediatePropagation\(\);\n\s*holding = true;/, "held: the editor doesn't see it yet");
  assert.match(body, /if \(\(still < 2 \|\| n < 3\) && \+\+n < 30\)/, "until still for two frames, three at the least (the editor's own frame callbacks), thirty at the most");
  assert.match(body, /target\.dispatchEvent\(new KeyboardEvent\("keydown", init\)\)/, "then the same key, to where it was pressed");
  assert.match(body, /if \(e\.isComposing \|\| !e\.isTrusted\) return;/, "the handed-on key isn't held again");
});
t("it listens before the editor's own keys, and goes with them", () => {
  assert.match(src, /\[\["keydown", settle, true\], \["keydown", leave, true\]/, "added first, in capture");
  assert.match(src, /const unwire = \(\) => \{[^\n]*\["keydown", settle, true\]/, "and removed with the rest");
});
t("nothing in it moves focus", () => {
  assert.doesNotMatch(body, /\.focus\(/, "no focus() of its own: only the order changes");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
