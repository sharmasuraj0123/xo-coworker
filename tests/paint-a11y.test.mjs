// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, publishedRules } from "./lib/css-snapshot.mjs";

test("the keyboard focus ring paints above the isolated diff and file editors", () => {
  const rings = publishedRules().filter(({ sel }) => sel === ".region-ring");
  assert.equal(rings.length, 1);
  const ring = new Map(rings[0].declarations.map(({ p, v }) => [p, v]));
  assert.equal(ring.get("position"), "absolute");
  assert.equal(ring.get("box-shadow"), "inset 0 0 0 2px var(--focus)");
  assert.equal(ring.get("pointer-events"), "none");
  assert.equal(ring.get("z-index"), "var(--z-raised)");
  const isolation = declarationsFor(":is(.vw-body,.cx-pd)", "isolation");
  assert.ok(isolation.some(({ value }) => value === "isolate"));
});
