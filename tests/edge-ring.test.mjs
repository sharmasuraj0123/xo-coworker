// A control at the top of the screen keeps its whole ring (the controls grader on 8aa58d3, S070: a ring 4 px out lost
// its top at 390). Files' own head went with the Files place (Files is a page of the panel); the browser check is the
// ring sweep, which reads the screen's edges as a clip (flows RINGCLIP, four cells).
//   node tests/edge-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const H = read("tests/browser/harness.cjs"), F = read("tests/browser/flows.test.cjs");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the ring sweep counts the screen's edges as a clip, and reads a file from Artifacts in the panel", () => {
  assert.match(H, /at the screen's edge/);
  assert.match(H, /if \(ring\.top < -0\.5 && r\.top >= -0\.5\) vs\.push\("top"\);/);
  assert.match(F, /await sweep\("a file from Artifacts, in the panel"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
