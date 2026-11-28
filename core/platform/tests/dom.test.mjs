import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { $, $$, findHtml, requireHtml } from "../dom.js";

test("lookups respect the owner and distinguish absent, SVG and typed HTML controls", async () => {
  const { document } = await dom('<input class="field"><section><input class="field"><svg><circle/></svg></section>');
  const section = document.querySelector("section");
  const field = requireHtml(".field", "input", section);
  assert.ok(field === section.firstElementChild);
  assert.ok(field !== $(".field"));
  assert.ok($$(".field")[1] === field);
  assert.ok($("circle", section) === section.querySelector("circle"));
  assert.ok(findHtml("circle", undefined, section) === null);
  assert.ok(findHtml(".field", "textarea", section) === null);
  assert.ok(findHtml(".missing", undefined, section) === null);
  assert.throws(() => requireHtml(".missing", undefined, section), /matching \.missing/);
  assert.throws(() => requireHtml(".field", "button", section), /button matching \.field/);
});
