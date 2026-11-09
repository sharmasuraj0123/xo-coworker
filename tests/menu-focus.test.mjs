// A choice from the viewer's ⋯ menu leaves focus on something that shows (the controls grader on d79d37e, S130 at 390
// in both themes: Updated · Show, folded into More by the narrow head, loaded the new text and left focus on BODY:
// the redraw put it back on the head's own Updated · Show, hidden in a narrow head). Checked from the source: every
// way focus is put back after a redraw takes a control that shows, the ⋯ for one chosen from its menu, and every
// choice from the menu ends with focus on something drawn. The drawn result at 390 and 1440 is the flows case's (S130).
//   node tests/menu-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const has = (s, re, msg) => assert.ok(re.test(s || ""), `${msg} (${re})`);

t("one finder for a control that shows (a folded control is drawn twice: hidden in the head, and in the menu)", () => {
  has(src, /const shown = \(root, sel\) => \[\.\.\.root\.querySelectorAll\(sel\)\]\.find\(\(x\) => x\.getClientRects\(\)\.length > 0\) \|\| null;/, "shown(root, sel)");
});
t("a redraw puts focus back on a control that shows; one chosen from the menu, on the ⋯", () => {
  const r = body("render");
  has(r, /const fromMenu = !!\(ae && ae\.closest && ae\.closest\("\.vw-menu"\)\)/, "render knows focus was in the menu");
  has(r, /\(was && shown\(el, was\)\) \|\| \(fromMenu && shown\(el, "\[data-vw-more\]"\)\)/, "render: the control where it shows, else the ⋯");
  assert.ok(!/el\.querySelector\(was\)/.test(r), "render never takes the first match (the hidden twin)");
  const p = body("paintHead");
  has(p, /shown\(now, `\[\$\{had\}\]`\) \|\| \(fromMenu && shown\(now, "\[data-vw-more\]"\)\)/, "paintHead: the same");
  assert.ok(!/now\.querySelector\(`\[\$\{had\}\]`\)/.test(p), "paintHead never takes the first match");
});
t("every choice from the menu ends with the menu gone and focus on something drawn", () => {
  has(src, /const fromMenu = V\.menu && !!e\.target\.closest\("\.vw-menu"\) && !e\.target\.closest\("\.vw-menu a"\);\s*act\(e\);/, "the click acts, knowing it came from the menu");
  has(src, /if \(el\.querySelector\("\.vw-menu"\) && !V\.menu\) paintHead\(\);/, "the menu goes when nothing redrew the head");
  has(src, /if \(!a \|\| a === document\.body \|\| \(el\.contains\(a\) && !a\.getClientRects\(\)\.length\)\) \(shown\(el, "\[data-vw-more\]"\) \|\| headFocus\(false\)\)\.focus/, "focus that fell, or sits on nothing drawn, goes to the ⋯ (else the head)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
