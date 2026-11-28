import { createMapAgents } from "../modules/map/agents.js";
// node tests/map-panel-only.test.mjs: the Map lives only in the right panel (no #map, no cv-map key, no body classes).
import assert from "node:assert/strict";
import { sourcePaths, readSource, sourceText } from "./lib/sources.mjs";
import { dom } from "./lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

const GONE = /(map-open|map-full|\.map-btn|\.mp-hic|\.mp-x\b|\.mp-full|\.stage-tabs|\.st-tab|\.st-file|\.st-x\b|data-mp-close|data-mp-full|data-map-toggle)/;
await t("no sheet styles the standalone Map, nor names its leftover #map at all", () => {
  for (const f of sourcePaths(".css")) {
    const css = readSource(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      assert.doesNotMatch(m[1], GONE, `${f}: ${m[1].trim()}`);
      assert.doesNotMatch(m[1], /(\.map|#map)(?![\w-])/, `${f}: ${m[1].trim()}`);
    }
  }
});

{
  const { document } = await dom(`<aside class="map" id="map" hidden></aside><div id="panel"></div>`);
  const keys = [];
  let savedMode = null;
  Object.assign(globalThis, {
    cancelAnimationFrame: () => {},
    localStorage: { getItem: (k) => { keys.push(k); return k === "cv-map-mode" ? savedMode : k === "cv-map" ? "1" : null; }, setItem: (k) => keys.push(k) },
  });
  globalThis.removeEventListener ??= () => {};
  const { createMap } = await import("../modules/map/map.js");
  const { stepLineHtml } = await import("../core/ui/markdown/inline.js");
  const world = { state: { threads: [], projects: [], turns: null }, thread: () => null, project: () => null };
  const options = { world, go() {}, announce() {}, isBusy: () => false, openFile() {}, activity: createMapAgents({ world, isBusy: () => false, stepLineHtml }) };
  const MAP = createMap(options);

  await t("Graph is the default, and a saved Diagram is restored", () => {
    assert.equal(MAP.mode, "graph");
    savedMode = "tree";
    assert.equal(createMap(options).mode, "tree");
  });

  await t("its API is the panel's: mount, show, hide, render and the words the panel reads", () => {
    for (const k of ["isOpen", "toggle", "open", "close", "button", "tabs", "liveIn"]) assert.ok(!(k in MAP), `no standalone ${k}`);
    for (const k of ["mount", "show", "hide", "render", "mode", "setMode"]) assert.ok(k in MAP, `the panel's ${k}`);
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
    MAP.mount(host);
    MAP.render("home");
    assert.ok(!keys.includes("cv-map"), `keys touched: ${keys.join(", ")}`);
  });
}
await t("index.html holds no #map of its own", () => {
  assert.doesNotMatch(readSource("index.html"), /id="map"|class="map"/);
});
await t("no stylesheet keeps the standalone Map's toggle or its file tab's close", () => {
  const css = sourceText(".css");
  assert.doesNotMatch(css, /\.map-btn\b|\.st-x\b/);
});
console.log(`\n${passed} passed`);
