// A working turn is redrawn in place as its steps land: drawn anew, its step's tick drew itself in again, and its dots and
// shimmer restarted, every few seconds (the owner, 21 Nov: "the tick mark keeps on refreshing").
//   node tests/turn-in-place.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = ui.indexOf("export function reconcile("), body = ui.slice(i, ui.indexOf("\n}\n", i));

t("an item can ask to be updated in place, as the list can", () => {
  assert.match(body, /if \(\(always \|\| it\.inPlace \|\| \(active && active !== el && el\.contains\(active\)\) \|\| \(pressed && el\.contains\(pressed\)\)\) && fresh && fresh\.tagName === el\.tagName\) \{/);
  assert.match(body, /redraw\(el, fresh\.innerHTML\);/);
});
t("a conversation's turns ask for it; its other rows are drawn as before", () => {
  assert.match(app, /items\.push\(m\.who === "turn" \? \{ key: m\.key, html, inPlace: true \} : \{ key: m\.key, html \}\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
