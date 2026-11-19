// node tests/map-panel-only.test.mjs: the Map lives only in the right panel (no #map, no cv-map key, no body classes); needs linkedom.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { sourceText } from "./lib/sources.mjs";
import { homedir } from "node:os";
import { join } from "node:path";

const LD = process.env.LINKEDOM || [join(homedir(), ".cache/xo-test-deps/node_modules/linkedom/esm/index.js"), "/tmp/dom/node_modules/linkedom/esm/index.js"].find((f) => existsSync(f));
let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

if (!LD) {
  console.log("  skip: linkedom isn't installed (npm i linkedom in ~/.cache/xo-test-deps, or set LINKEDOM)");
} else {
  const { parseHTML } = await import(LD);
  const { window, document } = parseHTML(`<!doctype html><html><body><aside class="map" id="map" hidden></aside><div id="panel"></div></body></html>`);
  const keys = [];
  Object.assign(globalThis, {
    window, document, HTMLElement: window.HTMLElement, Event: window.Event,
    requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    localStorage: { getItem: (k) => { keys.push(k); return k === "cv-map" ? "1" : null; }, setItem: (k) => keys.push(k) },
  });
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const { createMap } = await import("../js/map.js");
  const world = { state: { threads: [], projects: [], turns: null }, thread: () => null, project: () => null };
  const viewer = { isOpen: false, hasFile: false, park() { throw new Error("the Map parked the viewer"); }, open() {}, close() {}, refresh() {} };
  const MAP = createMap({ world, viewer, go() {}, announce() {}, isBusy: () => false, onChange() {}, openFile() {} });

  await t("its API is the panel's: mount, show, hide, render and the words the panel reads", () => {
    for (const k of ["isOpen", "toggle", "open", "close", "button", "tabs", "liveIn"]) assert.ok(!(k in MAP), `no standalone ${k}`);
    for (const k of ["mount", "show", "hide", "render", "agents", "mode", "setMode"]) assert.ok(k in MAP, `the panel's ${k}`);
  });
  await t("a render before the panel mounts it draws nowhere and opens nothing", () => {
    MAP.render("home");
    const own = document.getElementById("map");
    assert.equal(own.hidden, true);
    assert.equal(own.innerHTML, "");
    assert.ok(!document.body.classList.contains("map-open") && !document.body.classList.contains("map-full"));
  });
  await t("it never reads or writes the standalone cv-map key", () => {
    const host = document.getElementById("panel");
    host.getClientRects = () => [];
    MAP.mount(host);
    MAP.render("home");
    assert.ok(!keys.includes("cv-map"), `keys touched: ${keys.join(", ")}`);
  });
}
await t("no stylesheet keeps the standalone Map's toggle or its file tab's close", () => {
  const css = sourceText(".css");
  assert.doesNotMatch(css, /\.map-btn\b|\.st-x\b/);
});
console.log(`\n${passed} passed`);
