// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMarkdown } from "../core/ui/markdown/markdown.js";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

test("Markdown heading levels render as message headings", () => {
  const html = renderMarkdown("# a\n\n## b\n\n### c\n\n#### d");
  for (const [level, label] of [[3, "a"], [4, "b"], [5, "c"], [6, "d"]]) {
    assert.ok(html.includes(`<h${level} class="md-h">${label}</h${level}>`));
  }
});

test("message headings use the body's size and line height with strong ink", () => {
  const heading = ".prose :is(h3,h4,h5,h6).md-h";
  assert.deepEqual(valuesFor(heading, "font-size"), ["inherit"]);
  assert.deepEqual(valuesFor(heading, "line-height"), ["inherit"]);
  assert.deepEqual(valuesFor(heading, "font-weight"), [resolveValue("var(--fw-strong)")]);
  assert.deepEqual(valuesFor(heading, "letter-spacing"), ["0"]);
  assert.deepEqual(valuesFor(heading, "color"), [resolveValue("var(--ink)")]);

  const otherHeadings = (selector) => selector !== heading && /h[1-6]\.md-h|\.prose[^,{]*\bh[1-6]\b/.test(selector);
  for (const property of ["font", "font-size", "font-weight", "font-family"]) {
    assert.deepEqual(valuesFor(otherHeadings, property), [], property);
  }
});
