// The editor's find bar as one family (the controls grader on e55c2d8, S242–S252, and its contrast review): Pierre's
// bar lives in the file's shadow root, where the page's rules (the phone floor, the role tokens) can't reach, so the
// file view hands it one stylesheet: on a phone every control a real 36 px target; its count, "No results" and
// placeholder in the role tokens. Checked from the source; drawn, the flows case "S242–S252 (find bar)".
//   node tests/find-bar.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/diffview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const css = (src.match(/const FIND_CSS = `([\s\S]*?)`;/) || [])[1] || "";

t("the file view hands the bar its stylesheet", () => {
  assert.ok(css, "FIND_CSS");
  assert.match(src, /new P\.VirtualizedFile\(\{\n\s*\.\.\.common\(o\), unsafeCSS: FIND_CSS,/, "the file the editor attaches to");
});
t("on a phone (the app's floor, 760 px) every control is a real 36 px target, as one family", () => {
  const m = css.match(/@media \(max-width:760px\)\{([\s\S]*)\}$/);
  assert.ok(m, "the phone's rules");
  assert.match(m[1], /\[data-search-panel\] \[data-search-icon\]\{width:36px!important;height:36px!important;min-width:36px;min-height:36px\}/, "every icon button: toggles, arrows, Replace, Replace all, the replace toggle, Close");
  assert.match(m[1], /\[data-input-box\] input\{min-height:36px\}/, "the fields");
  assert.match(m[1], /\[data-find\] input\{padding-inline-end:116px!important\}/, "the find field's words clear its three 36 px toggles");
});
t("its words take the role tokens, and outrank the bar's own rules (the library layers this sheet below its unlayered ones)", () => {
  assert.match(css, /\[data-matches\]\{color:var\(--ink-2\)!important\}/, "the count and No results");
  assert.match(css, /input::placeholder\{color:var\(--ink-3\)!important;opacity:1!important\}/, "the placeholder");
  assert.match(src, /its last cascade layer \(unsafe\), and the bar's own rules are unlayered/, "the reason is written down");
  // every property the bar's own rules also set is !important here (else the unlayered rule wins)
  for (const prop of ["padding-inline-end", "width:36px", "height:36px", "background:transparent", "top:-8px", "right:-8px", "transform:none"]) assert.ok(new RegExp(prop.replace(/[-:]/g, (c) => c) + "[^;}]*!important").test(css), prop);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
