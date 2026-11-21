// The model picker answers its own chip wherever the composer is: in a thread in the panel a click on #tiq to close
// it closed it on pointerdown (only #iq was its own) and the click opened it again.
//   node tests/iq-one-path.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const intel = read("js/intel.js"), app = read("js/app.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a press outside closes it, but never on the chip it opened from", () => {
  assert.match(intel, /!pop\.contains\(e\.target\) && !P\.anchor\?\.contains\(e\.target\)\) close\(\{ restore: false \}\);/);
  assert.doesNotMatch(intel, /closest\("#iq"\)/, "no composer's chip by id");
});
t("one toggle for every composer's chip", () => {
  assert.match(app, /function toggleIq\(sid, chip\) \{ if \(IQ\.isOpen\) IQ\.close\(\); else IQ\.open\(sid, chip\); \}/);
  assert.match(app, /TP\.K\.iq\.addEventListener\("click", \(\) => toggleIq\(sessionOf\(tpView\(\)\), TP\.K\.iq\)\);/);
  assert.match(app, /toggleIq\(sessionOf\(S\.view\), \$\("#iq"\)\);/);
  assert.doesNotMatch(app, /IQ\.isOpen \? IQ\.close\(\) : IQ\.open\(/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
