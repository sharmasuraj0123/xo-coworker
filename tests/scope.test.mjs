// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../core/kernel/scope.js";
import { createKernel } from "../core/kernel/kernel.js";
import { assertDisposed } from "./scope-assertions.mjs";

test("a scope cancels resources in reverse order and continues after a cleanup throws", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const events = [];
  const scope = createScope({ warn: () => events.push("warned") });
  const target = new EventTarget();
  scope.listen(target, "test", () => events.push("heard"));
  scope.timeout(() => events.push("timeout"), 1);
  scope.interval(() => events.push("interval"), 2);
  scope.observe({ disconnect: () => events.push("disconnected") });
  scope.effect(() => () => { events.push("cleanup"); throw new Error("failed"); });
  target.dispatchEvent(new Event("test"));
  t.mock.timers.tick(1);
  assert.equal(scope.size, 4);
  assertDisposed(scope);
  assertDisposed(scope);
  target.dispatchEvent(new Event("test"));
  t.mock.timers.tick(10);
  assert.deepEqual(events, ["heard", "timeout", "cleanup", "warned", "disconnected"]);
});

test("disposal during an effect and registrations after disposal leave no resources", () => {
  const scope = createScope();
  let released = 0;
  scope.effect(() => {
    scope.dispose();
    return () => { released++; };
  });
  scope.effect(() => assert.fail("disposed scope started work"));
  scope.observe({ disconnect: () => { released++; } });
  assert.equal(scope.size, 0);
  assert.equal(released, 2);
});

test("a disabled activation cannot publish into the next activation", async () => {
  const kernel = createKernel();
  const signals = [];
  const oldActivation = Promise.withResolvers();
  kernel.register({
    manifest: { id: "xo.scope", kernel: "^1", version: "1.0.0", provides: ["example"] },
    async activate(ctx) {
      signals.push(ctx.signal);
      if (signals.length === 1) await oldActivation.promise;
      ctx.provide("example", ctx.signal);
    },
  });
  const started = kernel.start();
  await kernel.disable("xo.scope");
  assert.equal(signals[0].aborted, true);
  assert.equal(kernel.live("xo.scope"), 0);
  await kernel.enable("xo.scope");
  oldActivation.resolve();
  await started;
  assert.equal(kernel.status("xo.scope"), "active");
  assert.equal(signals[1].aborted, false);
  assert.equal(kernel.live("xo.scope"), 1);
  await kernel.disable("xo.scope");
  assert.equal(signals[1].aborted, true);
  assert.equal(kernel.live("xo.scope"), 0);
});
