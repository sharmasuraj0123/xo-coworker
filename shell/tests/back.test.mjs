// The phone's own Back: an entry of the app's own is armed after a tap while there's somewhere to go; Back takes a step, or leaves when there's none.
import assert from "node:assert/strict";
import { mock } from "node:test";
import { wireBack } from "../back.js";

const pushed = [];
let backs = 0, state = null, steps = 0;
const win = Object.assign(new EventTarget(), {
  history: { get state() { return state; }, pushState: (s) => { pushed.push(s); state = s; }, back: () => { backs++; } },
});
const doc = new EventTarget();
const gesture = () => doc.dispatchEvent(new Event("xo:gesture"));
const pop = () => win.dispatchEvent(new Event("popstate"));
let can = false, step = true;
const dispose = wireBack({ canBack: () => can, stepBack: () => { steps++; return step; } }, win, doc);

gesture();
assert.deepEqual(pushed, [], "nothing to go back to: no entry");
can = true;
gesture();
assert.deepEqual(pushed, [{ xo: 1 }], "an entry of the app's own");
gesture();
assert.equal(pushed.length, 1, "armed once");

state = null;
pop();
assert.equal(backs, 0);
assert.equal(pushed.length, 2, "Back took a step and armed again");

state = null; step = false;
pop();
assert.equal(backs, 1, "nothing left in the app: the browser goes back");

state = { xo: 1 };
pop();
assert.equal(backs, 1, "forward onto our own entry: nothing happens");
state = null;
pop();
assert.equal(backs, 2, "the cleared entry leaves the next input free to rearm");
mock.timers.enable({ apis: ["setTimeout"] });
try {
  doc.dispatchEvent(new Event("click"));
  win.dispatchEvent(new Event("keyup"));
  doc.dispatchEvent(new Event("touchend"));
  dispose();
  state = null;
  mock.timers.tick(0);
  pop();
  gesture();
  assert.equal(pushed.length, 2, "disposal cancels both queued and future arms");
  assert.equal(steps, 3, "a retained window can no longer step back");
  assert.equal(backs, 2);
} finally {
  mock.timers.reset();
}
console.log("ok back: one entry of the app's own, a step per Back");
