// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createRuntimeSettings } from "../settings.js";

test("a rejected runtime poll is reported and keeps the previous cards", async (context) => {
  const { document } = await dom('<section id="settings"><div data-page="runtimes"><div class="set-live"></div></div></section>');
  const failure = new Error("unexpected poll failure");
  const reported = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => reported.push(error) });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, "reportError", previous);
    else Reflect.deleteProperty(globalThis, "reportError");
  });
  const timeout = context.mock.method(globalThis, "setTimeout", () => 0);
  const world = {
    state: { runtimes: [{ name: "codex" }], advisory: null, pools: null, paidPools: null },
    act: { loadRuntimes: async () => { throw failure; }, setPolicy: async () => {}, setPaid: async () => {} },
  };

  const scope = createScope();
  context.after(scope.dispose);
  const root = /** @type {HTMLElement} */ (document.querySelector("#settings"));
  createRuntimeSettings({ world, announce() {}, scope, root }).open();
  const card = document.querySelector(".rt-card");
  assert.ok(card?.textContent.includes("Codex"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(reported, [failure]);
  assert.ok(document.querySelector(".rt-card") === card);
  assert.equal(timeout.mock.callCount(), 1, "polling continues after the rejection");
});
