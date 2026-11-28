import assert from "node:assert/strict";
import { test } from "node:test";
import { shapePage } from "./shape-fixture.mjs";
import { createScope } from "../../../core/kernel/scope.js";

test("Shape reports a rejected preset read and still paints the presets that loaded", async (t) => {
  const { page, shape, box } = await shapePage();
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
  await page.open();
  assert.deepEqual(reported, [error]);
  assert.match(box().querySelector('[data-shp-preset="marketing"]').textContent, /Marketing preset from disk/);
  assert.ok(box().querySelector('[data-shp-preset="engineering"]'));
});

test("a replacement Shape page releases its busy state without announcing the retired choice", async () => {
  const { view, scope, shape, said, box, press } = await shapePage();
  const pending = Promise.withResolvers();
  shape.choose = () => pending.promise;
  await press('[data-shp-preset="marketing"]');
  scope.dispose();
  const next = createScope();
  const page = view.mount(next);
  await page.open();
  assert.ok(box().querySelector("[data-shp-preset][aria-busy]"));
  pending.resolve({ kept: true });
  await new Promise(setImmediate);
  assert.deepEqual(said, []);
  assert.ok(!box().querySelector("[data-shp-preset][aria-busy]"));
  next.dispose();
});
