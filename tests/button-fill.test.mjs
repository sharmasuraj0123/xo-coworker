// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules, resolveValue, stylesheetRows } from "./lib/css-snapshot.mjs";

const rules = publishedRules();
const declarations = (selector) => {
  const rows = rules.filter((rule) => rule.sel === selector);
  assert.ok(rows.length, `Missing rule for ${selector}`);
  return rows.flatMap((rule) => rule.declarations);
};
const role = (selector, property, value) => {
  assert.ok(declarations(selector).some((row) => row.p === property && row.v === value), `${selector} ${property}: ${value}`);
};
const noBorderColor = (selector) => assert.ok(declarations(selector).every((row) => row.p !== "border-color"), selector);
const transparentBorder = (selector) => {
  const values = declarations(selector).filter((row) => row.p === "border-color").map((row) => resolveValue(row.v));
  assert.ok(values.length > 0 && values.every((value) => value === "transparent"), selector);
};

function tintSteps(name, color, expected) {
  const roles = ["", "-hover", "-press"].map((suffix) => `--${name}-fill${suffix}`);
  const keys = new Set(roles);
  const contexts = new Map();
  for (const row of stylesheetRows) {
    if (!keys.has(row.property)) continue;
    const selector = row.context.at(-1)?.selector;
    assert.ok(selector?.startsWith(":root"), `${row.property} must be a root role`);
    const values = contexts.get(selector) ?? new Map();
    const match = /^color-mix\(in srgb,(.+) (\d+)%,(.+)\)$/.exec(row.value);
    assert.ok(match, row.property);
    assert.equal(match[1], `var(--${color})`);
    assert.equal(resolveValue(match[3]), "transparent");
    values.set(row.property, Number(match[2]));
    contexts.set(selector, values);
  }
  const allSteps = [...contexts.values()].map((values) => roles.map((key) => values.get(key)));
  assert.deepEqual(allSteps.sort(), expected.sort());
}

test("neutral, positive and destructive fills have their intended opacity steps", () => {
  tintSteps("btn", "ink", [[14, 18, 22], [7, 10, 13], [14, 18, 22]]);
  tintSteps("ok", "accent-fill", [[16, 22, 28]]);
  tintSteps("danger", "err-ink", [[14, 20, 26], [10, 15, 20], [14, 20, 26]]);
});

test("neutral controls get their shape from a fill and keep the border clear through interaction", () => {
  for (const selector of [".b", ".btn", ".gear", ".tw-act", ".stg-btn", ".create", ".side-plus"]) {
    role(selector, "background", "var(--btn-fill)");
    const rows = declarations(selector);
    assert.ok(rows.filter((row) => row.p === "border").every((row) => String(resolveValue(row.v)).endsWith(" transparent")), selector);
    assert.ok(rows.every((row) => row.p !== "box-shadow"), selector);
  }
  for (const selector of [".b:hover", ".tw-act:hover", ".stg-btn:hover", ".create:hover", ".gear:hover"]) {
    role(selector, "background", "var(--btn-fill-hover)");
    noBorderColor(selector);
  }
  assert.ok(rules.every(({ sel, declarations: rows }) => !rows.some(({ p, v }) => p === "border-color"
    && (/\.b-(allow|back|reply|done)\b/.test(sel) && v === "var(--line-strong)"
      || /data-theme="light"\]\s+\.gear\b/.test(sel)))));
});

test("Deploy, Done and Allow use the positive tint, and destructive buttons keep the danger tint", () => {
  role(".tw-act.lp-btn", "background", "var(--ok-fill)");
  transparentBorder(".tw-act.lp-btn");
  noBorderColor(".tw-act.lp-btn:hover");
  for (const selector of [".b-allow", ".b-done"]) {
    role(selector, "background", "var(--ok-fill)");
    role(`${selector}:hover`, "background", "var(--ok-fill-hover)");
  }
  role(".btn-danger", "background", "var(--danger-fill)");
  transparentBorder(".btn-danger");
});

test("card details use the UI text role", () => {
  role(".dt .prose", "font-size", "var(--fs-ui)");
  role(".dt .prose", "font-weight", "var(--fw-regular)");
  role(".dt .prose", "line-height", "var(--lh-ui)");
});

test("state tints do not bring back a coloured rim", () => {
  const allowed = /\.btn-pri|\.is-pri|\.xd-send|\.lp-f\.is-bad|aria-invalid|\.av-w|\.drop-veil|\.dg-|\.sc-dot|\.m-you\.is-failed|\.pr-ic/;
  const coloured = /--warn|--err|--danger|--accent|accent-rgb|245 166 35|230 131 136/;
  const rims = rules.filter(({ sel, declarations: rows }) => !allowed.test(sel)
    && rows.some(({ p, v }) => /^(border|border-color)$/.test(p) && coloured.test(v)));
  assert.deepEqual(rims.map(({ sel }) => sel), []);
});

test("keyboard focus uses an accent outline and soft halo", () => {
  role(":focus-visible", "outline", "var(--stroke-focus-outline) solid var(--focus)");
  assert.equal(resolveValue("var(--stroke-focus-outline)"), "3px");
  role(":focus-visible", "outline-offset", "0");
  for (const [name, opacity] of [["--focus", ".4"], ["--focus-halo", ".2"]]) {
    assert.deepEqual(stylesheetRows.filter((row) => row.property === name).map(({ value }) => value),
      [`rgba(var(--accent-rgb),${opacity})`, `rgba(var(--accent-rgb),${opacity})`]);
  }
});
