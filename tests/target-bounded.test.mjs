// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { publishedRules, tokenValuesFor } from "./lib/css-snapshot.mjs";
import { isPhone } from "./lib/cascade.mjs";

const rules = publishedRules();

function properties(selector, predicate = () => true) {
  return Object.fromEntries(rules.filter((rule) => rule.sel === selector && predicate(rule))
    .flatMap(({ declarations }) => declarations.map(({ p, v }) => [p, v])));
}

test("the composer target yields first and its label truncates", () => {
  const target = properties(".target");
  assert.equal(target.flex, undefined);
  assert.equal(target["min-width"], "0");
  assert.equal(target["flex-shrink"], "999");
  assert.equal(target.overflow, "hidden");

  const label = properties(".target>span:not(.tg-t):not(.tg-warn):not(.tg-end)");
  assert.equal(label["min-width"], "0");
  assert.equal(label.overflow, "hidden");
  assert.equal(label["text-overflow"], "ellipsis");
  assert.equal(label["white-space"], "nowrap");
});

test("the model chip leaves room for Attach and Send", () => {
  const chip = properties(".iq");
  assert.equal(chip.flex, "0 1 auto");
  const tokens = tokenValuesFor();
  assert.equal(substitute(chip["max-width"], tokens), "min(320px,100% - 32px - 40px - 3 * 8px)");
  const compact = properties(':root[data-density="compact"] :is(.main,.sheet,.iq-pop)');
  for (const [name, value] of Object.entries(compact)) if (name.startsWith("--")) tokens.set(name, value);
  assert.equal(substitute(chip["max-width"], tokens), "min(320px,100% - 24px - 40px - 3 * 8px)");
  assert.equal(properties(".send").flex, "none");
});

test("on a phone the target shrinks and a paused target shows just its mark", () => {
  const targets = rules.filter((rule) => /^(:root:root )?\.target$/.test(rule.sel) && isPhone(rule));
  assert.ok(targets.length > 0, "the published stylesheet includes phone target rules");
  assert.ok(targets.every(({ declarations }) => declarations.every(({ p, v }) => p !== "flex" || v !== "none")));
  assert.equal(properties(":root:root .target:has(>.tg-warn)>span:not(.tg-warn)", isPhone).display, "none");
});
