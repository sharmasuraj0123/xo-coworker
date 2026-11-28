// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { deferred, dom, settle } from "./lib/dom.mjs";

const BrowserEvent = globalThis.Event;

test("Lightbox handles animation failures and retires its browser resources on permanent pagehide", async (t) => {
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

test("a held Lightbox download survives a cached page and expires, while a retired page drops it", async (t) => {
  const { document } = await dom("<button>Picture</button>");
  const browser = new EventTarget();
  Object.assign(globalThis, { window: browser, innerWidth: 850, innerHeight: 600 });
  const { createLightbox } = await import("../core/ui/lightbox.js");
  const item = { key: "art", name: "art.png", project: "p", rel: "art.png" };
  const replies = [deferred(), deferred()];
  const projectDownload = t.mock.fn(() => replies.shift().promise);
  const lightbox = createLightbox({ pictures: {
    mediaItemOf: () => item, galleryOf: () => [item], slotOf: () => null,
    showSrc: async () => {}, labelOf: () => item.name, midName: String, midNameHtml: String,
    typeWord: () => "", fmtSize: () => "", attachmentUrl: () => "", projectDownload,
  } });
  const pagehide = (persisted) => browser.dispatchEvent(Object.assign(new BrowserEvent("pagehide"), { persisted }));
  t.after(() => pagehide(false));
  const createURL = t.mock.method(URL, "createObjectURL", () => "blob:art");
  const revokeURL = t.mock.method(URL, "revokeObjectURL", () => {});
  const downloads = [];
  t.mock.method(Object.getPrototypeOf(document.createElement("a")), "click", function () {
    downloads.push([this.href, this.getAttribute("download")]);
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });

  lightbox.open(item.key, document.querySelector("button"), document.body);
  const button = document.querySelector('[data-lbx="down"]');
  const clickDownload = () => button.dispatchEvent(new Event("click", { bubbles: true }));
  const [cached, retired] = replies;
  clickDownload();
  assert.equal(projectDownload.mock.callCount(), 1);
  pagehide(true);
  cached.resolve(new Blob(["image"]));
  await Promise.resolve();
  assert.equal(createURL.mock.callCount(), 1);
  assert.deepEqual(downloads, [["blob:art", "art.png"]]);
  t.mock.timers.tick(59_999);
  assert.equal(revokeURL.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.deepEqual(revokeURL.mock.calls.map(({ arguments: args }) => args), [["blob:art"]]);

  clickDownload();
  assert.equal(projectDownload.mock.callCount(), 2);
  pagehide(false);
  retired.resolve(new Blob(["late image"]));
  await Promise.resolve();
  assert.equal(createURL.mock.callCount(), 1, "a retired request creates no object URL");
  assert.deepEqual(downloads, [["blob:art", "art.png"]], "a retired request clicks no download");
  assert.equal(revokeURL.mock.callCount(), 1);
});
