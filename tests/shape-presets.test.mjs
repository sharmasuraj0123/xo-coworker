// The shape store reads a preset from the file that sits beside it, by its own default loader: the URL it asks for is a preset on disk.
import assert from "node:assert/strict";
import engineering from "../core/services/shape/presets/engineering.json" with { type: "json" };
import marketing from "../core/services/shape/presets/marketing.json" with { type: "json" };

const presets = new Map([["engineering", engineering], ["marketing", marketing]].map(([id, data]) =>
  [new URL(`../core/services/shape/presets/${id}.json`, import.meta.url).href, data]));

const asked = [];
globalThis.fetch = async (url) => {
  asked.push(String(url));
  const data = presets.get(String(url));
  return data ? Response.json(data) : new Response(null, { status: 404 });
};
const { createShapeStore } = await import("../core/services/shape/store.js");
const store = createShapeStore({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
for (const id of ["engineering", "marketing"]) {
  const doc = await store.loadPreset(id, { fresh: true });
  assert.ok(doc && doc.preset === 1, `${id}: read from disk`);
  assert.equal(store.presetError(id), null);
}
assert.ok(asked.every((u) => u.includes("/core/services/shape/presets/")), asked.join(" "));
console.log("ok  presets load from beside the store");
