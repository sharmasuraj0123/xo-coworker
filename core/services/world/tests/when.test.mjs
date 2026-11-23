// @ts-check
import assert from "node:assert/strict";
import { whenWorld } from "../when.js";

/** @type {Set<() => void>} */
const listeners = new Set();
const world = {
  subscribe(/** @type {() => void} */ listener) {
    listeners.add(listener);
    listener();
    return () => { listeners.delete(listener); };
  },
};
let calls = 0;
whenWorld(world, () => true, () => { calls++; });
assert.equal(calls, 1);
assert.equal(listeners.size, 0, "the synchronous subscription is removed");

let ready = false;
whenWorld(world, () => ready, () => { calls++; });
assert.equal(listeners.size, 1);
for (const listener of listeners) listener();
assert.equal(calls, 1);
ready = true;
for (const listener of listeners) listener();
assert.equal(calls, 2);
assert.equal(listeners.size, 0, "a later matching commit removes the subscription");
