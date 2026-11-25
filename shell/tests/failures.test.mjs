// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";
import { createFailureReporting } from "../failures.js";
import { createScope } from "../../core/kernel/scope.js";

test("startup, activation and browser failures reach the notice line once while the shell is live", async t => {
  const logged = t.mock.method(console, "error", () => {});
  const { window } = await dom("");
  const { createShellKernel } = await import("../kernel.js");
  const kernel = createShellKernel();
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  let line = null, shown = 0;
  const notices = {
    show(notice) { shown++; line = notice; },
    forMsg(mid, make) { if (!line || line.mid !== mid) return false; line = make(line); return true; },
    drop() { line = null; },
  };
  const broken = {
    manifest: { id: "test.feature", version: "1.0.0", kernel: "^1.1.0" },
    activate() { throw new Error("Unavailable"); },
  };
  kernel.register(broken);
  kernel.register({
    manifest: { id: "test.notices", version: "1.0.0", kernel: "^1.1.0", provides: ["notices"] },
    activate(ctx) { ctx.provide("notices", notices); },
  });
  kernel.bus.emit("app:started", await kernel.start());
  for (const frame of frames.splice(0)) frame(0);
  assert.equal(shown, 1);
  assert.match(line.details, /^test\.feature \/ activation: Unavailable\nError: Unavailable/);
  assert.equal(logged.mock.callCount(), 1);
  assert.deepEqual(logged.mock.calls[0].arguments[0], { module: "test.feature", phase: "activation" });
  await kernel.enable(broken.manifest.id);
  const error = Object.assign(new window.Event("error"), { error: new Error("Render failed") });
  const rejection = Object.assign(new window.Event("unhandledrejection"), { reason: "Read failed" });
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  frames.shift()(0);
  assert.equal(shown, 1);
  assert.equal(line.text, "Something went wrong in the app. (4 reports)");
  assert.match(line.details, /test.feature \/ activation: Unavailable \(×2\)/);
  assert.match(line.details, /Application error: Render failed/);
  assert.match(line.details, /Application error: Read failed/);
  kernel.bus.on("test:navigate", () => { throw new Error("Could not navigate"); });
  kernel.bus.emit("test:navigate");
  kernel.layers.push({ id: "test", escape() { throw new Error("Could not close"); } });
  kernel.layers.escape();
  frames.shift()(0);
  assert.equal(shown, 1);
  assert.equal(line.text, "Something went wrong in the app. (6 reports)");
  assert.match(line.details, /test:navigate.*Could not navigate/);
  assert.match(line.details, /layers \/ escape \/ test: Could not close/);
  assert.equal(logged.mock.callCount(), 4);
  kernel.dispose();
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.equal(frames.length, 0);
  assert.equal(line, null);
});

test("startup faults log immediately and a late presenter receives one bounded notice", async t => {
  const logged = t.mock.method(console, "error", () => {});
  const reporting = createFailureReporting();
  for (let i = 0; i < 20; i++) {
    const error = new Error("Startup fault " + i);
    const source = { module: "xo.startup", phase: "activation" };
    reporting.warn(source, error);
    assert.equal(logged.mock.calls[i].arguments[0] === source, true);
    assert.equal(logged.mock.calls[i].arguments[1] === error, true);
  }
  await Promise.resolve();
  assert.equal(logged.mock.callCount(), 20);
  await dom("");
  const notices = [], scope = createScope();
  t.after(scope.dispose);
  reporting.module.activate({ ...scope, use: () => ({ forMsg: () => false, show: notice => notices.push(notice), drop() {} }) });
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /20 reports/);
  assert.match(notices[0].details, /12 additional reports$/);
  assert.equal(logged.mock.callCount(), 20);
});
