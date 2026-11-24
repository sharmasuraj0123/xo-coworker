// The composer's, the dock's and the picker's controls on the 24/32/40 scale, each corner concentric with what it sits
// in (the controls grader on c767cbf, by the Conversation fixer: C057 Send and Add files 36, S141 Send now 30,
// S039/S040 Retry and Edit 26, S047 Done and the picker's head 28, S013 Fold 28, S016 a file's × 28, its thumbnail 30
// and As text 26; a phone keeps its 36 floor). Their corners and insets in the dock family: tests/card-family.test.mjs.
//   node tests/app-ctl-scale.test.mjs
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { resolveTokens } from "./lib/tokens.mjs";

const css = resolveTokens(sheet(new URL("../css/app.css", import.meta.url)));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const m = new RegExp(`(?:^|[}\\n])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(css); assert.ok(m, sel); return m[1]; };

t("C057 Send and Add files are the composer's control, --comp-ctl: 32, a phone's 36", () => {
  for (const sel of [".send", ".attach"]) assert.match(rule(sel), /width:var\(--comp-ctl\);height:var\(--comp-ctl\)/, sel);
});
t("S141 Send now, S047 Done and the picker's head buttons are --h-ctl; S039/S040 Retry and Edit --h-sm", () => {
  assert.match(rule(".tg-now"), /height:var\(--h-ctl\)/);
  assert.match(rule(".iq-back"), /height:var\(--h-ctl\)/);
  assert.match(rule(".iq-done"), /height:var\(--h-ctl\)/);
  assert.match(rule(".meta-btn"), /height:var\(--h-sm\)/);
});
t("S013 Fold is --h-ctl, the card's top row no taller", () => {
  assert.match(rule(".dock-hide"), /height:var\(--h-ctl\);/);
  assert.match(rule(".c-top"), /min-height:var\(--h-ctl\)/);
});
t("S016 a file's × is --h-sm, 11 px in (18 − 11 = 7); its thumbnail --h-ctl, 7 px in (18 − 7 = 11); As text --h-sm", () => {
  assert.match(rule(".att-b"), /width:var\(--h-sm\);height:var\(--h-sm\)/);
  assert.match(rule(".att-ic"), /width:var\(--h-ctl\);height:var\(--h-ctl\)/);
  assert.match(rule(".att-tx"), /height:var\(--h-sm\)/);
});
// and S270, the offered path's field (the controls grader on 05d76ca: 678×28 on a desktop): a field at --h-ctl
t("S270 the refused Copy path's offered path is a field at --h-ctl", () => {
  assert.match(rule(".vw-cut-sel"), /height:var\(--h-ctl\);/);
});
// the Map's toolbar (zoom −/+, Fit, Follow: S205–S208, the controls grader on c767cbf: 28×28 on a desktop): the owner's
// pick, 32 (10 Nov, rv_611c342d8d1545f2); a phone keeps its 36. The .dg-mode buttons it also sized are never drawn
t("S205–S208 the Map's toolbar buttons are --h-ctl on a desktop (the owner's pick)", () => {
  assert.match(rule(".dg-tools button"), /width:var\(--h-ctl\);height:var\(--h-ctl\)/);
  assert.doesNotMatch(css, /\.dg-mode button\{|\.dg-tools button,\.dg-mode button\{/, "no rule for buttons never drawn");
  assert.match(css, /\.dg-tools button\{width:36px;height:36px\}/, "a phone's 36");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
