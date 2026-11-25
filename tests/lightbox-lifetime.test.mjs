// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { deferred, dom, settle } from "./lib/dom.mjs";

test("Lightbox handles animation failures and retires its browser resources on permanent pagehide", async (t) => {
  const BrowserEvent = globalThis.Event;
  const { document } = await dom('<button class="mx-one" id="picture">Picture</button>');
  Object.assign(globalThis, { innerWidth: 850, innerHeight: 600 });
  const { createLightbox } = await import("../core/ui/lightbox.js");
  const button = document.querySelector("#picture");
  button.getBoundingClientRect = () => ({ left: 10, top: 10, right: 40, bottom: 40, width: 30, height: 30 });
  const item = { key: "art", name: "art.png", project: "p", rel: "art.png" };
  const download = deferred();
  const lightbox = createLightbox({ pictures: {
    mediaItemOf: () => item, galleryOf: () => [item], slotOf: () => null,
    showSrc: async () => {}, labelOf: () => item.name, midName: (name) => name, midNameHtml: (name) => name,
    typeWord: () => "", fmtSize: () => "", attachmentUrl: () => "",
    projectDownload: () => download.promise,
  } });
  const failures = [];
  const reportError = globalThis.reportError;
  globalThis.reportError = (error) => failures.push(error);
  t.after(() => { globalThis.reportError = reportError; });
  const revocations = t.mock.method(URL, "revokeObjectURL");
  const browser = new EventTarget();
  Object.assign(globalThis, { window: browser });
  const unlisten = t.mock.method(browser, "removeEventListener");
  const pagehide = (persisted) => browser.dispatchEvent(Object.assign(new BrowserEvent("pagehide"), { persisted }));
  t.after(() => pagehide(false));
  const click = (node) => node.dispatchEvent(new Event("click", { bubbles: true }));

  lightbox.open(item.key, button, document.body);
  await settle();
  const dialog = document.querySelector(".lbx");
  const frame = dialog.querySelector(".lbx-frame");
  const oldWidth = frame.style.width;
  pagehide(true);
  globalThis.innerWidth = 500;
  browser.dispatchEvent(new BrowserEvent("resize"));
  assert.notEqual(frame.style.width, oldWidth);
  click(dialog.querySelector('[data-lbx="down"]'));
  download.resolve(new Blob(["image"]));
  await settle();
  assert.equal(revocations.mock.callCount(), 0);

  const failure = new Error("animation failed");
  dialog.animate = () => ({ finished: Promise.reject(failure) });
  await lightbox.close({ quick: true });
  assert.deepEqual(failures, [failure]);
  assert.equal(document.activeElement, button);

  dialog.animate = () => ({ finished: Promise.reject(new DOMException("cancelled", "AbortError")) });
  lightbox.open(item.key, button, document.body);
  await settle();
  assert.deepEqual(failures, [failure]);

  await lightbox.close({ quick: true });
  const flightFailure = new Error("flight failed");
  const proto = globalThis.Element.prototype;
  const animate = proto.animate;
  proto.animate = function () {
    return { finished: this.classList.contains("lbx-frame") ? Promise.reject(flightFailure) : Promise.resolve() };
  };
  t.after(() => { proto.animate = animate; });
  lightbox.open(item.key, button, document.body);
  await settle();
  assert.deepEqual(failures, [failure, flightFailure]);
  pagehide(false);
  assert.equal(revocations.mock.callCount(), 1);
  assert.ok(unlisten.mock.calls.some(({ arguments: [type] }) => type === "resize"));
  assert.equal(dialog.isConnected, false);
  assert.equal(lightbox.isOpen, false);
  lightbox.open(item.key, button, document.body);
  assert.equal(document.querySelector(".lbx"), null);
});
