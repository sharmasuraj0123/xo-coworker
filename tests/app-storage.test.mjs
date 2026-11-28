// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { dom } from "./lib/dom.mjs";

const { window, document } = await dom(readFileSync(new URL("../index.html", import.meta.url), "utf8"));
let refusals = 0;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get() {
    refusals++;
    throw new DOMException("storage getter denied", "SecurityError");
  },
});
const visits = [];
const stream = new ReadableStream({ start(controller) {
  controller.enqueue(new TextEncoder().encode("event: heartbeat\ndata: {}\n\n"));
} });
const matches = window.Element.prototype.matches;
window.Element.prototype.matches = function (selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  if (selector === ":focus-visible") return this === document.activeElement;
  return matches.call(this, selector);
};
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLElement.prototype.getAnimations = function () { return []; };
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  innerHeight: 900,
  history: { state: null, replaceState() {}, pushState() {} },
  getComputedStyle: window.getComputedStyle,
  cancelAnimationFrame: clearTimeout,
  customElements: window.customElements,
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  EventSource: class { addEventListener() {} close() {} },
  setInterval: (fn, ms) => setInterval(fn, ms).unref(),
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  fetch: async (input, init) => {
    const { pathname } = new URL(String(input), location.href);
    if (pathname === "/api/chat/stream") return new Response(stream);
    if (pathname === "/api/chat/chats") return Response.json({ chats: [
      { id: "workspace-chat", kind: "workspace" },
      { id: "storage-chat", kind: "project", project: "storage-test", seen: null },
    ] });
    if (pathname === "/api/chat/chats/storage-chat/seen") visits.push(init?.method);
    return Response.json({});
  },
});

await import("../boot.js");
for (let i = 0; i < 20 && !document.querySelector('#projects [data-go="p:storage-test"]'); i++) {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
assert.ok(refusals > 0, "boot encounters storage acquisition failures");
assert.equal(document.documentElement.dataset.theme, "dark", "the theme follows the default system preference");
assert.equal(document.querySelector("#home").hidden, false, "Home renders without a stored visit");
assert.equal(document.querySelector(".sl-home"), null, "there is no catch-up prompt on a first visit");

const project = document.querySelector('#projects [data-go="p:storage-test"]');
assert.ok(project, "the real boot draws projects when storage is unavailable");
const beforeVisit = refusals;
project.click();
await new Promise(setImmediate);
assert.equal(document.querySelector("#app").dataset.conv, "p:storage-test");
assert.equal(document.querySelector("#since").hidden, true, "a first project visit does not display stale activity");
assert.ok(refusals > beforeVisit, "navigation continues when Since cannot acquire storage to save the visit");
assert.deepEqual(visits, ["PUT"], "Since still records the first visit with the server");
document.querySelector("#nv-home").click();
assert.equal(document.querySelector("#home").hidden, false);
window.dispatchEvent(Object.assign(new window.Event("pagehide"), { persisted: false }));
