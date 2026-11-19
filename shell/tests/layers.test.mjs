// The app's layers on the kernel's stack: Back goes to the top-most open layer, a refusal passes it on, and the open checks read the same list.
import assert from "node:assert/strict";
import { createKernel } from "../../core/kernel/index.js";
import { stackLayers, ORDER } from "../layers.js";

const K = createKernel({ warn: () => {}, log: () => {} });
const open = new Set(), closed = [];
const layer = (id, extra = {}) => ({ id, open: () => open.has(id), close: () => { open.delete(id); closed.push(id); }, ...extra });
let lowers = false;
const L = stackLayers(K.layers, [layer("create"), layer("jump"), layer("lightbox", { overlay: false }), layer("shells", { close: () => { if (!lowers) return false; open.delete("shells"); closed.push("shells"); return true; } }), layer("decisions")]);

assert.equal(K.layers.list().length, 5);
assert.equal(K.layers.top()?.id, "create", "the list's first is the stack's top");
assert.equal(L.open(), false);
assert.equal(K.layers.back(), false, "nothing open: Back goes on to the places");

open.add("decisions"); open.add("jump");
assert.equal(L.open(), true);
assert.equal(K.layers.back(), true);
assert.deepEqual(closed, ["jump"], "the top-most open layer answers first");
assert.equal(K.layers.back(), true);
assert.deepEqual(closed, ["jump", "decisions"]);

open.add("lightbox");
assert.equal(L.open(), true);
assert.equal(L.open({ overlay: true }), false, "a layer may stay out of the gestures' overlay");

open.delete("lightbox"); open.add("shells"); open.add("decisions");
assert.equal(K.layers.back(), true);
assert.equal(closed.at(-1), "decisions", "a layer that refuses (false) passes Back on");
assert.ok(open.has("shells"));
lowers = true; open.add("decisions");
assert.equal(K.layers.back(), true);
assert.equal(closed.at(-1), "shells", "its own back ran and said it went");
assert.ok(open.has("decisions"), "and nothing under it moved");

L.undo();
assert.equal(K.layers.list().length, 0, "undo takes every layer off");

// the shell keeps one order, whatever order the app lists them in; a layer it doesn't know is refused
const K2 = createKernel({ warn: () => {}, log: () => {} });
stackLayers(K2.layers, [layer("chat-setup"), layer("settings"), layer("files-page"), layer("quickopen")]);
assert.deepEqual(K2.layers.list().map((l) => l.id).reverse(), ["quickopen", "settings", "files-page", "chat-setup"], "top-most first");
assert.throws(() => stackLayers(K2.layers, [layer("nowhere")]), /no place in the shell's order/);
const above = (a, b) => ORDER.indexOf(a) < ORDER.indexOf(b);
assert.ok(above("settings", "files-page"), "Settings covers the main area, the panel's file with it");
assert.ok(above("decisions", "chat-setup"), "a new chat's setup popover sits under the decisions panel and the drawer");
assert.ok(above("files-page", "panel-sheet"), "a file in the panel goes back to its sections before the panel closes");
assert.ok(above("settings", "panel-sheet"), "Settings sits over the panel (z-index panel + 20), on a phone too");
assert.ok(above("shells", "chat-setup") && above("lightbox", "chat-setup"), "the chat setup popover is under every other layer");
assert.ok(above("intel", "quickopen") && above("quickopen", "runs"), "Quick Open sits with the sheets");

// Esc asks only the layers that take it, in the same order; a layer may take Esc and leave Back alone
const K3 = createKernel({ warn: () => {}, log: () => {} });
open.clear(); closed.length = 0;
stackLayers(K3.layers, [layer("quickopen", { back: false, escape: true }), layer("settings", { escape: true }), layer("panel-sheet")]);
open.add("quickopen"); open.add("settings"); open.add("panel-sheet");
assert.equal(K3.layers.back(), true);
assert.deepEqual(closed, ["settings"], "Back passes over Quick Open");
assert.equal(K3.layers.escape(), true);
assert.deepEqual(closed, ["settings", "quickopen"], "Esc takes Quick Open");
assert.equal(K3.layers.escape(), false, "the panel's sheet keeps its own Esc");
console.log("ok layers: Back by the stack, open by the list, one order, Esc too");
