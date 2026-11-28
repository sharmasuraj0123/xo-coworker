// @ts-check

import assert from "node:assert/strict";
import { list } from "postcss";
import { declarationFiles, stylesheetRows } from "./lib/css-snapshot.mjs";
import { px } from "./lib/cascade.mjs";
import { tokens } from "./lib/tokens.mjs";

const targets = stylesheetRows.flatMap((row) => {
  const selector = row.context.at(-1)?.selector;
  return selector ? [{ ...row, selector, file: declarationFiles.get(row) }] : [];
});
const phone = (row) => row.context.some((scope) => scope.at === "media" && /max-width:\s*760px/.test(scope.params));
const named = (selector) => targets.filter((row) => {
  const candidates = [row.selector, ...[...row.selector.matchAll(/:where\(([^():]+)\)/g)].map((match) => match[1])];
  return candidates.flatMap(list.comma).some((part) => part === selector || part.endsWith(" " + selector));
});
const final = (selector, property, onPhone) => {
  const eligible = named(selector).filter((row) => row.property === property
    && !row.context.some((scope) => scope.at === "container") && (onPhone || !phone(row)));
  const value = eligible.at(-1)?.value;
  return value ? px(value, tokens) : null;
};

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

for (const sel of [".fl-up", ".vw-seg button", ".stg-x", ".fl-rb", ".vw-x", ".x"]) {
  t(`${sel}: no sheet sizes it under 24 px`, () => {
    const bs = named(sel);
    assert.ok(bs.length, `${sel} is declared`);
    for (const row of bs.filter((entry) => /^(?:width|height|min-height)$/.test(entry.property))) {
      const value = px(row.value, tokens);
      if (value !== null) assert.ok(value >= 24, row.file + ": " + row.selector + " " + row.property + " " + value);
    }
  });
}
t("S062: Files' back to the projects is on the scale (24) and, on a phone, the phone's icon size (36 × 36)", () => {
  assert.deepEqual([final(".fl-up", "width", false), final(".fl-up", "height", false)], [24, 24], "24 × 24 beside the chat");
  assert.ok(final(".fl-up", "width", true) >= 36 && final(".fl-up", "height", true) >= 36, "at least 36 × 36 on a phone");
});
t("The file's segment on a phone: its buttons at least 36 tall (the phone's floor), and nothing sets them shorter", () => {
  assert.ok(final(".vw-seg button", "height", true) >= 36, `phone height ${final(".vw-seg button", "height", true)}`);
  for (const row of named(".vw-seg button").filter((entry) => entry.property === "min-height")) {
    assert.notEqual(px(row.value, tokens), 0, row.selector);
  }
  const overrides = targets.filter((row) => row.selector.includes(".vw-seg button") && phone(row)
    && row.property === "min-height");
  const height = final(".vw-seg button", "height", true);
  for (const row of overrides) {
    const floor = px(row.value, tokens);
    if (floor !== null) assert.ok(floor >= 36 || floor <= height, row.selector);
  }
});
for (const onPhone of [false, true]) {
  t(`The file's segment ${onPhone ? "on a phone" : "beside the chat"}: its buttons fit it exactly and sit in it concentrically`, () => {
    const H = final(".vw-seg", "height", onPhone), pad = final(".vw-seg", "padding", onPhone), b = final(".vw-seg button", "height", onPhone);
    const R = final(".vw-seg", "border-radius", onPhone), r = final(".vw-seg button", "border-radius", onPhone);
    assert.equal(H, b + 2 * pad + 2, `segment ${H} = button ${b} + padding ${pad} × 2 + border 1 × 2`);
    assert.equal(r, R - pad - 1, `button radius ${r} = segment radius ${R} − padding ${pad} − border 1`);
  });
}

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
