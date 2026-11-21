// Marks are the owner's pack icons, never text characters (■ ◆ ✱ ✓ ○ draw with the font's rough edges).
//   node tests/pack-marks.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../js/", import.meta.url);
const src = readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "xoicons.js").map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
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
  const ui = readFileSync(new URL("ui.js", dir), "utf8");
  assert.match(ui, /doing: xi\("step-doing"\)/);
  assert.match(ui, /todo: xi\("state-idle"\)/);
  assert.match(ui, /export const stepMark = \(s\) => \(s === "done" \? ICON\.check : s === "doing" \? ICON\.doing : ICON\.todo\);/);
});
t("a state mark is the pack's state-* icon, never a CSS-drawn box, ring or diamond", () => {
  for (const [f, s] of src) assert.doesNotMatch(s, /<i class="g /, f);
  const css = ["app.css", "links.css", "phone.css"].map((c) => readFileSync(new URL(`../css/${c}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(css, /(^|\n|\})\.g(-[a-z_]+)?(,\.g-[a-z_]+)*\{[^}]*(border|background|rotate)/);
});
t("spinners, needs-you marks and status dots draw from the pack's files, not CSS borders, rotations or rounded boxes", () => {
  const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
  const tok = css("tokens.css");
  for (const [k, f] of [["working", "e-state-marks/state-working.svg"], ["needs", "e-state-marks/state-needs-you.svg"], ["dot", "d-things-and-kinds/step-dot.svg"], ["stop", "c-actions/stop.svg"], ["warn", "d-things-and-kinds/warning.svg"], ["next", "b-arrows-and-chevrons/arrow-right.svg"]])
    assert.match(tok, new RegExp(`--mask-${k}:url\\(\\.\\./assets/icons/xo/${f.replace(/\./g, "\\.")}\\)`), k);
  const all = ["app.css", "panel.css", "launchpad.css", "diffs.css", "rich.css", "dropdown.css", "docs.css"].map(css).join("\n");
  const rule = (sel) => { const i = all.indexOf(sel + "{"); assert.ok(i >= 0, sel); return all.slice(i, all.indexOf("}", i)); };
  for (const sel of [".spin", ".tb-live", ".arc::before", ".lp-arc::before", ".xd-arc::before"]) assert.match(rule(sel), /mask:var\(--mask-working\)/, sel);
  for (const sel of [".nv-dot", ".pr-d", ".hr-dot", ".tb-m.is-wait"]) { assert.match(rule(sel), /mask:var\(--mask-needs\)/, sel); assert.doesNotMatch(rule(sel), /rotate/, sel); }
  for (const sel of [".dd-dot", ".shd-dot", ".dg-dot", ".fl-who i", ".stage .cx-pill i", ".xd-state i", ".fl-rb em", ".lp-st>i:not(.lp-arc)", ".lpv-light", ".syl-gh i,.syl-chip i"]) assert.match(rule(sel), /mask:var\(--mask-dot\)/, sel);
  assert.doesNotMatch(all, /content:"→/);
});
t("the Undo ring is the pack's undo-countdown; key caps show the pack's key icons", () => {
  const read = (f) => readFileSync(new URL(f, dir), "utf8");
  assert.match(read("decide.js"), /xi\("undo-countdown", "t-ring"\)/);
  assert.doesNotMatch(read("decide.js"), /<circle cx="10"/);
  const keys = read("keys.js");
  for (const k of ["key-command", "key-option", "key-shift", "key-control", "key-return"]) assert.ok(keys.includes(`"${k}"`), k);
  assert.match(read("app.js"), /<kbd>\$\{K\.keyHtml\(K\.label\(a\.id\)\)\}<\/kbd>/);
});
console.log(`\n${passed} passed`);
