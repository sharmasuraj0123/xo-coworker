// js/keynav.js: a radio group's and a menu's keys (WAI-ARIA APG), on a few stand-in elements.
// The real DOM, and each control that uses them, are in the browser suite.
//   node tests/keynav.test.mjs
import assert from "node:assert/strict";
import { step, usable, rovingTab, radioKeys, menuKeys, pointerFollows } from "../js/keynav.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

// ── stand-ins: enough of an element for the listeners (roles, closest, a focus, a click) ──
const doc = { activeElement: null };
class El {
  constructor(tag, attrs = {}, kids = [], text = "") {
    this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.parent = null; this.children = [];
    this.textContent = text; this.disabled = !!attrs.disabled; this.gone = !!attrs.gone; this.clicks = 0; this.on = {};
    for (const k of kids) { k.parent = this; this.children.push(k); }
  }
  getAttribute(n) { return n in this.attrs ? String(this.attrs[n]) : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  matches(sel) { return sel.split(",").some((s) => { const m = /^\[role="([^"]+)"\]$/.exec(s.trim()); return !!m && this.attrs.role === m[1]; }); }
  closest(sel) { for (let el = this; el; el = el.parent) if (el.matches(sel)) return el; return null; }
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  querySelectorAll(sel) { return [...this.walk()].filter((e) => e.matches(sel)); }
  contains(o) { for (let el = o; el; el = el.parent) if (el === this) return true; return false; }
  getClientRects() { return this.gone ? [] : [{}]; }
  focus() { doc.activeElement = this; }
  click() { this.clicks++; if (this.attrs.role === "radio") for (const o of this.parent.children) o.attrs["aria-checked"] = String(o === this); }
  addEventListener(type, fn) { (this.on[type] ||= []).push(fn); }
}
const key = (root, target, k, mods = {}) => {
  const e = { key: k, target, ...mods, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  for (const fn of root.on.keydown || []) fn(e);
  return e;
};
const radio = (id, attrs = {}) => new El(attrs.tag || "button", { role: "radio", "aria-checked": "false", ...attrs, id }, [], id);
const group = (...opts) => new El("div", { role: "radiogroup" }, opts);

t("step: wraps both ways, skips what ok() refuses, -1 when nothing will do", () => {
  const ok = (j) => j !== 2;
  assert.equal(step(4, 1, 1, ok), 3);
  assert.equal(step(4, 3, 1, ok), 0);
  assert.equal(step(4, 0, -1, ok), 3);
  assert.equal(step(4, 3, -1, ok), 1);
  assert.equal(step(4, -1, 1, ok), 0, "from before the first: the first");
  assert.equal(step(4, 4, -1, ok), 3, "from after the last: the last");
  assert.equal(step(3, 0, 1, () => false), -1);
});

t("usable: not disabled, not aria-disabled, drawn", () => {
  assert.equal(usable(radio("a")), true);
  assert.equal(usable(radio("b", { disabled: true })), false);
  assert.equal(usable(radio("c", { "aria-disabled": "true" })), false);
  assert.equal(usable(radio("d", { gone: true })), false);
  assert.equal(usable(null), false);
});

t("rovingTab: only the chosen option, or the first when none is, is in the Tab order", () => {
  assert.equal(rovingTab(true), "");
  assert.equal(rovingTab(false, true), "");
  assert.equal(rovingTab(false), ' tabindex="-1"');
});

t("radio: → and ↓ move to the next usable option and choose it; ← and ↑ the previous; both wrap", () => {
  const a = radio("a", { "aria-checked": "true" }), b = radio("b", { disabled: true }), c = radio("c"), d = radio("d");
  const root = new El("div", {}, [group(a, b, c, d)]);
  radioKeys(root);
  let e = key(root, a, "ArrowRight");
  assert.equal(e.prevented, true);
  assert.equal(doc.activeElement, c, "the disabled one is skipped");
  assert.equal(c.clicks, 1); assert.equal(c.getAttribute("aria-checked"), "true");
  key(root, c, "ArrowDown"); assert.equal(doc.activeElement, d);
  key(root, d, "ArrowDown"); assert.equal(doc.activeElement, a, "wraps to the first");
  key(root, a, "ArrowUp"); assert.equal(doc.activeElement, d, "wraps to the last");
  key(root, d, "ArrowLeft"); assert.equal(doc.activeElement, c);
  assert.equal(a.clicks, 1, "each option reached is chosen once");
});

t("radio: follow: false moves focus without choosing; Space or Enter then chooses a non-button option", () => {
  const a = radio("a", { tag: "div", "aria-checked": "true" }), b = radio("b", { tag: "div" });
  const root = new El("div", {}, [group(a, b)]);
  radioKeys(root, { follow: false });
  key(root, a, "ArrowDown");
  assert.equal(doc.activeElement, b); assert.equal(b.clicks, 0); assert.equal(a.getAttribute("aria-checked"), "true");
  const e = key(root, b, " ");
  assert.equal(e.prevented, true); assert.equal(b.clicks, 1);
  key(root, b, "Enter"); assert.equal(b.clicks, 1, "already chosen: not chosen again");
});

t("radio: a <button>'s own Space and Enter are left to the browser; a chosen option isn't clicked again", () => {
  const a = radio("a", { "aria-checked": "true" }), b = radio("b");
  const root = new El("div", {}, [group(a, b)]);
  radioKeys(root);
  assert.equal(key(root, b, " ").prevented, false);
  assert.equal(key(root, b, "Enter").prevented, false);
  assert.equal(b.clicks, 0);
});

t("radio: modifiers, keys outside a group, and a group with nothing else usable do nothing", () => {
  const a = radio("a", { "aria-checked": "true" }), b = radio("b", { disabled: true });
  const root = new El("div", {}, [group(a, b), new El("button", { id: "x" })]);
  radioKeys(root);
  doc.activeElement = a;
  assert.equal(key(root, a, "ArrowDown", { altKey: true }).prevented, false);
  assert.equal(key(root, root.children[1], "ArrowDown").prevented, false);
  key(root, a, "ArrowDown");
  assert.equal(doc.activeElement, a); assert.equal(a.clicks, 0);
});

const item = (text, attrs = {}) => new El("button", { role: "menuitem", ...attrs }, [], text);
const menuOf = (...items) => new El("span", { role: "menu" }, items);

t("menu: ↓ ↑ move and wrap, Home and End go to the ends, skipping disabled and hidden items", () => {
  const ren = item("Rename"), lab = item("Add a label"), off = item("Remove", { disabled: true }), sh = item("Open a shell"), gone = item("Gone", { gone: true });
  const root = new El("div", {}, [menuOf(ren, lab, off, sh, gone)]);
  menuKeys(root);
  const e = key(root, ren, "ArrowDown");
  assert.equal(e.prevented, true); assert.equal(doc.activeElement, lab);
  key(root, lab, "ArrowDown"); assert.equal(doc.activeElement, sh, "the disabled item is skipped");
  key(root, sh, "ArrowDown"); assert.equal(doc.activeElement, ren, "past the last usable: the first");
  key(root, ren, "ArrowUp"); assert.equal(doc.activeElement, sh, "before the first: the last usable");
  key(root, sh, "Home"); assert.equal(doc.activeElement, ren);
  key(root, ren, "End"); assert.equal(doc.activeElement, sh);
});

t("menu: a letter goes to the next item starting with it; a letter nothing starts with is left alone", () => {
  const a = item("Rename"), b = item("Add a label"), c = item("Remove the label");
  const root = new El("div", {}, [menuOf(a, b, c)]);
  menuKeys(root);
  key(root, a, "r"); assert.equal(doc.activeElement, c);
  key(root, c, "R"); assert.equal(doc.activeElement, a, "wraps");
  const e = key(root, a, "z");
  assert.equal(e.prevented, false); assert.equal(doc.activeElement, a);
});

t("menu: Escape and Tab call close(menu, key); Escape stops there, Tab goes on; without close they pass", () => {
  const a = item("Rename"), m = menuOf(a);
  const root = new El("div", {}, [m]);
  const closed = [];
  menuKeys(root, { close: (menu, k) => closed.push([menu, k]) });
  const esc = key(root, a, "Escape");
  assert.deepEqual(closed, [[m, "Escape"]]); assert.equal(esc.prevented, true); assert.equal(esc.stopped, true);
  const tab = key(root, a, "Tab");
  assert.deepEqual(closed[1], [m, "Tab"]); assert.equal(tab.prevented, false, "Tab moves on from the menu's button");
  const bare = new El("div", {}, [menuOf(item("x"))]);
  menuKeys(bare);
  const e = key(bare, bare.children[0].children[0], "Escape");
  assert.equal(e.prevented, false); assert.equal(e.stopped, false);
});

// ── the pointer and the keyboard: one active item (Astra C058 on 517af1c: hover painted a second item like the
// keyboard's, and Enter chose the one not pointed at) ──
globalThis.document = doc;
const move = (root, target, pointerType = "mouse") => { for (const fn of root.on.pointermove || []) fn({ target, pointerType }); };
t("pointerFollows: a mouse moving onto a menu's item, while focus is in that menu, focuses it (Enter and the arrows go on from there)", () => {
  assert.equal(typeof pointerFollows, "function", "keynav.js has pointerFollows");
  const a = new El("button", { role: "menuitem" }, [], "Copy"), b = new El("button", { role: "menuitem" }, [], "Download"), c = new El("button", { role: "menuitem", "aria-disabled": "true" }, [], "Gone");
  const menu = new El("div", { role: "menu" }, [a, b, c]), root = new El("div", {}, [menu]);
  pointerFollows(root);
  a.focus();
  move(root, b);
  assert.equal(doc.activeElement, b, "the pointed-at item is the active one");
  move(root, c);
  assert.equal(doc.activeElement, b, "not an item that can't be chosen");
  move(root, a, "touch");
  assert.equal(doc.activeElement, b, "a touch moving doesn't move focus");
  const out = new El("input", {}); doc.activeElement = out;
  move(root, a);
  assert.equal(doc.activeElement, out, "focus elsewhere (not in the menu) stays where it is");
  // a menu opened with the mouse keeps focus on its button: the item under the pointer takes it
  const opener = new El("button", { "aria-haspopup": "menu", "aria-expanded": "true" }); doc.activeElement = opener;
  move(root, a);
  assert.equal(doc.activeElement, a, "from the menu's open button, the pointed-at item takes focus");
});
t("menuKeys brings pointerFollows with it: every menu that walks with the keys follows the pointer", () => {
  const a = new El("button", { role: "menuitem" }, [], "One"), b = new El("button", { role: "menuitem" }, [], "Two");
  const menu = new El("div", { role: "menu" }, [a, b]), root = new El("div", {}, [menu]);
  menuKeys(root);
  a.focus();
  move(root, b);
  assert.equal(doc.activeElement, b, "the pointer made Two the active item");
  key(root, b, "ArrowDown");
  assert.equal(doc.activeElement, a, "the arrows carry on from the pointed-at item (wrapping)");
});

console.log(`${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
