// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";

test("startup, activation and browser failures reach the notice line once while the shell is live", async () => {
  const { window } = await dom("");
  const { kernel, failureModule } = await import("../kernel.js");
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
  kernel.register(failureModule);
  kernel.bus.emit("app:started", await kernel.start());
  for (const frame of frames.splice(0)) frame(0);
  assert.equal(shown, 1);
  assert.equal(line.details, "test.feature: Unavailable");
  await kernel.enable(broken.manifest.id);
  const error = Object.assign(new window.Event("error"), { error: new Error("Render failed") });
  const rejection = Object.assign(new window.Event("unhandledrejection"), { reason: "Read failed" });
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  frames.shift()(0);
  assert.equal(shown, 1);
  assert.equal(line.text, "Something went wrong in the app. (4 reports)");
  assert.match(line.details, /test.feature: Unavailable \(×2\)/);
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
  assert.match(line.details, /layers:.*Could not close/);
  kernel.dispose();
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.equal(frames.length, 0);
  assert.equal(line, null);
});
