// The page's bars: the format bar follows the selection, and menus open and close in place.
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML("<!doctype html><html><body></body></html>");
class MouseEvent extends window.Event { constructor(type, init = {}) { super(type, init); this.detail = init.detail ?? 0; } }
Object.assign(globalThis, { document, MouseEvent, Element: window.Element, Node: window.Node });
const CM = await import("../../../vendor/codemirror/cm.js");
const { formatBar } = await import("../markdown-format-bar.js");
const { ToolStrip } = await import("../markdown-tools.js");
const { EditorState, showTooltip } = CM;

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

/** @param {object} selection @param {boolean} readOnly @param {((state: EditorState) => void) | null} ask */
function tips(selection, readOnly, ask) {
  const state = EditorState.create({ doc: "Some words here", selection, extensions: [formatBar(CM, ask), EditorState.readOnly.of(readOnly)] });
  return state.facet(showTooltip).filter(Boolean);
}

t("the format bar shows over a selection, above its start, and not over a caret", () => {
  const shown = tips({ anchor: 5, head: 10 }, false, null);
  assert.equal(shown.length, 1);
  assert.deepEqual([shown[0].pos, shown[0].above], [5, true]);
  assert.equal(tips({ anchor: 3 }, false, null).length, 0);
});

t("a read-only page shows the bar only when it can ask about the selection", () => {
  assert.equal(tips({ anchor: 0, head: 4 }, true, null).length, 0);
  assert.equal(tips({ anchor: 0, head: 4 }, true, () => {}).length, 1);
});

t("a menu opens under its button, the same button closes it, and a pick closes it before it runs", () => {
  const ran = [];
  const view = { focus() { ran.push("focus"); } };
  const strip = new ToolStrip(view, "cm-md-test", "Test", (id, button, event) => {
    strip.toggle(button, { items: [{ id: "a", label: "A" }, { id: "b", label: "B", checked: true }], pick: (item) => ran.push(item) }, event);
  });
  document.body.appendChild(strip.dom);
  const button = strip.button({ id: "open", label: "Open", text: "Open", menu: true });
  const click = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  click(button);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  const menu = strip.dom.querySelector('[role="menu"]');
  assert.ok(menu && menu.parentElement === button.parentElement, "the menu sits beside its button");
  assert.deepEqual([...menu.querySelectorAll("[data-item]")].map((b) => [b.getAttribute("role"), b.getAttribute("aria-checked")]),
    [["menuitem", null], ["menuitemradio", "true"]]);
  click(button);
  assert.equal(strip.dom.querySelector('[role="menu"]'), null, "the same button closes it");
  click(button);
  click(strip.dom.querySelector('[data-item="b"]'));
  assert.deepEqual([ran, strip.dom.querySelector('[role="menu"]'), button.getAttribute("aria-expanded")], [["b"], null, "false"]);
  strip.destroy();
  assert.equal(strip.scope.size, 0, "nothing left listening");
});

console.log(`${passed} passed`);
