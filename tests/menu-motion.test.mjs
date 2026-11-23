// Every menu ([role=menu]) moves its active item at once, without a fade or a ring, and opens down from its button.
import assert from "node:assert/strict";
import { readSource, sourceText } from "./lib/sources.mjs";

const all = sourceText(".css");
const base = readSource("core/ui/foundation.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("one rule for every menu: no fade on its items, the focus fill without a ring, opening down", () => {
  assert.match(base, /\n\[role=menu\] :is\(\[role=menuitem\],\[role=menuitemradio\]\)\{transition:none\}/);
  assert.match(base, /\n\[role=menu\] :is\(\[role=menuitem\],\[role=menuitemradio\]\):focus\{background:var\(--menu-focus\);color:var\(--ink\);outline:none\}/);
  assert.match(base, /\n\[role=menu\]\{animation:float-in-down var\(--d-out\) var\(--ease\)\}/);
});
t("no menu keeps a focus fill or an entrance of its own", () => {
  assert.doesNotMatch(all, /\.(tw|fl|vw)-menu[^{]*:focus\{/);
  for (const m of ["tw-menu", "fl-menu", "vw-menu"]) assert.doesNotMatch(all, new RegExp(`\\n\\.${m}\\{[^}]*animation`), m);
});
console.log(`\n${passed} passed`);
