// @ts-check

import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { tokenValuesFor } from "./lib/css-snapshot.mjs";

const { document } = await dom("");
const tokens = tokenValuesFor();
const token = (name) => tokens.get(name);
let styleReads = 0;
globalThis.getComputedStyle = (node) => {
  assert.equal(node === document.documentElement, true);
  styleReads++;
  return { getPropertyValue: token };
};
const { EASE, IN, MOVE, OUT } = await import("../core/ui/motion.js");
const ms = (name) => {
  const value = token(name);
  return parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
};
assert.deepEqual([IN, MOVE, OUT], [ms("--d-in"), ms("--d-move"), ms("--d-out")]);
assert.equal(EASE, token("--ease"));
assert.equal(styleReads, 1);
