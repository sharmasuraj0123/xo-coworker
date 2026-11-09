// Nothing rests past a message row's right edge: a box parked off-edge with a transform still counts toward the
// scroller's scrollable width, so the page could scroll sideways though nothing showed (Conversation's strict check on
// dd15034: #scroller 438 of 390 px, a turn row 422 of 358: the times' label, parked 64 px right of every row for the
// swipe that shows them). The label rests in place, unseen; it starts 64 px out only while a swipe pulls it in. No browser.
//   node tests/no-offedge.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/msgx.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (sel) => { const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css); return m ? m[1] : null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the times' label rests inside its row (no transform past the edge when no swipe pulls it)", () => {
  const rest = rule("#msgs>.m::after");
  assert.ok(rest, "the label is declared");
  const tr = /(?:^|;)\s*transform:\s*([^;]+)/.exec(rest);
  assert.ok(!tr || !/translateX\(\s*[1-9]/.test(tr[1]), `at rest: transform ${tr && tr[1]}`);
  assert.doesNotMatch(rest, /(?:^|;)\s*right:\s*-/, "nor a negative right");
});
t("while a swipe pulls, it slides in from 64 px out, as before", () => {
  const pull = rule("#msgs.mx-pulling>.m::after");
  assert.ok(pull, "the pulling rule");
  assert.match(pull, /translateX\(calc\(\(64 - var\(--mx-pull,0\)\) \* 1px\)\)/);
});
t("where a pointer hovers, a bubble leaves its actions their room beside it (a narrow window: 401 of 390 px)", () => {
  assert.match(css, /@media \(hover:hover\)\{#msgs \.bubble\{max-width:min\(80%,540px,calc\(100% - 66px\)\)\}\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
