// The sidebar's Artifacts count is right from the start: it showed the newest pages' 348, then 1738 once Artifacts read
// the older pages (the owner, 11 Nov 08:06Z). A project read to its end keeps its count (localStorage, per chat); one not
// read to its end yet shows the larger of what's read and that kept count. The Space's made route gives no total.
//   node tests/arts-count.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/recordview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the sidebar's count is the kept full count until every page is read, never only the newest pages", () => {
  assert.match(src, /artifacts: \{ render: artsRender, count: \(\) => madeCountAll\(madePending\(null\)\) \}/);
  assert.match(src, /localStorage\.setItem\(FULL_KEY\(p\.chatId\), String\(items\)\)/, "kept once read to the end");
  assert.match(src, /else n \+= Math\.max\(items, fullOf\(p\.chatId\)\);/, "the larger while older pages aren't read");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
