// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { STONE, FLAVOURS } from "../core/ui/flavours.js";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom(readFileSync(new URL("../index.html", import.meta.url), "utf8"));
const storage = new Map([["cv-theme", "light"], ["cv-flavour", "onyx"]]);
/** @type {FrameRequestCallback[]} */
const frames = [];
const matches = window.Element.prototype.matches;
window.HTMLElement.prototype.scrollTo = function () {};
window.Element.prototype.matches = function (/** @type {string} */ selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  return matches.call(this, selector);
};
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  history: { replaceState() {}, pushState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: {
    getItem: (/** @type {string} */ key) => storage.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => storage.set(key, value),
  },
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  customElements: window.customElements,
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ fn) => frames.push(fn),
  setInterval: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setInterval(fn, ms).unref(),
  setTimeout: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setTimeout(fn, ms).unref(),
  fetch: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
  EventSource: class { addEventListener() {} close() {} },
});

await import("../boot.js");
await new Promise((resolve) => setImmediate(resolve));
for (const frame of frames.splice(0)) frame(performance.now());

assert.ok(document.querySelector("#brand-mark svg"), "boot installs the visible brand icon");
assert.equal(document.querySelector("#home").hidden, false, "boot starts on Home");
assert.equal(document.documentElement.dataset.theme, "light", "boot restores the stored mode");
assert.equal(document.documentElement.dataset.flavour, "onyx", "boot restores the stored flavour");

const press = (/** @type {string} */ selector) => {
  const button = document.querySelector(selector);
  assert.ok(button, selector);
  button.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
};
press("#nv-ws");
assert.equal(document.querySelector("#nv-ws").getAttribute("aria-current"), "page", "Workspace replaces Home");
press("#nv-home");
assert.equal(document.querySelector("#nv-home").getAttribute("aria-current"), "page", "Home navigation restores Home");

press("#set-side");
assert.equal(document.querySelector("#settings").hidden, false, "sidebar opens Settings");
press('#settings [data-set="appearance"]');
assert.equal(document.querySelector('#settings [data-page="appearance"]').hidden, false, "Appearance is the visible Settings page");
assert.deepEqual([...document.querySelectorAll('#mode-seg [role="radio"]')].map((b) => [b.dataset.mode, b.textContent]), [["dark", "Dark"], ["light", "Light"], ["system", "System"]]);
assert.deepEqual([...document.querySelectorAll('#flavour-seg [role="radio"]')].map((b) => [b.dataset.flavour, b.textContent]), [STONE, ...FLAVOURS].map(({ id, name }) => [id, name]));
press('#mode-seg [data-mode="dark"]');
assert.equal(document.documentElement.dataset.theme, "dark", "choosing Dark applies it immediately");
assert.equal(storage.get("cv-theme"), "dark", "choosing Dark persists it");
assert.equal(document.querySelector('#mode-seg [data-mode="dark"]').getAttribute("aria-checked"), "true");
press('#flavour-seg [data-flavour="stone"]');
assert.equal(document.documentElement.dataset.flavour, undefined, "Stone removes the flavour override");
assert.equal(storage.get("cv-flavour"), "stone", "choosing Stone persists it");
