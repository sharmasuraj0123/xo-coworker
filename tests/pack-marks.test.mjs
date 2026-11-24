// Marks are the owner's pack icons, never text characters (■ ◆ ✱ ✓ ○ draw with the font's rough edges).
import assert from "node:assert/strict";
import { xi } from "../core/ui/icons/icon.js";
import { ICON, stepMark } from "../core/ui/icons/names.js";
import { sheet } from "./lib/cascade.mjs";
import { readSource, sourcePaths, sourceText } from "./lib/sources.mjs";

const icon = "core/ui/icons/icon.js";
const src = sourcePaths(".js").filter((f) => !f.endsWith("/xoicons.js")).map((f) => [f, readSource(f)]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("no markup draws a mark with a text character", () => {
  for (const [f, s] of src) {
    const code = s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.doesNotMatch(code, />[■◆✱✓○]</, f);
    assert.doesNotMatch(code, /`[■◆✱]\s/, f);
    assert.doesNotMatch(code, /\? "[✓✱○]" :/, f);
  }
});
t("a step's mark comes from the pack: check, step-doing, state-idle", () => {
  assert.equal(stepMark("done"), ICON.check);
  assert.equal(stepMark("doing"), xi("step-doing"));
  assert.equal(stepMark("todo"), xi("state-idle"));
});
t("a state mark is the pack's state-* icon, never a CSS-drawn box, ring or diamond", () => {
  for (const [f, s] of src) if (f !== icon) assert.doesNotMatch(s, /<i class="g /, f);
  const css = sourceText(".css");
  assert.doesNotMatch(css, /(^|\n|\})\.g(-[a-z_]+)?(,\.g-[a-z_]+)*\{[^}]*(border|background|rotate)/);
});
t("spinners, needs-you marks and status dots draw from the pack's files, not CSS borders, rotations or rounded boxes", () => {
  const tok = readSource("core/ui/tokens.css");
  for (const [k, f] of [["working", "e-state-marks/state-working.svg"], ["needs", "e-state-marks/state-needs-you.svg"], ["dot", "d-things-and-kinds/step-dot.svg"], ["stop", "c-actions/stop.svg"], ["warn", "d-things-and-kinds/warning.svg"], ["next", "b-arrows-and-chevrons/arrow-right.svg"]])
    assert.match(tok, new RegExp(`--mask-${k}:url\\(/core/ui/icons/source/xo/${f.replace(/\./g, "\\.")}\\)`), k);
  const all = sheet(new URL("../css/app.css", import.meta.url)) + "\n" + sourceText(".css");
  const rule = (sel) => { const i = all.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel); return all.slice(i, all.indexOf("}", i)); };
  for (const sel of [".spin", ".tb-live", ".lp-arc::before"]) assert.match(rule(sel), /mask:var\(--mask-working\)/, sel);
  assert.doesNotMatch(all, /\.arc::before/, "the corner badge is the pack's badge mark (icon.js ARC), not a mask");
  for (const sel of [".nv-dot", ".pr-d", ".hr-dot", ".tb-m.is-wait"]) { assert.match(rule(sel), /mask:var\(--mask-needs\)/, sel); assert.doesNotMatch(rule(sel), /rotate/, sel); }
  for (const sel of [".dd-dot", ".shd-dot", ".dg-dot", ".fl-who i", ".stage .cx-pill i", ".xd-state i", ".fl-rb em", ".lp-st>i:not(.lp-arc)"]) assert.match(rule(sel), /mask:var\(--mask-dot\)/, sel);
  assert.doesNotMatch(all, /content:"→/);
});
t("the Undo ring is the pack's undo-countdown; key caps show the pack's key icons", () => {
  assert.match(readSource("modules/decisions/toast.js"), /xi\("undo-countdown", "t-ring"\)/);
  assert.doesNotMatch(readSource("modules/decisions/toast.js"), /<circle cx="10"/);
  const keys = readSource("core/ui/a11y/keycap.js");
  for (const k of ["key-command", "key-option", "key-shift", "key-control", "key-return"]) assert.ok(keys.includes(`"${k}"`), k);
  assert.match(readSource("modules/settings/keys-page.js"), /<kbd>\$\{keyHtml\(K\.label\(a\.id\)\)\}<\/kbd>/);
});
t("something at work on an icon wears the pack's badge-working mark, one helper everywhere", () => {
  assert.match(readSource(icon), /export const ARC = `<i class="arc" aria-hidden="true">\$\{xi\("badge-working"\)\}<\/i>`/);
  for (const [f, s] of src) if (f !== icon) assert.doesNotMatch(s, /<i class="arc"/, f);
  const panel = readSource("css/panel.css");
  assert.match(panel, /\.arc\{[^}]*width:var\(--ic-sm\);height:var\(--ic-sm\)/);
  assert.match(panel, /\.arc>svg>g:first-child>circle\{fill:none\}/);
});
console.log(`\n${passed} passed`);
