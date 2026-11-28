// @ts-check
import assert from "node:assert/strict";
import { gstep } from "../graph-physics.js";

const root = { x: 2, y: 0, vx: 2, vy: 0 };
const file = { x: 35, y: 0, vx: 0, vy: 0 };
const gnodes = /** @type {const} */ ([
  { n: { kind: "root" }, p: root, par: null, ext: { l: -30, t: -20, r: 30, b: 20 } },
  { n: { kind: "file" }, p: file, par: root },
]);
gstep({ gnodes: [...gnodes], alpha: 0 }, (value, low, high) => Math.max(low, Math.min(high, value)));
assert.deepEqual(root, { x: 0, y: 0, vx: 0, vy: 0 });
assert.ok(Math.abs(file.x - 39.6) < 0.001, "the root's label and its gap remain clear");
