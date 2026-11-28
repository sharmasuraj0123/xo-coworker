import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../kernel/scope.js";
import { ApiError } from "../../../platform/http.js";
import { createShapeStore, KEYS } from "../store.js";

for (const operation of ["getItem", "setItem", "removeItem"]) {
  test(`Shape reports unexpected ${operation} failures and retains the local fallback`, (t) => {
    const errors = [];
    t.mock.method(console, "error", (error) => errors.push(error));
    const storage = { getItem: () => null, setItem() {}, removeItem() {} };
    const failure = new TypeError(operation);
    const key = operation === "getItem" ? KEYS.mine : operation === "setItem" ? KEYS.device : KEYS.unsynced;
    const original = storage[operation];
    storage[operation] = (at) => { if (at === key) throw failure; return original(); };
    const shape = createShapeStore({ storage });
    assert.equal(shape.chosen, false);
    assert.deepEqual(errors, [failure]);
    errors.length = 0;
    storage[operation] = () => { throw new DOMException("Unavailable", "SecurityError"); };
    createShapeStore({ storage });
    assert.deepEqual(errors, []);
  });
}

test("a Shape write queued for retry belongs to the page lifetime", async (t) => {
  const scope = createScope();
  t.after(scope.dispose);
  let writes = 0;
  const shape = createShapeStore({
    retryMs: [20],
    remote: {
      get: async () => ({ shape: null, version: "new" }),
      put: async () => { writes++; throw new ApiError(0, "network", "Offline"); },
    },
  }, scope);
  await shape.ready;
  const before = scope.size;
  shape.patchMine({ density: "compact" });
  await shape.settled();
  assert.equal(writes, 1);
  assert.equal(shape.held?.why, "unreachable");
  assert.equal(scope.size, before + 1, "the retry is registered with the page");
  scope.dispose();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(writes, 1, "the disposed page cannot submit a retry");
  assert.equal(scope.size, 0);
});

for (const action of ["choose", "setMine", "startup"]) {
  test(`the ${action} preset continuation cannot publish after disposal`, async () => {
    const scope = createScope();
    const pending = Promise.withResolvers();
    const started = Promise.withResolvers();
    const writes = [];
    const storage = {
      getItem: (key) => action === "startup" && key === KEYS.mine ? '{"shape":1,"preset":"marketing"}' : null,
      setItem: (key, value) => writes.push([key, value]),
      removeItem() {},
    };
    const shape = createShapeStore({
      storage,
      load: (_id, signal) => { started.resolve(signal); return pending.promise; },
    }, scope);
    let changes = 0;
    shape.onChange(() => { changes++; });
    const done = action === "choose" ? shape.choose("marketing")
      : action === "setMine" ? shape.setMine({ shape: 1, preset: "marketing" }) : shape.ready;
    const signal = await started.promise;
    const before = writes.length;
    const previous = shape.mine;
    scope.dispose();
    assert.equal(signal.aborted, true);
    pending.resolve({ shape: 1, words: {} });
    await done;
    assert.equal(writes.length, before);
    assert.equal(shape.mine, previous);
    assert.equal(shape.presetFile("marketing"), null);
    assert.equal(changes, 0);
  });
}
