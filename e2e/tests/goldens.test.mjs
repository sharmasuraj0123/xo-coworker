// @ts-check

// Which goldens a run may call unused, without a browser.
import assert from "node:assert/strict";
import { unused } from "../lib/goldens.mjs";

const all = ["a.aria.yml", "b.aria.yml", "c.aria.yml"], used = new Set(["a.aria.yml", "b.aria.yml"]);
assert.deepEqual(unused({ filter: "", total: 3, passed: 3, used, all }), ["c.aria.yml"], "a whole run that passed names the golden no case used");
assert.deepEqual(unused({ filter: "", total: 3, passed: 2, used, all }), [], "a run with a failed case names none: the case may have stopped before its snapshot");
assert.deepEqual(unused({ filter: "shell", total: 1, passed: 1, used, all }), [], "a filtered run names none");
assert.deepEqual(unused({ filter: "", total: 0, passed: 0, used, all }), [], "a run with no cases names none");
console.log("4 passed");
