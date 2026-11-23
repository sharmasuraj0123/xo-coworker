// The composer row's words are one size: the target ("Reply in this thread", "To the … coordinator") and the model chip.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const app = read("app.css"), phone = read("phone.css"), panel = read("panel.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const rule = (css, sel) => { const i = css.indexOf(sel + "{"); assert.ok(i >= 0, sel); return css.slice(i + sel.length + 1, css.indexOf("}", i)); };

t("one shared rule sizes the target (the chat's and the Thread page's, one class) and the model chip", () => {
  assert.equal(rule(app, ":is(.target,.iq)"), "--ic:var(--ic-sm);font-size:var(--fs-meta);line-height:var(--lh-meta)");
  assert.doesNotMatch(phone, /:is\(\.target,\.iq\)/);
  assert.doesNotMatch(panel + app + phone, /tp-target/);
  assert.match(app, /@container \(max-width:600px\)\{\.target \.muted\{display:none\}\}/);
  assert.match(app, /@container \(max-width:520px\)\{\.target \.tg-w\{display:none\}\}/);
});
t("none of them sets its own size", () => {
  for (const [css, sel] of [[app, ".target"], [app, ".iq"]]) assert.doesNotMatch(rule(css, sel), /font-size|font:/, sel);
  assert.doesNotMatch(rule(phone, "  :root:root .iq"), /font-size/);
});
t("the target's icon is the icon size and sits the icon gap from its words", () => {
  assert.equal(rule(app, ".target svg"), "flex:none;width:var(--ic);height:var(--ic)");
  assert.match(rule(app, ".target"), /gap:var\(--gap-icon\)/);
});
t("the target gives way before the model chip at every width, the panel's 40% included", () => {
  const iq = rule(app, ".iq");
  assert.match(iq, /^flex:0 1 auto;/, "it gives way only once the target has, so Send is never pushed out");
  assert.match(iq, /max-width:min\(320px,100% - var\(--h-ctl\) - var\(--h-lg\) - 3 \* var\(--s-2\)\)/);
  assert.match(rule(app, ".composer-row"), /gap:var\(--s-2\)/);
  assert.doesNotMatch(rule(phone, "  :root:root .iq"), /max-width|flex/);
});
console.log(`\n${passed} passed`);
