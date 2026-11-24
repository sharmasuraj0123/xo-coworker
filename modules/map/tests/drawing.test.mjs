// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createMapDrawing } from "../drawing.js";

const { document, window } = await dom('<main><svg class="dg-edges"></svg><div class="dg-nodes"></div></main>');
const host = /** @type {HTMLElement} */ (document.querySelector("main"));

const scope = /** @type {const} */ ({ kind: "all", key: "all" });

/** @type {import("../drawing-types").DrawingDeps["M"]} */
const M = {
  scope, refs: new Map(), curs: new Map(), layoutKey: "", gkey: "", gnodes: [], gedges: [], gags: [],
  glit: new Map(), alpha: 0, raf: 0, open: false, mode: "graph", bounds: null,
  gpos: new Map([[scope.key, new Map([
    ["root", { x: 0, y: 0, vx: 0, vy: 0 }],
    ["file", { x: 30, y: 40, vx: 0, vy: 0 }],
  ])]]),
};

/** @type {Set<Element>} */
const measured = new Set();
Object.defineProperties(window.HTMLElement.prototype, {
  offsetWidth: {
    get() {
      for (const node of host.querySelectorAll(".dg-nodes > .gn")) {
        assert.ok(!/** @type {HTMLElement} */ (node).style.transform, "measure graph bounds before writing transforms");
      }
      measured.add(this);
      return 12;
    },
  },
  offsetHeight: { get: () => 10 },
});
Object.assign(globalThis, { getComputedStyle: () => ({ marginLeft: "-6px", marginTop: "-5px" }) });
const { paintGraph } = createMapDrawing({
  M, host: () => host, verbOf: () => "", tagW: () => 0, focusNode() {}, frame() {},
  camOf: () => ({ x: 0, y: 0, s: 1, user: false, follow: false, target: null }),
  clamp: (value, low, high) => Math.max(low, Math.min(value, high)),
});
paintGraph(scope, [
  { id: "root", kind: "root", name: "Project", parent: null },
  { id: "file", kind: "file", name: "README.md", parent: "root" },
], [], new Map());

const nodes = Array.from(/** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll(".dg-nodes > .gn")));
assert.equal(measured.size, 2);
assert.deepEqual(nodes.map((node) => node.style.transform), ["translate(0px,0px)", "translate(30px,40px)"]);
assert.deepEqual(M.bounds, { x0: -18, y0: -17, x1: 48, y1: 57 });
