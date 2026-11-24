// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createScope } from "../../../core/kernel/scope.js";

const { document, window } = await dom('<div id="map-host"></div>');
const host = document.getElementById("map-host");
const frames = [];
const reads = [];
let resizeObservers = 0;
Object.assign(globalThis, {
  removeEventListener: (...args) => window.removeEventListener(...args),
  localStorage: { getItem: () => "tree" },
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (fn) => frames.push(fn),
  cancelAnimationFrame() {},
  ResizeObserver: class {
    observe() { resizeObservers++; }
    disconnect() { resizeObservers--; }
  },
  fetch: async (input, options) => {
    assert.match(String(input), /\/xo-projects\/demo\/tree/);
    const { promise, resolve } = Promise.withResolvers();
    reads.push({ resolve, signal: options.signal });
    return promise;
  },
});
Object.defineProperty(globalThis, "performance", { value: { now: () => Date.now() } });
const { createMap } = await import("../map.js");
const world = {
  state: { projects: [{ id: "demo", name: "Demo" }], threads: [], turns: null },
  act: {},
  project: () => ({ name: "Demo" }),
};
const map = createMap({ world, go() {}, announce() {}, isBusy: () => false, openFile() {}, stepLineHtml: () => "" });

async function mount() {
  const scope = createScope();
  map.mount(host, scope);
  for (const work of frames.splice(0)) work(performance.now());
  mock.timers.tick(120);
  await new Promise(setImmediate);
  return scope;
}

mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1 });
try {
  map.render("p:demo");
  const firstScope = await mount();
  assert.equal(reads.length, 1);
  assert.equal(resizeObservers, 1);
  map.unmount();
  assert.equal(firstScope.size, 0);
  assert.equal(reads[0].signal.aborted, true);
  assert.equal(resizeObservers, 0);

  await mount();
  assert.equal(reads.length, 2, "remounting the same host reads its folders again");
  assert.equal(resizeObservers, 1);
  reads[1].resolve(Response.json({ files: [{ name: "current.js" }], dirs: [] }));
  await new Promise(setImmediate);
  assert.match(host.textContent, /current\.js/);
  reads[0].resolve(Response.json({ files: [{ name: "stale.js" }], dirs: [] }));
  await new Promise(setImmediate);
  assert.doesNotMatch(host.textContent, /stale\.js/);
} finally {
  map.unmount();
  mock.timers.reset();
}
