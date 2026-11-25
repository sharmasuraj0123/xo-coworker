// A Settings › Shape page on a DOM with a shape store whose answers the test sets; shared by the Shape page's tests.
import { createScope } from "../../../core/kernel/scope.js";
import { dom, settle } from "../../../tests/lib/dom.mjs";

export const RAIL = ["general", "shape", "routing", "rules"];
const PAGE = `<section id="settings"><nav class="set-nav">${RAIL.map((id) => `<button type="button" data-set="${id}">${id}</button>`).join("")}</nav><div data-page="shape"><div class="shp"></div></div></section>`;

/** own: a change of your own on top of the preset, so Reset to preset has something to reset. @param {{ advanced?: string[], own?: boolean }} [o] */
export async function shapePage({ advanced = [], own = false } = {}) {
  await dom(PAGE);
  const { createShape } = await import("../../../core/services/shape/index.js");
  const { createShapeView, UNKEPT } = await import("../shape-page.js");
  const heldSubs = new Set();
  const said = [];
  const shape = {
    held: null, mine: { shape: 1 }, device: {}, presetId: null, problems: [], shape: createShape(own ? [{ from: "mine", doc: { shape: 1, words: { thread: "task" } } }] : []),
    next: { kept: true }, density: "comfortable", sent: [],
    get: (k) => (k === "density" ? shape.density : null),
    list: (k) => (k === "settings" ? advanced.map((id) => ({ id: `xo:settings/${id}`, advanced: true })) : []),
    presetFile: () => null, presetShape: () => createShape([]), presetError: () => null, loadPreset: async () => null,
    ownKeys: () => [],
    onHeld: (f) => { heldSubs.add(f); return () => heldSubs.delete(f); },
    resetToPreset: () => { shape.sent.push("reset"); return shape.next; },
    showEverything: () => { shape.sent.push("all"); return shape.next; },
    setDevice: (d) => { shape.density = d.density; return shape.next; },
    setMine: async (doc) => { shape.sent.push("mine"); shape.mine = doc; return shape.next; },
    choose: async (id) => { shape.sent.push(`choose:${id}`); shape.presetId = id; return shape.next; },
  };
  /** XO's answer to a sent change arrives: refused, or not reachable. */
  const hold = (held) => { shape.held = held; for (const f of heldSubs) f(); };
  const view = createShapeView({ shape, announce: (s) => said.push(s) });
  const scope = createScope();
  const page = view.mount(scope);
  view.apply();
  await page.open();
  const box = () => document.querySelector('[data-page="shape"] .shp');
  const press = async (sel) => { const b = box().querySelector(sel); if (!b) throw new Error(`no ${sel}`); b.dispatchEvent(new Event("click", { bubbles: true })); await settle(); };
  /** The section a node sits in, by its heading id, or "top" before the first section, or "json". */
  const where = (el) => (!el ? null : el.closest("[data-shp-held-json], .shp-json") ? "json" : el.closest("section")?.getAttribute("aria-labelledby") || "top");
  return { shape, view, page, scope, hold, said, box, press, where, UNKEPT, nav: () => document.querySelector("#settings .set-nav") };
}
