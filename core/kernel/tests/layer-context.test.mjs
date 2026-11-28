// @ts-check
import assert from "node:assert/strict";
import { createKernel } from "../kernel.js";

const kernel = createKernel(), calls = [];
let active;
kernel.register({
  manifest: { id: "test.layers", version: "1.0.0", kernel: "^1.1.0" },
  activate(ctx) {
    active = ctx.layers;
    ctx.pushLayer({ id: "dialog", escape() { calls.push("escape"); return true; }, back() { calls.push("back"); return true; } });
  },
});
await kernel.start();
assert.ok(active.escape(["dialog"]));
const retired = active;
await kernel.disable("test.layers");
await kernel.enable("test.layers");
assert.equal(retired.back(["dialog"]), false);
assert.ok(active.back(["dialog"]));
assert.deepEqual(calls, ["escape", "back"]);
kernel.dispose();
