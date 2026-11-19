import assert from "node:assert/strict";
import { createKernel } from "../../core/kernel/index.js";
import { PLACES, definePlaces } from "../places.js";

const K = createKernel({ warn: () => {}, log: () => {} });
const undo = definePlaces(K);
assert.equal(K.places.catalog().length, PLACES.length);
assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length);
for (const p of PLACES) assert.ok(p.requires.length > 0, `${p.id} names what its entries need`);

assert.throws(() => K.places.contribute("rail.entry", { id: "x", label: "X" }, "m"), /icon must be a non-empty string/);
assert.throws(() => K.places.contribute("panel.page", { id: "files" }, "m"), /mount must be a function/);
K.places.contribute("panel.page", { id: "files", mount: () => {} }, "xo.files");
K.places.contribute("rail.entry", { id: "shells", label: "Shells", icon: "terminal", onPress: () => {} }, "xo.shells");

undo();
assert.equal(K.places.catalog().length, 0);
console.log("ok places: every place defined once, entries checked, all undone");
