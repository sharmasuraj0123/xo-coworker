// Controls take their published heights from the tokens, never a literal off the scale (the create-project grader on
// 2a8d278: S003, the history's "Load earlier" body was 26 px, not the inline --h-sm 24; S020, All's filters were 30 px,
// not the standard --h-ctl 32; phones keep their 36 floor). And on a phone the thread head leaves its controls room for
// their ring (C046, round 10: the runs count's ring lost its top 4 px under the bar above; the 4 px under the bar's
// line is now the head's own, so the ring has it, the spacing unchanged).
//   node tests/ctl-heights.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const phone = readFileSync(new URL("../css/phone.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("S003: the history's Load earlier is the inline height, --h-sm", () => {
  assert.match(app, /\.hist-more\{height:var\(--h-sm\);/);
});
t("S020: All's filters are the standard control height, --h-ctl", () => {
  assert.match(app, /\.all-f button\{display:inline-flex;align-items:center;gap:7px;height:var\(--h-ctl\);/);
});
t("C046: on a phone the thread head's controls have their ring's 4 px above them, inside the head", () => {
  assert.match(phone, /:root:root \.thead\{display:flex;align-items:flex-start;gap:8px;padding:4px 16px 8px\}/);
  assert.match(phone, /:root:root \.top\[data-kind="thread"\]\{border-bottom:0;padding-bottom:0\}/, "the 4 px moved from the bar to the head: the same spacing");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
