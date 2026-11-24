// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { isPhone } from "./lib/cascade.mjs";

test("Load earlier uses the small control height", () => {
  assert.ok(declarationsFor(".hist-more", "height").some(({ value }) => value === "var(--h-sm)"));
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
