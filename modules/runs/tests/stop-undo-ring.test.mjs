import assert from "node:assert/strict";
import { test } from "node:test";
import { stopsHtml } from "../view.js";

test("a stop in the run sheet shows the shared countdown ring on its Undo", () => {
  const html = stopsHtml([{ key: "all:s1", what: "its sub-agents", until: 9000, ms: 3000 }]);
  assert.match(html, /<button type="button" class="t-undo"[^>]*><svg data-ring-until="9000" data-ring-ms="3000"/);
});
