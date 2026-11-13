// A thread without a plan has no checklist to show: no toggle, no "0 of 0", never "All 0 steps done" (the
// create-project/Launchpad grader on 70375ad, C045 empty-checklist: an unplanned working thread painted a 0-of-0
// disclosure that opened onto nothing and said "All 0 steps done", at 1440 dark and 390 light; done >= total held for
// 0 >= 0). The bar comes when the agent writes its first step; until then the thread head holds only its runs, if any.
//   node tests/checklist-empty.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const f = (() => { const i = src.indexOf("function checklistRender(needs) {"); assert.ok(i > 0); return src.slice(i, src.indexOf("\n}\n", i)); })();

t("no steps, no checklist: the head holds only the thread's runs, and hides when there are none", () => {
  const i = f.indexOf("if (!c.total) {");
  assert.ok(i > 0, "a thread without steps is drawn apart");
  assert.ok(i < f.indexOf("const open = "), "before anything of the checklist is drawn");
  const body = f.slice(i, f.indexOf("\n  }\n", i));
  assert.match(body, /const all = runsStrip\(t\);/);
  assert.match(body, /if \(th\._h !== all\) \{ redraw\(th, all\); th\._h = all; \}/);
  assert.match(body, /th\.hidden = !all;/);
  assert.match(body, /return;/);
});
t("every other state counts real steps: All N steps done only when there are some", () => {
  assert.match(f, /else if \(c\.done >= c\.total\) \{ mode = "done";/, "after the early return, total is at least 1");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
