import assert from "node:assert/strict";
import { createKernel } from "../kernel.js";

const kernel = createKernel();
const release = Promise.withResolvers();
const started = Promise.withResolvers();
const events = [];
kernel.register({
  manifest: { id: "xo.child", version: "1.0.0", kernel: "^1.1.0", needs: ["fixture"] },
  async activate(ctx) {
    ctx.effect(() => () => events.push("child"));
    started.resolve();
    await release.promise;
    ctx.effect(() => events.push("late"));
  },
});
kernel.register({
  manifest: { id: "xo.provider", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["fixture"] },
  activate(ctx) {
    ctx.provide("fixture", {});
    ctx.effect(() => () => events.push("provider"));
  },
});
const starting = kernel.start();
await started.promise;
kernel.dispose();
kernel.dispose();
release.resolve();
const report = await starting;
assert.deepEqual(events, ["child", "provider"]);
assert.deepEqual(report.active, []);
assert.deepEqual(report.disabled.sort(), ["xo.child", "xo.provider"]);
assert.equal(kernel.live("xo.child") + kernel.live("xo.provider"), 0);
await assert.rejects(kernel.enable("xo.provider"), /disposed/);
