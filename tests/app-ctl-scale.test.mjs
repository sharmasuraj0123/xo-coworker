// The composer's, the dock's and the picker's controls on the 24/32/40 scale, each corner concentric with what it sits
// in (the controls grader on c767cbf, by the Conversation fixer: C057 Send and Add files 36, S141 Send now 30,
// S039/S040 Retry and Edit 26, S047 Done and the picker's head 28, S013 Fold 28, S016 a file's × 28, its thumbnail 30
// and As text 26; a phone keeps its 36 floor). The composer is 28 px round, its controls 10 px in (1 + 9); the dock
// card 22 round, its body 16 down and 22 in; a file 18 round in the composer.
//   node tests/app-ctl-scale.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const m = new RegExp(`(?:^|[}\\n])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(css); assert.ok(m, sel); return m[1]; };

t("C057 Send is --h-lg, 8 px in from the composer's corner (28 − 8 = 20, its radius), the row no taller", () => {
  const r = rule(".send");
  assert.match(r, /width:var\(--h-lg\);height:var\(--h-lg\)/); assert.match(r, /margin:-2px -2px -2px 0/); assert.match(r, /border-radius:50%/);
});
t("C057 Add files is --h-ctl, 12 px in (28 − 12 = 16, its radius); a phone's 36 sits 10 in", () => {
  const r = rule(".attach");
  assert.match(r, /width:var\(--h-ctl\);height:var\(--h-ctl\);margin-left:2px/);
  assert.match(css, /@media \(max-width:760px\)\{[^@]*\.attach\{margin-left:0\}/);
});
t("S141 Send now, S047 Done and the picker's head buttons are --h-ctl; S039/S040 Retry and Edit --h-sm", () => {
  assert.match(rule(".tg-now"), /height:var\(--h-ctl\)/);
  assert.match(rule(".iq-back"), /height:var\(--h-ctl\)/);
  assert.match(rule(".iq-done"), /height:var\(--h-ctl\)/);
  assert.match(rule(".meta-btn"), /height:var\(--h-sm\)/);
});
t("S013 Fold is --h-ctl, 11 px in from the dock card's corner (22 − 11 = 11), the head no taller", () => {
  const r = rule(".dock-hide");
  assert.match(r, /height:var\(--h-ctl\);margin:-6px -12px -6px auto;/);
  assert.match(r, /border-radius:calc\(var\(--r-2xl\) - 11px\)/);
});
t("S016 a file's × is --h-sm, 11 px in (18 − 11 = 7); its thumbnail --h-ctl, 7 px in (18 − 7 = 11); As text --h-sm", () => {
  assert.match(rule(".att-b"), /width:var\(--h-sm\);height:var\(--h-sm\)/);
  assert.match(rule(".att-ic"), /width:var\(--h-ctl\);height:var\(--h-ctl\)/);
  assert.match(rule(".att-tx"), /height:var\(--h-sm\)/);
  assert.match(css, /\.att\{padding:0 10px 0 6px;border-radius:calc\(var\(--r-3xl\) - 10px\)\}/);
  assert.match(css, /\.att-ic\{border-radius:calc\(var\(--r-3xl\) - 17px\)\}/);
  assert.match(css, /\.att-b\{border-radius:calc\(var\(--r-3xl\) - 21px\)\}/);
});
// and S270, the offered path's field (the controls grader on 05d76ca: 678×28 on a desktop): a field at --h-ctl
t("S270 the refused Copy path's offered path is a field at --h-ctl", () => {
  assert.match(rule(".vw-cut-sel"), /height:var\(--h-ctl\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
