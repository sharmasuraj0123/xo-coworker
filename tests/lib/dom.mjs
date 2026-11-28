// @ts-check

import { existsSync } from "node:fs";

const LINKEDOM = new URL("../../node_modules/linkedom/esm/index.js", import.meta.url);
/** @type {WeakMap<Document, Element>} */
const activeElements = new WeakMap();

/** @param {string} markup @param {{wholeDocument?: boolean}} [options] */
export async function dom(markup, { wholeDocument = false } = {}) {
  if (!existsSync(LINKEDOM)) throw new Error("linkedom is not installed: run npm ci (dev-only tools, see AGENTS.md)");
  const { parseHTML } = /** @type {typeof import("linkedom")} */ (await import(LINKEDOM.href));
  const pageMarkup = wholeDocument ? markup : `<!doctype html><html><body>${markup}</body></html>`;
  const { window, document } = parseHTML(pageMarkup);
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    get() {
      const active = activeElements.get(document);
      return active?.isConnected ? active : document.body;
    },
  });
  /** @param {Element} element @param {string} type @param {boolean} bubbles @param {Element | null} relatedTarget */
  const fire = (element, type, bubbles, relatedTarget) => {
    const Event = element.ownerDocument.defaultView?.Event ?? window.Event;
    element.dispatchEvent(Object.assign(new Event(type, { bubbles }), { relatedTarget }));
  };
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(document.createElement("button")));
  // focus is each document's own: a node of an earlier page never takes this page's focus
  proto.focus = function () {
    const doc = this.ownerDocument, was = activeElements.get(doc) ?? null;
    if (was === this) return;
    if (was && was.isConnected) { fire(was, "blur", false, this); fire(was, "focusout", true, this); }
    activeElements.set(doc, this);
    fire(this, "focus", false, was); fire(this, "focusin", true, was);
  };
  proto.blur = function () {
    const doc = this.ownerDocument;
    if (activeElements.get(doc) !== this) return;
    activeElements.delete(doc);
    fire(this, "blur", false, null);
    fire(this, "focusout", true, null);
  };
  proto.scrollIntoView = function () {};
  const tplProto = Object.getPrototypeOf(document.createElement("template"));
  Object.defineProperty(tplProto, "innerHTML", { configurable: true, get() { const box = this.ownerDocument.createElement("div"); box.append(...[...this.content.childNodes].map((n) => n.cloneNode(true))); return box.innerHTML; }, set(html) { this.content.replaceChildren(); const box = this.ownerDocument.createElement("div"); box.innerHTML = html; this.content.append(...box.childNodes); } });
  proto.getClientRects = function () { return this.isConnected && !this.closest("[hidden]") ? [{}] : []; };
  window.getComputedStyle = window.getComputedStyle || (() => new Proxy({}, { get: (_, k) => (k === "getPropertyValue" ? () => "" : "") }));
  const g = globalThis;
  Object.assign(g, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node, Event: window.Event, CustomEvent: window.CustomEvent });
  g.CSS = g.CSS || { escape: (/** @type {string} */ s) => String(s).replace(/["\\]/g, "\\$&") };
  g.matchMedia = g.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  g.requestAnimationFrame = g.requestAnimationFrame || ((/** @type {() => void} */ f) => setTimeout(f, 0));
  /** @type {Window['addEventListener']} */
  const listen = (type, listener, options) => window.addEventListener(type, listener, options);
  g.addEventListener ||= listen;
  return { window, document };
}

/** Let promises and zero-delay timers settle. */
export const settle = () => new Promise((r) => setTimeout(r, 0)).then(() => new Promise((r) => setTimeout(r, 0)));

/** A promise you resolve or reject from outside: a request the test answers when it chooses. */
export function deferred() {
  return Promise.withResolvers();
}

/** @param {unknown} a @param {unknown} b @param {string} [msg] */
export function same(a, b, msg = "not the same node") {
  /** @param {unknown} node */
  const name = (node) => {
    if (!node || typeof node !== "object" || !("nodeName" in node)) return String(node);
    if (!("tagName" in node)) return String(node.nodeName);
    const element = /** @type {Element} */ (node);
    const id = element.id ? `#${element.id}` : "";
    const panel = element.getAttribute("data-cp");
    const path = panel ? ` data-cp=${panel}` : "";
    return `<${element.tagName.toLowerCase()}${id}${path}>${element.textContent?.slice(0, 40) ?? ""}`;
  };
  if (a !== b) throw new Error(`${msg}: ${name(a)} where ${name(b)} was expected`);
}
