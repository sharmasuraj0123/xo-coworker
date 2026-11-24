// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { latest, once } from "../pending.js";
import { createScope } from "../../kernel/scope.js";

test("a superseded response cannot commit even if the transport ignores abort", async () => {
  const key = Symbol();
  const old = Promise.withResolvers();
  const fresh = Promise.withResolvers();
  const committed = [];
  let oldSignal;
  const commit = (value) => committed.push(value);
  const first = latest(key, (signal) => { oldSignal = signal; return old.promise; }, { commit });
  await Promise.resolve();
  const second = latest(key, () => fresh.promise, { commit });
  assert.equal(oldSignal.aborted, true);
  await assert.rejects(first, { name: "AbortError" });
  fresh.resolve("new");
  assert.equal(await second, "new");
  old.resolve("old");
  await old.promise;
  assert.deepEqual(committed, ["new"]);
});

test("disposal cancels a read even if it never settles, and the key can be reused", async () => {
  const scope = createScope();
  const key = Symbol();
  const pending = latest(key, () => new Promise(() => {}), { signal: scope.signal });
  await Promise.resolve();
  scope.dispose();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(latest(key, () => assert.fail("aborted read started"), { signal: scope.signal }), { name: "AbortError" });
  assert.equal(await latest(key, () => 42), 42);
});

test("failures are propagated and once still joins concurrent reads", async () => {
  const key = Symbol();
  await assert.rejects(latest(key, () => { throw new Error("offline"); }), /offline/);
  const first = once(key, () => 1);
  const second = once(key, () => assert.fail("duplicate read"));
  assert.equal(first === second, true);
  assert.equal(await second, 1);
  assert.equal(await once(key, () => 2), 2);
});
