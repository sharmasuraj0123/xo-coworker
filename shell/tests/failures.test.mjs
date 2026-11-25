// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../tests/lib/dom.mjs";
import { createKernel } from "../../core/kernel/kernel.js";
import { failureModule } from "../failures.js";

test("startup, activation and browser failures reach the notice line once while the shell is live", async () => {
  const { window } = await dom("");
  const kernel = createKernel({ warn() {} });
  const messages = [];
  kernel.register({
    manifest: { id: "test.notices", version: "1.0.0", kernel: "^1.1.0", provides: ["notices"] },
    activate(ctx) { ctx.provide("notices", { show: (notice) => messages.push(notice.text) }); },
  });
  kernel.register(failureModule);
  const broken = {
    manifest: { id: "test.feature", version: "1.0.0", kernel: "^1.1.0" },
    activate() { throw new Error("Unavailable"); },
  };
  kernel.register(broken);
  kernel.bus.emit("app:started", await kernel.start());
  assert.deepEqual(messages, ["test.feature: Unavailable"]);
  await kernel.enable(broken.manifest.id);
  const error = Object.assign(new window.Event("error"), { error: new Error("Render failed") });
  const rejection = Object.assign(new window.Event("unhandledrejection"), { reason: "Read failed" });
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.deepEqual(messages.slice(1), ["test.feature: Unavailable", "Application error: Render failed", "Application error: Read failed"]);
  kernel.dispose();
  window.dispatchEvent(error);
  window.dispatchEvent(rejection);
  assert.equal(messages.length, 4);
});
