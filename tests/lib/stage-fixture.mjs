// @ts-check

import { dom } from "./dom.mjs";

/** @typedef {(on: boolean, host?: HTMLElement, view?: string) => void} StageShell */

/** @param {{ reduced?: boolean, phone?: boolean, place?: (view: string) => boolean, threads?: (view: string) => object[], shell?: StageShell | null }} [options] */
export async function stageFixture({ reduced = true, phone = false, place = (view) => view.startsWith("p:"), threads = null, shell = () => {} } = {}) {
  const { document, window } = await dom('<button id="outside">Outside</button><div id="main"></div>');
  const storage = new Map();
  const animations = [];
  const phoneQuery = document.createElement("span");
  Object.defineProperty(phoneQuery, "matches", { get: () => phone });
  Object.assign(globalThis, {
    innerWidth: 1440,
    localStorage: { getItem: (name) => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, value) },
    matchMedia: (query) => query.includes("max-width")
      ? phoneQuery : { matches: query.includes("prefers-reduced-motion") && reduced },
  });
  const { tokenValuesFor } = await import("./css-snapshot.mjs");
  const tokens = tokenValuesFor();
  globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => tokens.get(name) ?? "" });
  window.HTMLElement.prototype.select = () => {};
  window.HTMLElement.prototype.getAnimations = () => [];
  window.HTMLElement.prototype.animate = function (frames, timing) {
    animations.push({ element: this, frames, timing });
    return { finished: Promise.resolve(), cancel() {} };
  };
  const { createKernel } = await import("../../core/kernel/index.js");
  const { definePlaces } = await import("../../shell/places.js");
  const { createStage } = await import("../../shell/panel/panel.js");
  const { places } = createKernel({ warn() {}, log() {} });
  definePlaces({ places });
  const map = { agents: () => [], mode: "graph", setMode(mode) { this.mode = mode; }, show() {}, hide() {} };
  places.contribute("panel.frame", { id: "map", title: "Map", mount() {} }, "test");
  places.contribute("panel.frame", {
    id: "changes", title: "Changes", mount: () => ({ paint: () => false, head: () => null, wide: false }),
  }, "test");
  let view = "p:one", changed = [];
  let shellsOwnKey = false;
  const panel = createStage({
    mapControls: () => map, files: { changes: () => changed }, viewer: {}, view: () => view, place, threads, go() {}, announce() {},
    at: () => ({ view }), places, shell, owns: () => shellsOwnKey,
    openFiles: () => panel.show("files"),
  });
  const stage = document.querySelector("#stage");
  return {
    document, window, panel, stage, storage, animations,
    visit(id) { panel.leave(); view = id; panel.sync(); },
    setPhone(matches) { phone = matches; phoneQuery.dispatchEvent(new window.Event("change")); },
    change(files) { changed = files; panel.sync(); },
    shellKeys(value) { shellsOwnKey = value; },
  };
}
