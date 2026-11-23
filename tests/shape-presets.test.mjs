// The shape store reads a preset from the file that sits beside it, by its own default loader: the URL it asks for is a preset on disk.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  const path = fileURLToPath(url);
  return existsSync(path) ? new Response(readFileSync(path, "utf8")) : new Response(null, { status: 404 });
};
const { createShapeStore } = await import("../core/services/shape/index.js");
const store = createShapeStore({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
for (const id of ["engineering", "marketing"]) {
  const doc = await store.loadPreset(id, { fresh: true });
  assert.ok(doc && doc.preset === 1, `${id}: read from disk`);
  assert.equal(store.presetError(id), null);
}
assert.ok(asked.every((u) => u.includes("/core/services/shape/presets/")), asked.join(" "));
console.log("ok  presets load from beside the store");
