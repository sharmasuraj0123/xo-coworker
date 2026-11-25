import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

let nextCase = 0;

async function fixture(t) {
  const id = ++nextCase;
  const active = new Map(), timers = new Map(), idle = new Map();
  const bridge = {
    started: Promise.withResolvers(),
    vendor: Promise.withResolvers(),
    initialized: [],
    workers: 0,
  };
  const key = Symbol.for(`diff warmup test ${id}`);
  let now = 0, next = 0;
  const globals = {
    [key]: bridge,
    Worker: class { constructor() { bridge.workers++; } },
    addEventListener: (type, fn) => active.set(type, fn),
    removeEventListener: (type, fn) => { if (active.get(type) === fn) active.delete(type); },
    requestIdleCallback: (fn) => { idle.set(++next, fn); return next; },
    cancelIdleCallback: (handle) => idle.delete(handle),
    reportError: () => {},
  };
  for (const name of Reflect.ownKeys(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: globals[name], configurable: true, writable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  const reports = t.mock.method(globalThis, "reportError");
  t.mock.method(performance, "now", () => now);
  t.mock.method(globalThis, "setTimeout", (fn) => { timers.set(++next, fn); return next; });
  t.mock.method(globalThis, "clearTimeout", (handle) => timers.delete(handle));
  const library = new URL("../../../vendor/pierre-diffs/diffs.js", import.meta.url).href;
  const vendor = "data:text/javascript," + encodeURIComponent(`
    const bridge = globalThis[Symbol.for("diff warmup test ${id}")];
    bridge.started.resolve();
    await bridge.vendor.promise;
    export function registerCustomTheme() {}
    export function getOrCreateWorkerPoolSingleton({ poolOptions }) {
      poolOptions.workerFactory();
      return { initialize(languages) { bridge.initialized.push(languages); } };
    }
  `);
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === library ? { url: vendor, shortCircuit: true } : nextResolve(specifier, context);
    },
  });
  t.after(() => hooks.deregister());
  await import("../diffthemes.js");
  const adapter = new URL("../diffview.js", import.meta.url);
  adapter.searchParams.set("case", String(id));
  const { prefetch } = await import(adapter.href);
  return {
    active, timers, idle, bridge, reports, prefetch,
    hide(persisted) { active.get("pagehide")?.({ persisted }); },
    delay() { now += 1200; timers.values().next().value(); },
    runIdle() { idle.values().next().value(); },
    async settleVendor() {
      await Promise.allSettled([import(vendor)]);
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test("permanent pagehide cancels the pending warmup delay and releases reserved languages", async (t) => {
  const f = await fixture(t);
  for (let round = 0; round < 2; round++) {
    f.prefetch(["hello.js"]);
    assert.equal(f.timers.size, 1);
    assert.equal(f.active.size, 6);
    f.hide(false);
    await Promise.resolve();
    assert.equal(f.active.size, 0);
    assert.equal(f.timers.size, 0);
  }
  assert.equal(f.bridge.workers, 0);
  assert.equal(f.reports.mock.callCount(), 0);
});

test("persisted pagehide leaves scheduled idle warmup intact", { timeout: 2000 }, async (t) => {
  const f = await fixture(t);
  f.prefetch(["hello.js"]);
  f.delay();
  assert.equal(f.idle.size, 1);
  f.hide(true);
  assert.equal(f.idle.size, 1);
  f.runIdle();
  await f.bridge.started.promise;
  assert.ok(f.active.has("pagehide"));
  f.bridge.vendor.resolve();
  await f.settleVendor();
  assert.deepEqual(f.bridge.initialized, [["javascript"]]);
  assert.equal(f.bridge.workers, 1);
  assert.equal(f.active.size, 0);
});

for (const reject of [false, true]) {
  const outcome = reject ? "rejects" : "resolves";
  test(`permanent pagehide retires warmup before a held vendor import ${outcome}`, { timeout: 2000 }, async (t) => {
    const f = await fixture(t);
    f.prefetch(["hello.js"]);
    f.delay();
    f.runIdle();
    await f.bridge.started.promise;
    assert.ok(f.active.has("pagehide"));
    f.hide(false);
    assert.equal(f.active.size, 0);
    if (reject) f.bridge.vendor.reject(new Error("Late vendor failure"));
    else f.bridge.vendor.resolve();
    await f.settleVendor();
    assert.equal(f.bridge.workers, 0);
    assert.deepEqual(f.bridge.initialized, []);
    assert.equal(f.reports.mock.callCount(), 0);
  });
}
