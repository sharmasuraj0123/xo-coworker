// The composer row's words are one size: the target ("Reply in this thread", "To the … coordinator") and the model chip.
//   node tests/composer-row-size.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const app = read("app.css"), phone = read("phone.css"), panel = read("panel.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const rule = (css, sel) => { const i = css.indexOf(sel + "{"); assert.ok(i >= 0, sel); return css.slice(i + sel.length + 1, css.indexOf("}", i)); };

t("one shared rule sizes the target, the Thread page's target and the model chip", () => {
  assert.equal(rule(app, ":is(.target,.tp-target,.iq)"), "font-size:var(--fs-base);line-height:var(--lh-14)");
  assert.match(phone, /:root:root :is\(\.target,\.tp-target,\.iq\)\{font-size:var\(--fs-sm\)\}/);
});
t("none of them sets its own size", () => {
  for (const [css, sel] of [[app, ".target"], [app, ".iq"], [panel, ".stage .tp-target"]]) assert.doesNotMatch(rule(css, sel), /font-size|font:/, sel);
  assert.doesNotMatch(rule(phone, "  :root:root .iq"), /font-size/);
});
t("the target's icon is the icon size and sits the icon gap from its words", () => {
  assert.equal(rule(app, ".target svg"), "flex:none;width:var(--ic);height:var(--ic)");
  assert.match(rule(app, ".target"), /gap:var\(--gap-icon\)/);
});
console.log(`\n${passed} passed`);
