import assert from "node:assert/strict";
import { manifestProblems } from "../manifest.js";
import { createKernel } from "../kernel.js";

assert.ok(manifestProblems({ id: "test.consumer", version: "1.0.0", kernel: "^1", optional: true }).includes("optional must be a list of strings"));

const kernel = createKernel(), observed = [];
let read;
kernel.register({
  manifest: { id: "test.consumer", version: "1.0.0", kernel: "^1.1.0", optional: ["badge"] },
  activate(ctx) {
    assert.throws(() => ctx.optional("unlisted"), /Undeclared optional service/);
    assert.throws(() => ctx.use("badge"), /not in its manifest's needs/);
    read = () => ctx.optional("badge");
    observed.push(read());
  },
});
let generation = 0;
kernel.register({
  manifest: { id: "test.addon", version: "1.0.0", kernel: "^1.1.0", provides: ["badge"] },
  activate(ctx) { ctx.provide("badge", ++generation); },
});
await kernel.start();
assert.deepEqual(observed, [undefined]);
assert.equal(read(), 1);
await kernel.disable("test.addon");
assert.equal(read(), undefined);
await kernel.enable("test.addon");
assert.equal(read(), 2);
assert.equal(observed.length, 1, "replacing the optional provider preserves its consumer");
await kernel.disable("test.consumer");
assert.equal(read(), undefined, "a retired consumer loses access to the live provider");
kernel.dispose();
