// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createMapDiagram } from "../diagram.js";

const { document } = await dom('<main><svg class="dg-edges"></svg><div class="dg-nodes"></div></main>');
const scope = /** @type {const} */ ({ key: "t:one", kind: "thread" });
const M = { bounds: null, layout: null, layoutKey: "" };
let held = 0;
const host = () => /** @type {HTMLElement} */ (document.querySelector("main"));
const paint = createMapDiagram({ M, host, view: () => null, tagW: () => 22,
  camOf: () => ({ x: 0, y: 0, s: 1, user: false, follow: false, target: null }),
  holdStill() { held++; }, focusNode() {}, cursors() {},
  boxHtml: (node, at) => `<button data-node="${node.id}" class="${at.has(node.id) ? "is-here" : ""}">${node.name}</button>`,
});
const tree = { id: "root", name: "Project", children: [{ id: "readme", name: "README.md" }] };
paint(scope, tree, [], new Map(), new Map());
const node = host().querySelector('[data-node="readme"]');
assert.ok(node);
assert.equal(host().querySelector("path")?.classList.contains("is-lit"), false);
const active = new Map([["readme", "blue"]]);
paint(scope, tree, [], active, active);
assert.ok(host().querySelector('[data-node="readme"]') === node, "painting retains the file button");
assert.equal(node.classList.contains("is-here"), true);
assert.equal(host().querySelector("path")?.classList.contains("is-lit"), true);
assert.equal(held, 1, "a changed drawing preserves the previous camera anchor");
