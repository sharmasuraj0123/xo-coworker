// Folded, the sidebar's counts (Home's, Workspace's) are a badge on the tile's corner: the number alone on amber, no
// wider than the tile, never the open sidebar's mark-and-number chip laid over the icon.
//   node tests/rail-badge.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../css/side.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}").exec(css); return m && m[1]; };
t("the folded count is an amber badge, the number alone, sized by tokens", () => {
  const r = rule(".side-folded .nr-n:not(:empty)");
  assert.ok(r, "the rule");
  for (const d of ["position:absolute", "background:var(--warn)", "color:var(--sb-side)", "height:var(--s-4)", "min-width:var(--s-4)", "border-radius:var(--r-pill)", "font-size:var(--fs-meta)"]) assert.ok(r.includes(d), d);
  assert.ok(!/\d+px/.test(r), "tokens only");
  assert.equal(rule(".side-folded .nr-n .nv-dot"), "display:none", "the mark gives way to the badge");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
