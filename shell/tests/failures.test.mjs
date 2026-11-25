// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";
import { createKernel } from "../../core/kernel/kernel.js";
import { failureModule } from "../failures.js";

test("startup, activation and browser failures reach the notice line once while the shell is live", async () => {
  const { window } = await dom("");
  const kernel = createKernel({ warn() {} });
  const frames = [];
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  let line = null, shown = 0;
  const notices = {
    show(notice) { shown++; line = notice; },
    forMsg(mid, make) { if (!line || line.mid !== mid) return false; line = make(line); return true; },
    drop() { line = null; },
  };
  kernel.register({
    manifest: { id: "test.notices", version: "1.0.0", kernel: "^1.1.0", provides: ["notices"] },
    activate(ctx) { ctx.provide("notices", notices); },
  });
  kernel.register(failureModule);
  const broken = {
    manifest: { id: "test.feature", version: "1.0.0", kernel: "^1.1.0" },
    activate() { throw new Error("Unavailable"); },
  };
  kernel.register(broken);
  kernel.bus.emit("app:started", await kernel.start());
  frames.shift()(0);
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
  kernel.dispose();
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.equal(frames.length, 0);
  assert.equal(line, null);
});
