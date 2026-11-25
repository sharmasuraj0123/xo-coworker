import { createKernel } from "../../core/kernel/index.js";
import { definePlaces } from "../../shell/places.js";
import { createStage } from "../../shell/panel/panel.js";
import { dom } from "./dom.mjs";

export async function threadStage(threads, changes = () => []) {
  const { document, window } = await dom('<div id="main"></div>');
  globalThis.innerWidth = 1440;
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  window.HTMLElement.prototype.getAnimations = () => [];
  window.HTMLInputElement.prototype.select = () => {};
  const { places } = createKernel({ warn() {}, log() {} });
  definePlaces({ places });
  const map = { mode: "graph", setMode() {}, show() {}, hide() {} };
  places.contribute("panel.frame", { id: "map", title: "Map", mount() {} }, "test");
  places.contribute("panel.frame", { id: "changes", title: "Changes", mount: () => ({ paint: () => false, head: () => null }) }, "test");
  const view = () => "p:p", destinations = [];
  const panel = createStage({ mapControls: () => map, files: { changes }, viewer: {}, view, threads, go: (id) => destinations.push(id),
    announce() {}, at: () => ({ view: view() }), places });
  panel.names = () => "Project";
  panel.open();
  const stage = document.getElementById("stage");
  const press = (target, key) => {
    const event = new window.Event("keydown", { bubbles: true, cancelable: true });
    event.key = key;
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { document, window, stage, panel, destinations, press };
}
