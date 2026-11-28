import assert from "node:assert/strict";
import { test } from "node:test";
import { createApplicationShape } from "../application.js";
import { createScope } from "../../../kernel/scope.js";
import { dom } from "../../../../tests/lib/dom.mjs";

test("the application Shape tracks terminal availability and releases its world listener", async (t) => {
  await dom("");
  t.mock.method(globalThis, "fetch", async () => Response.json({ shape: null, version: "initial" }));
  const listeners = new Set();
  const events = { onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const scope = createScope();
  t.after(scope.dispose);
  const store = createApplicationShape({ scope, events, notice() {} });
  await store.shape.synced;
  assert.equal(listeners.size, 1);
  assert.equal(store.shape.on("xo:dock/shells"), true);
  store.terminal(() => false);
  assert.equal(store.shape.on("xo:dock/shells"), false);
  scope.dispose();
  assert.equal(listeners.size, 0, "disposal withdraws the Shape subscription");
});
