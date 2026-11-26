// Status marks use the shared icon pack for consistent rendering.
import assert from "node:assert/strict";
import { xi } from "../core/ui/icons/icon.js";
import { ICON, stepMark } from "../core/ui/icons/names.js";
import { declarationsFor, publishedRules, tokenValuesFor } from "./lib/css-snapshot.mjs";
import { readSource, sourcePaths } from "./lib/sources.mjs";

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
  for (const { sel, declarations } of publishedRules()) {
    if (/^\.g(-[a-z_]+)?$/.test(sel)) {
      assert.ok(declarations.every(({ p, v }) => !/border|background|rotate/.test(p + " " + v)), sel);
    }
  }
});
t("spinners, needs-you marks and status dots draw from the pack's files, not CSS borders, rotations or rounded boxes", () => {
  const tokens = tokenValuesFor();
  const files = [
    ["working", "e-state-marks/state-working.svg"], ["needs", "e-state-marks/state-needs-you.svg"],
    ["dot", "d-things-and-kinds/step-dot.svg"], ["stop", "c-actions/stop.svg"],
    ["warn", "d-things-and-kinds/warning.svg"], ["next", "b-arrows-and-chevrons/arrow-right.svg"],
  ];
  for (const [name, path] of files) {
    assert.ok(tokens.get(`--mask-${name}`)?.startsWith(`url("/core/ui/icons/source/xo/${path}")`), name);
  }
  const rules = publishedRules();
  const check = (selector, role, rotates = true) => {
    const matches = rules.filter(({ sel }) => sel === selector);
    const declarations = matches.flatMap((rule) => rule.declarations);
    assert.ok(declarations.some(({ p, v }) => p.endsWith("mask") && v === `var(--mask-${role})`), selector);
    if (!rotates) assert.ok(declarations.every(({ p, v }) => !/rotate/.test(p + " " + v)), selector);
  };
  check(".spin", "working");
  for (const f of ["modules/conversation/blocks/turn.js", "modules/launchpad/views.js", "modules/launchpad/launchpad.js"]) assert.doesNotMatch(readSource(f), /class="(tb-live|lp-arc)"/, f);
  for (const { sel, declarations } of rules) {
    const turns = declarations.some(({ p, v }) => p.startsWith("animation") && /\b(spin|arc-turn)\b/.test(v));
    const masked = declarations.some(({ p }) => p.endsWith("mask"));
    if (turns && masked) assert.ok(declarations.every(({ p, v }) => !(p.startsWith("background") && v === "currentColor")), `${sel}: a turning mask paints its whole square`);
  }
  assert.ok(!rules.some(({ sel }) => /\.arc::before/.test(sel)), "the corner badge draws its SVG");
  for (const sel of [".nv-dot", ".pr-d", ".hr-dot", ".tb-m.is-wait"]) check(sel, "needs", false);
  const dots = [".dd-dot", ".shd-dot", ".dg-dot", ".fl-who i", ".stage .cx-pill i", ".xd-state i", ".fl-rb em", ".lp-st>i:not(.lp-arc)"];
  for (const sel of dots) check(sel, "dot");
  for (const { sel, declarations } of rules) {
    assert.ok(declarations.every(({ p, v }) => p !== "content" || !/^["']→/.test(v)), sel);
  }
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
  for (const dimension of ["width", "height"]) {
    assert.ok(declarationsFor(".arc", dimension).some(({ value }) => value === "var(--ic-sm)"), dimension);
  }
  assert.ok(declarationsFor(".arc>svg>g:first-child>circle", "fill").some(({ value }) => value === "none"));
});
console.log(`\n${passed} passed`);
