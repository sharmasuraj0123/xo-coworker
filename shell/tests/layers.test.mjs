// The app's layers on the kernel's stack: Back goes to the top-most open layer, a refusal passes it on, and the open checks read the same list.
import assert from "node:assert/strict";
import { createKernel } from "../../core/kernel/index.js";
import { stackLayers } from "../layers.js";

const K = createKernel({ warn: () => {}, log: () => {} });
const open = new Set(), closed = [];
const layer = (id, extra = {}) => ({ id, open: () => open.has(id), back: () => { open.delete(id); closed.push(id); }, ...extra });
let lowers = false;
const L = stackLayers(K.layers, [layer("create"), layer("jump"), layer("lightbox", { overlay: false }), layer("shells", { back: () => { if (!lowers) return false; open.delete("shells"); closed.push("shells"); return true; } }), layer("panel")]);

assert.equal(K.layers.list().length, 5);
assert.equal(K.layers.top()?.id, "create", "the list's first is the stack's top");
assert.equal(L.open(), false);
assert.equal(K.layers.back(), false, "nothing open: Back goes on to the places");

open.add("panel"); open.add("jump");
assert.equal(L.open(), true);
assert.equal(K.layers.back(), true);
assert.deepEqual(closed, ["jump"], "the top-most open layer answers first");
assert.equal(K.layers.back(), true);
assert.deepEqual(closed, ["jump", "panel"]);

open.add("lightbox");
assert.equal(L.open(), true);
assert.equal(L.open({ overlay: true }), false, "a layer may stay out of the gestures' overlay");

open.delete("lightbox"); open.add("shells"); open.add("panel");
assert.equal(K.layers.back(), true);
assert.equal(closed.at(-1), "panel", "a layer that refuses (false) passes Back on");
assert.ok(open.has("shells"));
lowers = true; open.add("panel");
assert.equal(K.layers.back(), true);
assert.equal(closed.at(-1), "shells", "its own back ran and said it went");
assert.ok(open.has("panel"), "and nothing under it moved");

L.undo();
assert.equal(K.layers.list().length, 0, "undo takes every layer off");
console.log("ok layers: Back by the stack, open by the list");
