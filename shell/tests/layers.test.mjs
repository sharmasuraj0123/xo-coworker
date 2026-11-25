import assert from "node:assert/strict";
import { createKernel } from "../../core/kernel/index.js";
import { ownLayer, stackLayers } from "../layers.js";

const backOrder = ["create", "jump", "intel", "chat-setup", "runs", "keys", "lightbox", "files-page", "viewer", "panel-sheet", "settings", "shells", "drawer", "decisions"];
const escapeOrder = ["jump", "intel", "quickopen", "runs", "keys", "settings", "files-page", "drawer", "decisions", "chat-setup"];
const ids = [...new Set([...backOrder, ...escapeOrder])].sort();
const kernel = createKernel({ warn() {}, log() {} });
const open = new Set();
const closed = [];
let canLower = false;
const entries = ids.map((id) => ({
  id,
  open: () => open.has(id),
  close() {
    if (id === "shells" && !canLower) return false;
    open.delete(id);
    closed.push(id);
  },
  overlay: id !== "lightbox" && id !== "viewer",
}));
const ctx = { layers: kernel.layers, pushLayer: kernel.layers.push };
const undos = entries.map((layer) => ownLayer(ctx, layer));
const layers = stackLayers(kernel.layers);
assert.equal(kernel.layers.list().length, ids.length);
assert.equal(layers.back(), false);
assert.equal(layers.escape(), false);
assert.throws(() => ownLayer(ctx, { ...entries[0], id: "nowhere" }), /no place in the shell's order/);
assert.throws(() => ownLayer(ctx, entries[0]), /unique ids/);

function compete(action, shown, expected) {
  open.clear();
  closed.length = 0;
  for (const id of shown) open.add(id);
  for (const id of expected) {
    assert.equal(layers[action](), true);
    assert.equal(closed.at(-1), id);
  }
  assert.equal(layers[action](), false);
  assert.deepEqual(closed, expected);
}

compete("back", ["runs", "chat-setup"], ["chat-setup", "runs"]);
compete("escape", ["chat-setup", "runs"], ["runs", "chat-setup"]);
compete("back", ["settings", "panel-sheet", "viewer", "files-page"], ["files-page", "viewer", "panel-sheet", "settings"]);
compete("escape", ["files-page", "settings", "viewer", "panel-sheet"], ["settings", "files-page"]);
compete("back", ["settings", "quickopen"], ["settings"]);
compete("escape", ["settings", "quickopen"], ["quickopen", "settings"]);
compete("back", ["decisions", "shells"], ["decisions"]);
assert.equal(open.has("shells"), true);
canLower = true;
compete("back", ["decisions", "shells"], ["shells", "decisions"]);
compete("back", ids, backOrder);
compete("escape", ids, escapeOrder);

const undoUnordered = kernel.layers.push({ id: "unordered", back: () => true });
assert.throws(() => layers.back(), /unordered.*back order/);
undoUnordered();

open.clear();
open.add("lightbox");
open.add("viewer");
assert.equal(layers.open(), true);
assert.equal(layers.open({ overlay: true }), false);
open.add("panel-sheet");
assert.equal(layers.open({ overlay: true }), true);
undos.forEach((undo) => undo());
assert.equal(kernel.layers.list().length, 0);
console.log("shell layers follow release Back and Escape priorities");
