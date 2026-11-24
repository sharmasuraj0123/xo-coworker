// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { isPhone } from "./lib/cascade.mjs";

test("Load earlier and All’s filters use their control heights", () => {
  for (const [selector, height] of [[".hist-more", "--h-sm"], [".all-f button", "--h-ctl"]]) {
    assert.ok(declarationsFor(selector, "height").some(({ value }) => value === "var(" + height + ")"), selector);
  }
  assert.ok(declarationsFor(".all-f button", "align-items").some(({ value }) => value === "center"));
  assert.ok(declarationsFor(".all-f button", "display").some(({ value }) => value === "inline-flex"));
  assert.ok(declarationsFor(".all-f button", "gap").some(({ value }) => resolveValue(value) === "8px"));
});

test("the phone thread head gives its controls four pixels above their focus rings", () => {
  const phone = publishedRules().filter(isPhone);
  const properties = (selector) => Object.fromEntries(phone.filter(({ sel }) => sel === selector)
    .flatMap(({ declarations }) => declarations.map(({ p, v }) => [p, resolveValue(v)])));
  const header = properties(":root:root .thead");
  assert.equal(header.display, "flex");
  assert.equal(header["align-items"], "flex-start");
  assert.equal(header.gap, "8px");
  assert.equal(header.padding, "4px 16px 8px");
  const bar = properties(':root:root .top[data-kind="thread"]');
  assert.equal(bar["border-bottom"], "0");
  assert.equal(bar["padding-bottom"], "0");
});
