// A row that goes while it holds focus hands focus on first, never to BODY (the create-project/Launchpad grader on
// f70ca6b, C050/C121, 390 light, WORK-EMPTY-FINISH-FOCUS: the live working mini had focus, turn.finished came with no
// finished blocks, the row was rightly dropped, and reconcile removed it with its focused descendant: focus fell to
// BODY). Before a focused row is removed, focus goes to the nearest row that stays (before it, else after), on its first
// control that shows; with none, to the list's own fallback (the conversation's: the message box).
//   node tests/reconcile-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = ui.indexOf("export function reconcile("), body = ui.slice(i, ui.indexOf("\n}\n", i));

t("the row that holds focus and is going is known before anything moves, with its nearest row that stays", () => {
  assert.match(body, /export function reconcile\(box, items, \{ quiet = false, fallback = null \} = \{\}\) \{/);
  assert.match(body, /const keep = new Set\(items\.map\(\(it\) => it\.key\)\);/);
  assert.match(body, /const going = \[\.\.\.box\.children\]\.find\(\(el\) => el\.dataset\.k && !keep\.has\(el\.dataset\.k\) && el\.contains\(active\)\);/);
  assert.match(body, /let near = null;/);
});
t("before it's removed, focus goes to that row's first control that shows, else the list's fallback", () => {
  const r = body.indexOf("for (const el of old.values()) el.remove();");
  const before = body.slice(0, r);
  assert.match(before, /if \(going\) \{/);
  assert.match(before, /const to = \(near && \[\.\.\.near\.querySelectorAll\(LANDING\)\]\.find\(shows\)\) \|\| \(fallback && fallback\(\)\);/);
  assert.match(before, /if \(to && to\.focus\) to\.focus\(\{ preventScroll: true \}\);/);
});
t("the conversation's fallback is its message box", () => {
  assert.match(app, /reconcile\(msgsEl, items, \{ quiet, fallback: \(\) => \$\("#say"\) \}\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
