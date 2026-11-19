// The kernel (core/kernel): places, bus, scheduler, layers, semver and the module lifecycle, with the
// conformance rule every module will be held to: disable leaves nothing behind (live(id) === 0).
//   node tests/kernel.test.mjs
import assert from "node:assert/strict";
import { createKernel, manifestProblems, satisfies } from "../core/kernel/index.js";
import { createPlaces } from "../core/kernel/places.js";
import { createBus } from "../core/kernel/bus.js";
import { createScheduler } from "../core/kernel/scheduler.js";
import { createLayers } from "../core/kernel/layers.js";

let passed = 0;
const quiet = () => {};
async function t(name, fn) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n    " + (e && e.stack || e)); process.exitCode = 1; }
}
const mod = (id, extra = {}, activate = () => {}) => ({ manifest: { id, version: "1.0.0", kernel: "^1", ...extra }, activate });

await t("places: list orders by order, then registration; when() hides; the arranger reorders", () => {
  const P = createPlaces(quiet);
  P.define({ id: "rail.entry", kind: "list", scope: "app", description: "left rail" });
  P.contribute("rail.entry", { id: "b", order: 2 }, "m1");
  P.contribute("rail.entry", { id: "a", order: 1 }, "m1");
  P.contribute("rail.entry", { id: "c", order: 1, when: (at) => at.view !== "home" }, "m2");
  assert.deepEqual(P.entries("rail.entry", { view: "ws" }).map((e) => e.id), ["a", "c", "b"]);
  assert.deepEqual(P.entries("rail.entry", { view: "home" }).map((e) => e.id), ["a", "b"]);
  assert.equal(P.get("rail.entry", "c").owner, "m2");
  const undo = P.arrange("rail.entry", (list) => list.slice().reverse());
  assert.deepEqual(P.entries("rail.entry", { view: "ws" }).map((e) => e.id), ["b", "c", "a"]);
  undo();
  assert.deepEqual(P.entries("rail.entry", { view: "ws" }).map((e) => e.id), ["a", "c", "b"]);
});

await t("places: single holds one; keyed rejects a duplicate id; chain's first() is the highest priority that applies", () => {
  const P = createPlaces(quiet);
  P.define({ id: "dock.bottom", kind: "single", scope: "app", description: "d" });
  const u = P.contribute("dock.bottom", { id: "shells" }, "xo.shells");
  assert.throws(() => P.contribute("dock.bottom", { id: "other" }, "x"), /holds one entry/);
  u(); P.contribute("dock.bottom", { id: "other" }, "x");
  P.define({ id: "panel.page", kind: "keyed", scope: "app", description: "p" });
  P.contribute("panel.page", { id: "files" }, "xo.files");
  assert.throws(() => P.contribute("panel.page", { id: "files" }, "y"), /already contributed by xo.files/);
  P.define({ id: "composer.target", kind: "chain", scope: "conversation", description: "c" });
  P.contribute("composer.target", { id: "default", priority: 0 }, "a");
  P.contribute("composer.target", { id: "paused", priority: 10, when: (at) => !!at.paused }, "b");
  assert.equal(P.first("composer.target", {}).id, "default");
  assert.equal(P.first("composer.target", { paused: true }).id, "paused");
});

await t("places: definitions are checked; watchers hear changes; a throwing when() hides only that entry", () => {
  const warns = [];
  const P = createPlaces((...a) => warns.push(a));
  assert.throws(() => P.define({ id: "Bad Id", kind: "list", scope: "app", description: "x" }), /dotted lower-case/);
  assert.throws(() => P.define({ id: "a.b", kind: "stack", scope: "app", description: "x" }), /kind/);
  assert.throws(() => P.define({ id: "a.b", kind: "list", scope: "app" }), /description/);
  P.define({ id: "a.b", kind: "list", scope: "app", description: "x", check: (e) => { if (!e.label) throw new Error("needs a label"); } });
  assert.throws(() => P.contribute("a.b", { id: "x" }, "m"), /needs a label/);
  let heard = 0;
  P.watch("a.b", () => heard++);
  const u = P.contribute("a.b", { id: "x", label: "X" }, "m");
  P.contribute("a.b", { id: "y", label: "Y", when: () => { throw new Error("boom"); } }, "m");
  assert.deepEqual(P.entries("a.b").map((e) => e.id), ["x"]);
  u(); u();
  assert.equal(heard, 3);
  assert.equal(warns.length, 1);
  assert.throws(() => P.entries("nope"), /no place "nope"/);
});

await t("bus: a listener that throws doesn't stop the others; once() fires once", () => {
  const B = createBus(quiet);
  const got = [];
  B.on("x", () => { throw new Error("bad"); });
  B.on("x", (p) => got.push(p));
  B.once("x", (p) => got.push("once:" + p));
  B.emit("x", 1); B.emit("x", 2);
  assert.deepEqual(got, [1, "once:1", 2]);
});

await t("scheduler: invalidations batch into one flush; flushers run in registration order, only for marked keys", () => {
  const queue = [];
  const S = createScheduler({ request: (fn) => queue.push(fn), warn: quiet });
  const ran = [];
  S.onFlush("a", () => ran.push("a"));
  S.onFlush("b", () => ran.push("b"));
  S.onFlush("a", () => ran.push("a2"));
  S.invalidate("a"); S.invalidate("a"); S.invalidate("a");
  assert.equal(queue.length, 1);
  queue.shift()();
  assert.deepEqual(ran, ["a", "a2"]);
  S.invalidate();
  queue.shift()();
  assert.deepEqual(ran, ["a", "a2", "a", "b", "a2"]);
});

await t("layers: Esc is offered top-down until one takes it; closing returns focus", () => {
  const L = createLayers(quiet);
  const order = [];
  let focused = false;
  const opener = { isConnected: true, focus: () => { focused = true; } };
  L.push({ id: "panel", escape: () => { order.push("panel"); return true; } });
  const close = L.push({ id: "find", escape: () => { order.push("find"); return false; }, returnFocus: opener });
  assert.equal(L.escape(), true);
  assert.deepEqual(order, ["find", "panel"]);
  assert.equal(L.top().id, "find");
  close();
  assert.equal(focused, true);
  assert.equal(L.top().id, "panel");
});

await t("semver: ^, ~, x-ranges, comparisons and ||", () => {
  assert.ok(satisfies("1.4.2", "^1"));
  assert.ok(!satisfies("2.0.0", "^1"));
  assert.ok(satisfies("0.3.1", "^0.3"));
  assert.ok(!satisfies("0.4.0", "^0.3"));
  assert.ok(satisfies("1.2.9", "~1.2.0"));
  assert.ok(!satisfies("1.3.0", "~1.2.0"));
  assert.ok(satisfies("1.9.0", "1.x"));
  assert.ok(satisfies("1.0.0", ">=1.0.0 <2"));
  assert.ok(satisfies("3.0.0", "^1 || ^3"));
  assert.ok(!satisfies("1.0.0", ""));
  assert.ok(!satisfies("nope", "^1"));
});

await t("manifests: plain-words problems; a wrong kernel range is refused at register", () => {
  assert.deepEqual(manifestProblems({ id: "xo.files", version: "1.0.0", kernel: "^1" }), []);
  assert.ok(manifestProblems({ id: "files", version: "1", kernel: "" }).length >= 3);
  const K = createKernel({ warn: quiet, log: quiet });
  assert.throws(() => K.register(mod("xo.old", { kernel: "^2" })), /needs kernel \^2/);
  K.register(mod("xo.a", { provides: ["a"] }));
  assert.throws(() => K.register(mod("xo.b", { provides: ["a"] })), /already provides/);
});

await t("modules: activate in dependency order; ctx refuses what the manifest doesn't declare", async () => {
  const K = createKernel({ warn: quiet, log: quiet, request: (fn) => fn() });
  K.places.define({ id: "rail.entry", kind: "list", scope: "app", description: "r" });
  const seen = [];
  K.register(mod("xo.ui", { needs: ["world"], contributes: ["rail.entry:files"] }, (ctx) => {
    seen.push("ui:" + ctx.use("world").name);
    ctx.contribute("rail.entry", { id: "files" });
    assert.throws(() => ctx.contribute("rail.entry", { id: "other" }), /doesn't list it/);
    assert.throws(() => ctx.use("shape"), /not in its manifest's needs/);
    assert.throws(() => ctx.provide("x", {}), /not in its manifest's provides/);
  }));
  K.register(mod("xo.world", { provides: ["world"] }, (ctx) => { seen.push("world"); ctx.provide("world", { name: "W" }); }));
  const r = await K.start();
  assert.deepEqual(seen, ["world", "ui:W"]);
  assert.deepEqual(r.active.sort(), ["xo.ui", "xo.world"]);
  assert.deepEqual(K.places.entries("rail.entry").map((e) => e.id), ["files"]);
});

await t("modules: a failing activate is rolled back and reported; the others still run", async () => {
  const K = createKernel({ warn: quiet, log: quiet });
  K.places.define({ id: "rail.entry", kind: "list", scope: "app", description: "r" });
  K.register(mod("xo.bad", { contributes: ["rail.entry"] }, (ctx) => { ctx.contribute("rail.entry", { id: "half" }); throw new Error("broken"); }));
  K.register(mod("xo.good", {}, () => {}));
  const r = await K.start();
  assert.deepEqual(r.failed, [{ id: "xo.bad", error: "broken" }]);
  assert.deepEqual(r.active, ["xo.good"]);
  assert.equal(K.places.entries("rail.entry").length, 0);
  assert.equal(K.live("xo.bad"), 0);
});

await t("modules: disable undoes everything (live = 0), takes dependents down first, and enable brings them back", async () => {
  const timers = new Set();
  const fakeTimers = {
    setTimeout: (fn) => { const h = { fn }; timers.add(h); return h; }, clearTimeout: (h) => timers.delete(h),
    setInterval: (fn) => { const h = { fn }; timers.add(h); return h; }, clearInterval: (h) => timers.delete(h),
  };
  const K = createKernel({ warn: quiet, log: quiet, timers: fakeTimers, request: (fn) => fn() });
  K.places.define({ id: "panel.page", kind: "keyed", scope: "app", description: "p" });
  const target = new EventTarget();
  let clicks = 0, busHeard = 0, flushed = 0, observerOff = 0;
  K.register(mod("xo.world", { provides: ["world"] }, (ctx) => ctx.provide("world", {})));
  K.register(mod("xo.files", { needs: ["world"], provides: ["files"], contributes: ["panel.page:files"] }, (ctx) => {
    ctx.provide("files", {});
    ctx.contribute("panel.page", { id: "files" });
    ctx.listen(target, "ping", () => clicks++);
    ctx.on("world:file", () => busHeard++);
    ctx.interval(() => {}, 1000);
    ctx.timeout(() => {}, 5000);
    ctx.onFlush("files", () => flushed++);
    ctx.observe({ disconnect: () => observerOff++ });
    ctx.pushLayer({ id: "files-page" });
  }));
  K.register(mod("xo.changes", { needs: ["files"] }, (ctx) => { ctx.on("x", () => {}); }));
  await K.start();
  assert.equal(K.status("xo.changes"), "active");
  assert.ok(K.live("xo.files") >= 9);
  const down = await K.disable("xo.files");
  assert.deepEqual(down, ["xo.changes", "xo.files"]);
  assert.equal(K.live("xo.files"), 0);
  assert.equal(K.live("xo.changes"), 0);
  assert.equal(K.status("xo.changes"), "waiting");
  target.dispatchEvent(new Event("ping")); K.bus.emit("world:file"); K.scheduler.invalidate("files");
  assert.equal(clicks, 0); assert.equal(busHeard, 0); assert.equal(flushed, 0);
  assert.equal(timers.size, 0); assert.equal(observerOff, 1);
  assert.equal(K.places.entries("panel.page").length, 0);
  assert.equal(K.layers.list().length, 0);
  await K.enable("xo.files");
  assert.equal(K.status("xo.files"), "active");
  assert.equal(K.status("xo.changes"), "active");
});

await t("modules: the core can't be disabled; safe mode starts only the core", async () => {
  const K = createKernel({ warn: quiet, log: quiet });
  K.register(mod("xo.shell", { core: true }));
  K.register(mod("xo.map"));
  const r = await K.start({ safe: true });
  assert.deepEqual(r.active, ["xo.shell"]);
  assert.deepEqual(r.disabled, ["xo.map"]);
  await assert.rejects(K.disable("xo.shell"), /part of the core/);
});

await t("modules: a module waiting on a missing service says what it waits for", async () => {
  const K = createKernel({ warn: quiet, log: quiet });
  K.register(mod("xo.map", { needs: ["world", "places"] }));
  const r = await K.start();
  assert.deepEqual(r.waiting, [{ id: "xo.map", missing: ["world", "places"] }]);
});

console.log(`\n${passed} passed`);
