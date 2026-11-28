// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, stringify } from "css-what";
import { regionRings } from "../core/ui/a11y/ring.js";
import { stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

const focusedChild = ":has(:is(input,textarea):focus-visible)";
const sharedOutline = /^:is\(([^)]*)\):has\(:is\(input,textarea\):focus-visible\),\.fl-new-r input:focus-visible$/;

test("field wrappers covered by the shared focus rule have no extra ring", () => {
  const shared = stylesheetRows.filter((row) => row.property === "outline" && row.value === "none"
    && sharedOutline.test(row.context.at(-1)?.selector ?? ""));
  assert.equal(shared.length, 1);
  const sharedSelector = shared[0].context.at(-1).selector;
  const wrappers = new Set(sharedOutline.exec(sharedSelector)[1].split(",").concat(".fl-new-r"));
  for (const row of stylesheetRows) {
    const selector = row.context.at(-1)?.selector ?? "";
    if (selector.includes(focusedChild)) {
      assert.ok(row.property !== "outline-color" && row.property !== "box-shadow", selector);
      if (row.property === "outline") assert.equal(row.value, "none", selector);
    }
    if (row.property !== "outline" || !["none", "0"].includes(row.value) || selector.includes(":focus")) continue;
    if (!/(?:textarea|input)/.test(selector.split(",").at(-1))) continue;
    const wrapper = selector.replace(/\s+(?:textarea|input)[^\s]*$/, "").split(/\s+/).at(-1);
    assert.ok(wrappers.has(wrapper), selector);
  }
});

test("bordered fields draw keyboard focus on their own edge", () => {
  const fieldTypes = ["checkbox", "radio", "range", "button", "submit", "reset", "file", "color", "image"];
  const except = fieldTypes.map((type) => `[type=${type}]`).join(",");
  const selector = stringify(parse(`:is(input:not(${except}),textarea,select,.dd-btn):focus-visible`));
  const sharedFieldRing = (candidate) => candidate.startsWith(":is(input:not(") && stringify(parse(candidate)) === selector;
  assert.deepEqual(valuesFor(sharedFieldRing, "outline-offset"), ["-1px"]);
  const fields = (candidate) => !candidate.includes(":has(")
    && /(^|[\s,(>])(?:input|textarea|select)\b[^,]*:focus/.test(candidate);
  for (const offset of valuesFor(fields, "outline-offset").flat()) {
    assert.ok(!/^[1-9]/.test(offset), offset);
  }
});

test("editing a Markdown file leaves only its caret as the focus mark", async () => {
  const overEditor = (selector) => /#viewer:has\([^)]*cm-focused[^)]*\)::after/.test(selector);
  assert.deepEqual(valuesFor(overEditor), []);
  assert.deepEqual(valuesFor(".vw-body:focus-within", "outline"), []);
  assert.deepEqual(valuesFor(".vw-doc>.cm-editor.cm-focused", "outline"), ["none"]);
  assert.deepEqual(valuesFor(".vw-body.vw-doc:focus-visible", "outline"), ["none"]);

  const { document, window } = await dom('<main><div class="vw-body"></div><div class="vw-body vw-doc"></div></main>');
  const [viewer, editor] = document.querySelectorAll(".vw-body");
  for (const element of [viewer, editor]) {
    const matches = element.matches.bind(element);
    element.matches = (selector) => selector === ":focus-visible" || matches(selector);
    Object.defineProperty(element, "offsetParent", { value: element.parentElement });
  }
  window.requestAnimationFrame = (run) => run();
  regionRings(document, window);
  viewer.focus();
  assert.ok(document.querySelector(".region-ring"));
  editor.focus();
  assert.ok(!document.querySelector(".region-ring"), "the focus ring was removed");
  assert.equal(editor.classList.contains("has-ring"), false);
});
