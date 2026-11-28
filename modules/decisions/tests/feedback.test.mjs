// @ts-check

import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";

let reduced = false;
globalThis.matchMedia = () => ({ get matches() { return reduced; } });
const { createDecisionFeedback } = await import("../feedback.js");
const pending = new Map(), notices = [];
let id = 0;
const scope = createScope({ timers: {
  setTimeout(fn, ms) { pending.set(++id, { fn, ms }); return id; },
  clearTimeout(timer) { pending.delete(timer); },
  setInterval, clearInterval,
} });
const feedback = createDecisionFeedback((notice, ms) => notices.push([notice, ms]), scope);
feedback.onAllClear("Two ready");
assert.equal(pending.get(1).ms, 900);
pending.get(1).fn();
pending.delete(1);
assert.deepEqual(notices, [[{ kind: "clear", text: "All clear", sub: "Two ready" }, 4600]]);
reduced = true;
feedback.onNotSent("`Check branch`?", "Unavailable");
assert.equal(pending.get(2).ms, 0);
pending.get(2).fn();
pending.delete(2);
assert.deepEqual(notices.at(-1), [{ kind: "stopped", text: "Not sent", sub: "Check branch · Unavailable", force: true }, 7000]);
feedback.onAllClear("Late");
scope.dispose();
feedback.onBreak(3);
assert.equal(pending.size, 0);
assert.equal(scope.size, 0);
assert.equal(notices.length, 2);
