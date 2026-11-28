// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
import { px } from "./lib/cascade.mjs";
import { valuesFor } from "./lib/css-snapshot.mjs";

test("the Projects label and first sidebar row sit eight pixels apart", () => {
  const [margin] = valuesFor(".side-label", "margin");
  const [padding] = valuesFor(".projects", "padding");
  assert.equal(typeof margin, "string", "the Projects label margin resolves in every theme");
  assert.equal(typeof padding, "string", "the Projects list padding resolves in every theme");
  const [, , bottom] = list.space(margin);
  const [top] = list.space(padding);
  const labelGap = px(bottom, {});
  const listGap = px(top, {});
  assert.ok(labelGap !== null && listGap !== null, "both sides of the spacing resolve to pixels");
  assert.equal(labelGap + listGap, 8);
});
