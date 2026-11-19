// @ts-check

// A DOM for behaviour tests in node: linkedom, with the focus model it lacks (activeElement, focus, blur, focusin/focusout) and a template that parses again on every innerHTML.
import { existsSync } from "node:fs";

const LINKEDOM = new URL("../../node_modules/linkedom/esm/index.js", import.meta.url);

/** @param {string} body @returns {Promise<{ window: any, document: any }>} */
export async function dom(body) {
  if (!existsSync(LINKEDOM)) throw new Error("linkedom is not installed: run npm ci (dev-only tools, see AGENTS.md)");
  const { parseHTML } = await import(LINKEDOM.href);
  const { window, document } = parseHTML(`<!doctype html><html><body>${body}</body></html>`);
  /** @type {any} */
  let active = null;
  Object.defineProperty(document, "activeElement", { configurable: true, get: () => (active && active.isConnected ? active : document.body) });
  const fire = (/** @type {any} */ el, /** @type {string} */ type, /** @type {boolean} */ bubbles, /** @type {any} */ related) => { const e = new window.Event(type, { bubbles }); e.relatedTarget = related; el.dispatchEvent(e); };
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(document.createElement("button")));
  proto.focus = function () {
    if (active === this) return;
    const was = active;
    if (was && was.isConnected) { fire(was, "blur", false, this); fire(was, "focusout", true, this); }
    active = this;
    fire(this, "focus", false, was); fire(this, "focusin", true, was);
  };
  proto.blur = function () { if (active !== this) return; active = null; fire(this, "blur", false, null); fire(this, "focusout", true, null); };
  proto.scrollIntoView = function () {};
  const tplProto = Object.getPrototypeOf(document.createElement("template"));
  Object.defineProperty(tplProto, "innerHTML", { configurable: true, get() { return [...this.content.childNodes].map((n) => n.outerHTML ?? n.textContent).join(""); }, set(html) { this.content.replaceChildren(); const box = document.createElement("div"); box.innerHTML = html; this.content.append(...box.childNodes); } });
  proto.getClientRects = function () { return this.isConnected && !this.closest("[hidden]") ? [{}] : []; };
  window.getComputedStyle = window.getComputedStyle || (() => new Proxy({}, { get: (_, k) => (k === "getPropertyValue" ? () => "" : "") }));
  const g = /** @type {any} */ (globalThis);
  Object.assign(g, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node, Event: window.Event, CustomEvent: window.CustomEvent });
  g.CSS = g.CSS || { escape: (/** @type {string} */ s) => String(s).replace(/["\\]/g, "\\$&") };
  g.matchMedia = g.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  g.requestAnimationFrame = g.requestAnimationFrame || ((/** @type {() => void} */ f) => setTimeout(f, 0));
  g.addEventListener = g.addEventListener || ((/** @type {string} */ t, /** @type {any} */ f, /** @type {any} */ o) => window.addEventListener(t, f, o));
  return { window, document };
}

/** Let promises and zero-delay timers settle. */
export const settle = () => new Promise((r) => setTimeout(r, 0)).then(() => new Promise((r) => setTimeout(r, 0)));

/** A promise you resolve or reject from outside: a request the test answers when it chooses. */
export function deferred() {
  /** @type {(v?: any) => void} */
  let resolve = () => {};
  /** @type {(e?: any) => void} */
  let reject = () => {};
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
