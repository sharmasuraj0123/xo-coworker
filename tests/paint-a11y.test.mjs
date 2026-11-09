// Two paint and meaning findings (Astra's controls grader on dd15034, all four cells), checked from the source:
// - C087: the diff region's keyboard ring barely painted (its 2 px inset outline sat under the diff's own painted
//   layers: 36 px differed, at the bottom corners). The ring is drawn on a layer above the diff, over its area.
// - The editor search's "Not a valid pattern" read at ~1.9:1 (the library's count style, 35% ink) and was tied to
//   nothing: it's in the error's ink, the field names it as its error and description, and it's said once (status).
// No browser: the rendered ring and contrast are the grader's.
//   node tests/paint-a11y.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const dv = readFileSync(new URL("../js/diffview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("C087: the diff region's ring is a layer above the diff (not an outline its content can cover)", () => {
  const m = /\.stage \.cx-pane:has\(>\.cx-pd:focus-visible\)::after\{([^}]*)\}/.exec(panel);
  assert.ok(m, "a ring layer on the pane while its diff region has keyboard focus");
  assert.match(m[1], /position:absolute/);
  assert.match(m[1], /box-shadow:inset 0 0 0 2px var\(--focus\)/, "the one ring: 2 px of the focus colour, inset");
  assert.match(m[1], /pointer-events:none/, "it never takes the pointer");
  assert.match(m[1], /z-index:/, "above the diff's own layers");
  assert.match(m[1], /top:35px/, "over the diff's area, below the pane's 35 px head");
});
t("the editor search's invalid-pattern words: the error's ink, the field's error and description, said once", () => {
  const check = /const check = \(g\) => \{([\s\S]*?)\n      \};/.exec(dv);
  assert.ok(check, "the pattern check");
  const b = check[1];
  assert.match(b, /var\(--err-ink\)/, "in the error's ink (the library's 35% count style read ~1.9:1)");
  assert.match(b, /aria-errormessage/, "the field names it as its error");
  assert.match(b, /aria-describedby/, "and its description");
  assert.match(b, /role", "status"|"role", "status"|setAttribute\("role", "status"\)/, "said once, as a status");
  assert.match(b, /removeAttribute\("aria-errormessage"\)/, "and let go when the pattern is valid again");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
