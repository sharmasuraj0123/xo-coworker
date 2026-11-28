// @ts-check

import assert from "node:assert/strict";
import { api } from "../core/platform/api.js";
import { deferred, dom, settle } from "./lib/dom.mjs";

const { window, document } = await dom("<main></main>");
globalThis.MutationObserver = window.MutationObserver;
const { mediaHtml } = await import("../core/services/media/render.js");
const { mediaItemOf } = await import("../core/services/media/stack-data.js");
const { webGone, markWebGone } = await import("../core/services/media/cache.js");
const { galleryOf, hydrateMedia, pictureTone } = await import("../core/services/media/hydrate.js");
const { showSrc, cachedSrc } = await import("../core/services/media/images.js");
const { mediaItem } = await import("../core/services/media/items.js");
const { redraw } = await import("../core/ui/redraw.js");
const main = document.querySelector("main");

const picture = (/** @type {number} */ n) => mediaItem({
  key: `picture-${n}`, project: "project", rel: `picture-${n}.png`, name: `picture-${n}.png`, w: 640, h: 480,
});
const album = Array.from({ length: 6 }, (_, i) => picture(i));
main.innerHTML = mediaHtml(album);
for (let i = 6; i < 250; i++) mediaHtml([picture(i)]);
assert.deepEqual(galleryOf(main).map((it) => it.key), album.map((it) => it.key));
const openingTile = main.querySelector("button");
assert.equal(mediaItemOf(album[0].key, openingTile)?.rel, album[0].rel);
assert.equal(mediaItemOf(album[0].key, document.body), null);
openingTile.focus();
redraw(main, mediaHtml([{ ...album[0], by: "Updated author" }, ...album.slice(1)]));
assert.equal(main.querySelector("button") === openingTile, true);
assert.equal(document.activeElement === openingTile, true);
assert.equal(mediaItemOf(album[0].key, openingTile)?.by, "Updated author");

const liveWeb = "https://example.com/live.png";
markWebGone("https://example.com/old.png");
for (let i = 0; i < 205; i++) markWebGone(`https://example.com/${i}.png`);
markWebGone(liveWeb);
assert.equal(webGone(liveWeb), true);
assert.equal(webGone("https://example.com/old.png"), false);

const canvasProto = Object.getPrototypeOf(document.createElement("canvas"));
let samples = 0;
canvasProto.getContext = () => ({
  drawImage() { samples++; },
  getImageData() { return { data: [0, 0, 0, 255] }; },
});
const tone = (/** @type {number} */ i) => pictureTone({ src: `https://example.com/tone-${i}.png`, complete: true, naturalWidth: 100 });
assert.equal(tone(0), "dark");
assert.equal(tone(0), "dark");
assert.equal(samples, 1);
for (let i = 1; i <= 200; i++) tone(i);
tone(0);
assert.equal(samples, 202);

const created = new Set();
const revoked = [];
URL.createObjectURL = () => {
  const url = `blob:https://example.com/${created.size}`;
  created.add(url);
  return url;
};
URL.revokeObjectURL = (url) => revoked.push(url);
const image = () => main.appendChild(document.createElement("img"));
const shared = deferred();
let reads = 0;
api.projectImage = async () => { reads++; return shared.promise; };
const original = image(), lightbox = image(), detached = image();
const first = showSrc(original, album[0]);
const duplicate = showSrc(lightbox, album[0]);
const cancelled = showSrc(detached, album[1]);
await settle();
detached.remove();
shared.resolve(new Blob());
await Promise.all([first, duplicate, cancelled]);
assert.equal(reads, 2);
assert.equal(created.size, 1);
assert.equal(lightbox.src, original.src);
assert.equal(detached.hasAttribute("src"), false);
const used = original.src;

api.projectImage = async () => new Blob();
const churn = image();
await showSrc(churn, album[2]);
const unused = churn.src;
for (let i = 6; i <= 206; i++) await showSrc(churn, picture(i));
assert.equal(cachedSrc(album[0]), null);
assert.equal(revoked.includes(used), false);
assert.equal(revoked.filter((url) => url === unused).length, 1);
original.remove();
await settle();
assert.equal(revoked.includes(used), false);
lightbox.src = "https://example.com/other.png";
await settle();
assert.equal(revoked.filter((url) => url === used).length, 1);

function decoded(/** @type {number} */ i) {
  const it = { ...picture(i), src: `https://example.com/${i}.png` };
  main.innerHTML = mediaHtml([it]);
  const img = main.querySelector("img");
  Object.defineProperties(img, { complete: { value: true }, naturalWidth: { value: 640 } });
  hydrateMedia(main);
  return main.querySelector("img");
}
const decodedFirst = decoded(0);
assert.equal(decoded(0) === decodedFirst, true);
for (let i = 1; i <= 200; i++) decoded(i);
assert.equal(decoded(0) === decodedFirst, false);

const watchers = [];
globalThis.IntersectionObserver = class {
  constructor(/** @type {IntersectionObserverCallback} */ callback) {
    this.callback = callback;
    this.targets = new Set();
    this.disconnected = false;
    watchers.push(this);
  }
  root = null;
  rootMargin = "";
  thresholds = [];
  takeRecords() { return []; }
  observe(/** @type {Element} */ node) { this.targets.add(node); }
  unobserve(/** @type {Element} */ node) { this.targets.delete(node); }
  disconnect() { this.targets.clear(); this.disconnected = true; }
};
const scroller = document.createElement("section");
scroller.className = "scroller";
main.append(scroller);
scroller.innerHTML = mediaHtml(album);
hydrateMedia(scroller);
assert.equal(watchers.length, 1);
assert.equal(watchers[0].targets.size, 4);
scroller.querySelector(".mx-tile").remove();
await settle();
assert.equal(watchers[0].targets.size, 3);
scroller.remove();
await settle();
assert.equal(watchers[0].disconnected, true);
main.append(scroller);
scroller.innerHTML = mediaHtml(album);
hydrateMedia(scroller);
assert.equal(watchers.length, 2);
assert.equal(watchers[1].targets.size, 4);
scroller.remove();
await settle();
assert.equal(watchers[1].disconnected, true);
