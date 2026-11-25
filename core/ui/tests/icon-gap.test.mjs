// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules, tokenValuesFor } from "../../../tests/lib/css-snapshot.mjs";

test("the icon gap is one token on the space scale", () => {
  assert.equal(tokenValuesFor().get("--gap-icon"), "var(--s-2)");
});

const rules = publishedRules();
for (const selector of [".agm-n>.agm", ".agm.is-lead", ".hd-tt>:is(i:not(.agm),svg)", ".iq-truth .g", ".stage .cx-none .spin"]) {
  test(`${selector} uses the shared icon gap`, () => {
    const values = rules
      .filter(rule => rule.sel === selector)
      .flatMap(rule => rule.declarations.filter(decl => decl.p === "margin-right").map(decl => decl.v));
    assert.ok(values.length, `a published margin-right for ${selector}`);
    assert.deepEqual([...new Set(values)], ["var(--gap-icon)"]);
  });
}
