// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules, resolveValue, tokenValuesFor } from "./lib/css-snapshot.mjs";
import { isPhone } from "./lib/cascade.mjs";

const rules = publishedRules();
const tokens = tokenValuesFor();
const pixels = (value) => typeof value === "string" && /^(?:-?\d+(?:\.\d+)?px|0)$/.test(value) ? parseFloat(value) : NaN;
const declares = ({ declarations }, property, expected) => declarations.some(({ p, v }) => p === property && v === expected);
const resolved = ({ declarations }, property, expected) =>
  declarations.some(({ p, v }) => p === property && resolveValue(v) === expected);

const outline = declarationsFor(":focus-visible", "outline").find(({ value }) => value.endsWith(" solid var(--focus)"));
const outlineOffset = declarationsFor(":focus-visible", "outline-offset").at(0);

function ringExtent() {
  assert.ok(outline && outlineOffset, "the common focus ring is published");
  return pixels(resolveValue(outline.value.split(" ")[0])) + pixels(resolveValue(outlineOffset.value));
}

test("the ring clearance covers its width and offset", () => {
  assert.ok(pixels(resolveValue(tokens.get("--ring-room"))) >= ringExtent());
});

test("controls reserve the ring's clearance through scroll margin", () => {
  const controls = ':where(a[href],button,input,select,textarea,summary,xo-select,[tabindex]:not([tabindex="-1"]),'
    + '[contenteditable="true"])';
  assert.ok(declarationsFor(controls, "scroll-margin").some(({ value }) => value === "var(--ring-room)"));
});

test("the phone file header gives its controls an inside focus ring", () => {
  const phone = rules.filter(isPhone);
  for (const selector of [".vw-x", ".vw-btn"]) {
    assert.ok(phone.some((rule) => rule.sel === selector && resolved(rule, "min-height", "40px")), selector);
  }
  assert.ok(phone.some((rule) => rule.sel === ".viewer:not(.stage .viewer) .vw-top"
    && resolved(rule, "height", "calc(40px + env(safe-area-inset-top, 0px))")));
  assert.ok(phone.some((rule) => rule.sel === ".vw-top :focus-visible" && resolved(rule, "outline-offset", "-2px")
    && declares(rule, "outline-color", "var(--ring-in,var(--focus))")));
});

test("a 40 px bar holds a 32 px control and the ring", () => {
  assert.ok((40 - pixels(resolveValue(tokens.get("--h-ctl")))) / 2 >= ringExtent());
  const bars = rules.filter((rule) => ![".ag-r", ".vw-verbar"].includes(rule.sel)
    && ["height", "min-height"].some((property) => resolved(rule, property, "40px")));
  const roomTaken = bars.filter((rule) => rule.declarations.some(({ p, v }) => {
    const width = v.split(" ")[0];
    return ["border-top", "border-bottom"].includes(p) && resolveValue(width) === "1px";
  }));
  assert.deepEqual(roomTaken.map(({ f, sel }) => f + " " + sel), []);
  const insideRule = "inset 0 -1px 0 var(--line-faint)";
  assert.ok(bars.some((rule) => rule.sel === ".vw-top" && declares(rule, "border-bottom", "0")
    && declares(rule, "box-shadow", insideRule)));
  assert.ok(bars.some((rule) => rule.sel === ".shd-bar" && declares(rule, "box-shadow", insideRule)));
});

test("the desktop version strip fits its smaller controls and ring above its border", () => {
  assert.ok(rules.some(rule => rule.sel === ".vw-verbar" && resolved(rule, "min-height", "40px")
    && declares(rule, "border-bottom", "var(--hair) solid var(--line-faint)")));
  for (const selector of [".vw-vers .vw-btn", ".vw-verbar .xd-btn"]) {
    assert.ok(rules.some(rule => rule.sel === selector && resolved(rule, "height", "24px")), selector);
  }
  assert.ok((40 - 24 - pixels(resolveValue(tokens.get("--hair")))) / 2 >= ringExtent());
});
