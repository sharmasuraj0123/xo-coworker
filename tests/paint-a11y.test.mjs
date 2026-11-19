// A paint finding (Astra's controls grader on dd15034, all four cells), checked from the source:
// - C087: the diff region's keyboard ring barely painted (its 2 px inset outline sat under the diff's own painted
//   layers: 36 px differed, at the bottom corners). The ring is drawn on a layer above the diff, over its area
//   (one rule with the file's region since C096: core/ui/a11y/ring.js).
// No browser: the rendered ring and contrast are the grader's.
//   node tests/paint-a11y.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("C087: the diff region's ring is a layer above the diff (not an outline its content can cover)", () => {
  // since C096 (the file's region, the same fault) one rule draws it for both: core/ui/a11y/ring.js and tests/ring.test.mjs
  const m = /(?:^|[}\s])\.region-ring\{([^}]*)\}/.exec(panel);
  assert.ok(m, "the one ring layer, drawn over a region with keyboard focus");
  assert.match(m[1], /position:absolute/);
  assert.match(m[1], /box-shadow:inset 0 0 0 2px var\(--focus\)/, "the one ring: 2 px of the focus colour, inset");
  assert.match(m[1], /pointer-events:none/, "it never takes the pointer");
  assert.match(m[1], /z-index:/, "above the diff's own layers");
  assert.match(panel, /:is\(\.vw-body,\.cx-pd\)\{isolation:isolate\}/, "which stay inside the diff's region");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
