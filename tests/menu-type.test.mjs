import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const rule = (f, sel) => { const s = css(f), i = s.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel); return s.slice(i, s.indexOf("}", i)); };
const MENUS = { "app.css": [".at-list li", ".iq-h h2", ".tw-menu button", ".lp-menu button"], "../core/ui/components/xo-select.css": [".dd-row"], "../modules/launchpad/launchpad.css": [".lp-mn :is(button,a)"], "diffs.css": [".vw-menu :is([role=menuitem],[role=menuitemradio])"], "panel.css": [".fl-menu button"] };

t("the ui role is 14/20", () => {
  assert.match(css("../core/ui/tokens.css"), /--fs-ui:14px;/);
  assert.match(css("../core/ui/tokens.css"), /--lh-ui:20px;/);
});
t("every menu row takes it, none the reading size", () => {
  for (const [f, sels] of Object.entries(MENUS)) for (const sel of sels) {
    const r = rule(f, sel);
    assert.match(r, /var\(--fs-ui\)/, sel);
    assert.match(r, /var\(--lh-ui\)/, sel);
    assert.doesNotMatch(r, /--fs-read|--fs-input/, sel);
  }
});
t("the model picker's rows read its chip's meta role, never the reading size", () => {
  for (const sel of [".iq-n", ".iq-more"]) {
    const r = rule("app.css", sel);
    assert.match(r, /var\(--fs-meta\)\/var\(--lh-meta\)/, sel);
    assert.doesNotMatch(r, /--fs-read|--fs-input|--fs-ui/, sel);
  }
});
console.log(`\n${passed} passed`);
