// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";

const { document, window } = await dom(`<ul id="list"><li data-row="a">A</li><li data-row="b">B</li><li data-row="c">C</li></ul>`);
Object.assign(globalThis, { matchMedia: () => ({ matches: false }), Element: window.Element });
/** @type {{ onfinish: null | (() => void), oncancel: null | (() => void) }[]} */
const played = [];
Object.assign(window.Element.prototype, { animate() { const a = { onfinish: null, oncancel: null }; played.push(a); return a; } });
const { drawLeaving } = await import("../motion.js");
const { redraw } = await import("../redraw.js");

test("a row the draw removed stays in its place, inert, until it has folded away", () => {
  const list = /** @type {HTMLElement} */ (document.getElementById("list"));
  drawLeaving(list, "[data-row]", () => redraw(list, `<li data-row="a">A</li><li data-row="c">C</li>`), true);
  const rows = [...list.children].map((li) => `${li.getAttribute("data-row")}${li.hasAttribute("inert") ? " leaving" : ""}`);
  assert.deepEqual(rows, ["a", "b leaving", "c"]);
  redraw(list, `<li data-row="a">A2</li><li data-row="c">C</li>`);
  assert.equal(list.children.length, 3, "a redraw while it leaves leaves it be");
  played.at(-1)?.onfinish?.();
  assert.deepEqual([...list.children].map((li) => li.getAttribute("data-row")), ["a", "c"]);
});
