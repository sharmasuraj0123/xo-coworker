// Every phone declaration wins at 390 px: no later or stronger rule that reaches the same elements undoes it
// (Files' Try again kept 32 and its back to the projects 24 on a phone because app.css's phone block sits before
// their own rules there; the viewer's notch padding, its 40 px buttons and Launchpad's 40 px eye were undone the same
// way). A cascade model over every sheet in load order (tests/lib/cascade.mjs): media at 390 and 1440, container
// rules kept to their own condition, specificity then order, !important. A rule under a state or a place (an open
// drawer, a docked chat, a density, the light theme's own colours) is a deliberate variant, not counted. No browser.
//   node tests/phone-cascade.test.mjs
import assert from "node:assert/strict";
import { lost } from "./lib/cascade.mjs";

const L = lost(new URL("./lib/x.mjs", import.meta.url)).filter((x) => x.how === "all");
const lines = L.map((x) => `${x.A.f} ${x.A.sel} { ${x.da.p}: ${x.da.v} }  ← ${x.B.f} ${x.B.sel} { ${x.db.p}: ${x.db.v} }`);
let passed = 0;
try {
  assert.deepEqual(lines, [], `phone declarations undone at 390:\n  ${lines.join("\n  ")}`);
  passed++; console.log("  ok  every phone declaration wins at 390 (none undone by a later or stronger rule)");
} catch (e) { console.error("  FAIL every phone declaration wins at 390\n" + e.message); process.exitCode = 1; }
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
