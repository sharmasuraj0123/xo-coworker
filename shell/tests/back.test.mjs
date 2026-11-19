// The phone's own Back: an entry of the app's own is armed after a tap while there's somewhere to go; Back takes a step, or leaves when there's none.
import assert from "node:assert/strict";
import { wireBack } from "../back.js";

const on = {}, add = (k) => (t, fn) => { on[`${k}:${t}`] = fn; };
const pushed = [];
let backs = 0, state = null;
const win = /** @type {any} */ ({ history: { get state() { return state; }, pushState: (s) => { pushed.push(s); state = s; }, back: () => { backs++; } }, addEventListener: add("win") });
const doc = /** @type {any} */ ({ addEventListener: add("doc") });
let can = false, step = true;
wireBack({ canBack: () => can, stepBack: () => step }, win, doc);

on["doc:xo:gesture"]();
assert.deepEqual(pushed, [], "nothing to go back to: no entry");
can = true;
on["doc:xo:gesture"]();
assert.deepEqual(pushed, [{ xo: 1 }], "an entry of the app's own");
on["doc:xo:gesture"]();
assert.equal(pushed.length, 1, "armed once");

state = null;
on["win:popstate"]();
assert.equal(backs, 0);
assert.equal(pushed.length, 2, "Back took a step and armed again");

state = null; step = false;
on["win:popstate"]();
assert.equal(backs, 1, "nothing left in the app: the browser goes back");

state = { xo: 1 };
on["win:popstate"]();
assert.equal(backs, 1, "forward onto our own entry: nothing happens");
console.log("ok back: one entry of the app's own, a step per Back");
