import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js");
const page = read("modules/conversation/thread-page.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one toggle for every composer's chip", () => {
  assert.match(app, /function toggleIq\(sid, chip\) \{ if \(IQ\.isOpen\) IQ\.close\(\); else IQ\.open\(sid, chip\); \}/);
  assert.match(page, /TP\.K\.iq\.addEventListener\("click", \(\) => toggleIq\(sessionOf\(tpView\(\)\), .*TP\.K.*\.iq\)\);/);
  assert.match(app, /toggleIq\(sessionOf\(S\.view\), \$\("#iq"\)\);/);
  assert.doesNotMatch(app, /IQ\.isOpen \? IQ\.close\(\) : IQ\.open\(/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
