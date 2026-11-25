import assert from "node:assert/strict";
import { mock } from "node:test";
import { prefetch } from "../diffview.js";

const active = new Map();
globalThis.Worker = class {
  constructor() { assert.fail("retired highlighting warmup must not create a worker"); }
};
globalThis.addEventListener = (type, fn) => { active.set(type, fn); };
globalThis.removeEventListener = (type, fn) => { if (active.get(type) === fn) active.delete(type); };
let next = 0;
const timers = new Map();
mock.method(globalThis, "setTimeout", (fn) => { timers.set(++next, fn); return next; });
mock.method(globalThis, "clearTimeout", (id) => timers.delete(id));
try {
  for (let round = 0; round < 2; round++) {
    prefetch(["hello.js"]);
    assert.equal(timers.size, 1, "abandoned languages can be warmed on the next mount");
    assert.equal(active.size, 6);
    active.get("pagehide")();
    await Promise.resolve();
    assert.equal(active.size, 0);
    assert.equal(timers.size, 0);
  }
} finally {
  mock.restoreAll();
}
