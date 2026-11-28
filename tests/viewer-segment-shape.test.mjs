import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedRules } from "./lib/css-snapshot.mjs";

const wins = (selector, property) => publishedRules()
  .filter(({ sel, at }) => sel === selector && !at.length)
  .flatMap(({ declarations, n }) => declarations.filter(({ p }) => p === property).map(({ v }) => ({ v, n })))
  .sort((a, b) => a.n - b.n).at(-1)?.v;

test("the viewer's segment keeps concentric segments with room around their labels", () => {
  assert.equal(wins(".vw-seg", "gap"), "var(--gap-control-tight)");
  assert.equal(wins(".vw-seg", "border-radius"), "var(--r)");
  assert.equal(wins(".vw-seg", "padding"), "var(--s-viewer-segment-in)");
  assert.equal(wins(".vw-seg button", "border-radius"), "calc(var(--r) - var(--r-viewer-segment-inset))");
  assert.equal(wins(".vw-seg button", "padding"), "0 var(--s-viewer-seg-inline)");
});
