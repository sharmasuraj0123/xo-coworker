import assert from "node:assert/strict";
import { test } from "node:test";
import { shapePage } from "./shape-fixture.mjs";

test("Shape reports a rejected preset read and still paints the presets that loaded", async (t) => {
  const { view, shape, box } = await shapePage();
  const error = new Error("preset loader rejected");
  const reported = [];
  t.mock.method(console, "error", (value) => reported.push(value));
  let marketing;
  shape.loadPreset = async (id) => {
    if (id === "engineering") throw error;
    if (id === "marketing") marketing = { name: "Marketing preset from disk" };
    return marketing;
  };
  shape.presetFile = (id) => id === "marketing" ? marketing : null;
  await view.open();
  assert.deepEqual(reported, [error]);
  assert.match(box().querySelector('[data-shp-preset="marketing"]').textContent, /Marketing preset from disk/);
  assert.ok(box().querySelector('[data-shp-preset="engineering"]'));
});
