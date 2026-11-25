// @ts-check
import assert from "node:assert/strict";
import "./boot/environment.mjs";

await import("../boot.js");
const { default: kernel } = await import("../js/app.js");
const ids = () => kernel.layers.list().map((layer) => layer.id);
const owners = [
  ["xo.files", ["files-page", "viewer"]],
  ["xo.jump", ["jump"]],
  ["xo.create-project", ["create"]],
  ["xo.settings-frame", ["settings"]],
];
try {
  for (const [module, layers] of owners) {
    for (const id of layers) assert.equal(ids().filter((layer) => layer === id).length, 1, id);
    await kernel.disable(module);
    for (const id of layers) assert.ok(!ids().includes(id), module + " retired " + id);
    assert.deepEqual((await kernel.enable(module)).failed, []);
    for (const id of layers) assert.equal(ids().filter((layer) => layer === id).length, 1, module + " restored " + id);
  }
} finally {
  let events = 0;
  kernel.bus.on("app:pagehide", () => { events++; });
  window.dispatchEvent(Object.assign(new window.Event("pagehide"), { persisted: true }));
  assert.equal(events, 1);
  assert.equal(kernel.status("xo.page-lifetime"), "active");
  kernel.dispose();
  window.dispatchEvent(new window.Event("pagehide"));
  assert.equal(events, 1, "disposed boot releases its page listener");
}
