import assert from "node:assert/strict";
import { createThreadResolve } from "../resolve.js";

for (const succeeds of [true, false]) {
  const controller = new AbortController();
  const held = Promise.withResolvers();
  const started = Promise.withResolvers();
  const receipts = [];
  const publish = () => receipts.push("receipt");
  const resolve = createThreadResolve({
    signal: controller.signal, schedule() {}, announce: publish, heraldShow: publish, heraldFor: publish, heraldDrop: publish,
    world: { thread: () => ({ title: "Review" }), act: { resolve() { started.resolve(); return held.promise; } } },
  });
  const applied = resolve("retiring", true, { undo: false, sayFail: false });
  await started.promise;
  controller.abort();
  if (succeeds) held.resolve(); else held.reject(new Error("Refused"));
  const result = await applied;
  assert.deepEqual(receipts, [], "a retired action cannot publish its outcome");
  assert.deepEqual(result, { ok: false });
}
