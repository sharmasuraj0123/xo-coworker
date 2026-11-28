// @ts-check
import assert from "node:assert/strict";
import { createHomeParts } from "../parts.js";
import { createHomeSelection } from "../selection.js";

const selection = createHomeSelection();
selection.select("pinned");
const needs = [
  { key: "first", admitted: true, effort: "glance", ask: { kind: "question" }, group: "routine" },
  { key: "later", admitted: true, later: true },
  { key: "second", admitted: true },
  { key: "held", held: true },
  { key: "pinned", admitted: true, effort: "glance", ask: { kind: "approval" }, group: "routine" },
  { key: "more", admitted: true },
];
const isBinary = (ask) => ask?.kind === "approval";
const homeParts = createHomeParts(selection, () => needs, isBinary);
const parts = homeParts();
assert.equal(parts.next?.key, "pinned", "the current eligible card keeps its place");
assert.deepEqual(parts.then.map(({ key }) => key), ["first", "second"]);
assert.deepEqual(parts.more.map(({ key }) => key), ["more"]);
assert.deepEqual(parts.later.map(({ key }) => key), ["later"]);
assert.deepEqual(parts.held.map(({ key }) => key), ["held"]);
assert.deepEqual(parts.glances.map(({ key }) => key), ["pinned"]);
assert.equal(homeParts(needs.filter(({ key }) => key !== "pinned")).next?.key, "first");
assert.equal(selection.current(), "first");
assert.equal(homeParts([]).next, null);
assert.equal(selection.current(), null);
