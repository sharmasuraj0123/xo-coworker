// @ts-check

import assert from "node:assert/strict";
import { api } from "../core/platform/api.js";
import { deferred, dom, settle } from "./lib/dom.mjs";

const { window, document } = await dom("<main></main>");
const { cachedSrc, showSrc } = await import("../core/services/media/images.js");
const { mediaItem } = await import("../core/services/media/items.js");
const { hydrateMedia } = await import("../core/services/media/hydrate.js");
const { mediaHtml } = await import("../core/services/media/render.js");
const main = document.querySelector("main");
const image = () => main.appendChild(document.createElement("img"));
const picture = (/** @type {string} */ key) => mediaItem({ key, project: "project", rel: `${key}.png`, name: `${key}.png`, w: 640, h: 480 });
const reads = [];
api.projectImage = (_project, rel, opts) => {
  const answer = deferred();
  reads.push({ rel, signal: opts?.signal, answer });
  return answer.promise;
};

const single = image(), singleItem = picture("single");
const abandoned = showSrc(single, singleItem);
await settle();
const original = reads.at(-1);
assert.equal(original?.rel, "single.png");
single.remove();
await settle();
assert.equal(original.signal?.aborted, true, "removing the last consumer cancels the transport");
await abandoned;
const replacement = image();
const retried = showSrc(replacement, singleItem);
await settle();
const retrial = reads.at(-1);
assert.equal(retrial !== original, true, "a retry has a fresh in-flight entry");
retrial.answer.resolve(new Blob());
await retried;
original.answer.resolve(new Blob());
assert.equal(single.hasAttribute("src"), false);
assert.equal(replacement.src, cachedSrc(singleItem));

const tile = image(), lightbox = image(), sharedItem = picture("shared");
const beforeShare = reads.length;
const tileRead = showSrc(tile, sharedItem);
const lightboxRead = showSrc(lightbox, sharedItem);
await settle();
assert.equal(reads.length - beforeShare, 1, "simultaneous consumers share one transport");
const shared = reads.at(-1);
tile.remove();
await settle();
assert.equal(shared.signal?.aborted, false, "the surviving consumer keeps the shared transport alive");
await tileRead;
shared.answer.resolve(new Blob());
await lightboxRead;
assert.equal(tile.hasAttribute("src"), false);
assert.equal(lightbox.src, cachedSrc(sharedItem));

const changing = image(), oldItem = picture("old"), newItem = picture("new");
const oldRead = showSrc(changing, oldItem);
await settle();
const old = reads.at(-1);
const newRead = showSrc(changing, newItem);
await settle();
const recent = reads.at(-1);
recent.answer.resolve(new Blob());
await newRead;
const best = changing.src;
assert.equal(best, cachedSrc(newItem));
old.answer.resolve(new Blob());
await oldRead;
await settle();
assert.equal(changing.src, best, "late results cannot overwrite the newest request for the same image");
assert.equal(cachedSrc(oldItem), null, "stale results never create object URLs");
assert.equal(old.signal?.aborted, true);

const beforeRepeat = reads.length;
const sameItem = picture("repeat");
const first = showSrc(changing, sameItem);
await settle();
const second = showSrc(changing, sameItem);
await settle();
assert.equal(reads.length - beforeRepeat, 1, "replacing a consumer with the same key reuses its transport");
reads.at(-1).answer.resolve(new Blob());
await Promise.all([first, second]);
assert.equal(changing.src, cachedSrc(sameItem));

const slow = showSrc(changing, picture("superseded-by-direct"));
await settle();
const slowRead = reads.at(-1);
const direct = "https://example.com/current.png";
const directRead = showSrc(changing, mediaItem({ src: direct }));
assert.equal(changing.src, direct, "direct sources remain available synchronously");
slowRead.answer.resolve(new Blob());
await Promise.all([slow, directRead]);
assert.equal(changing.src, direct);

const nativeTimeout = globalThis.setTimeout;
const nativeClear = globalThis.clearTimeout;
const timers = new Set();
globalThis.setTimeout = (fn, ms, ...rest) => {
  if (ms !== 3000) return nativeTimeout(fn, ms, ...rest);
  const token = Symbol();
  timers.add(token);
  return token;
};
globalThis.clearTimeout = (token) => {
  if (!timers.delete(token)) nativeClear(token);
};
try {
  for (const end of ["load", "error", "removal"]) {
    const section = main.appendChild(document.createElement("section"));
    section.innerHTML = mediaHtml([{ ...picture(end), src: `https://example.com/${end}.png` }]);
    hydrateMedia(section);
    assert.equal(timers.size, 1, `${end} begins with a slow timer`);
    if (end === "removal") section.remove();
    else section.querySelector("img").dispatchEvent(new window.Event(end));
    await settle();
    assert.equal(timers.size, 0, `${end} clears the slow timer`);
    section.remove();
  }
  const projectTile = main.appendChild(document.createElement("section"));
  projectTile.innerHTML = mediaHtml([picture("hydrated")]);
  hydrateMedia(projectTile);
  await settle();
  const inFlight = reads.at(-1);
  assert.equal(inFlight?.rel, "hydrated.png");
  assert.equal(timers.size, 1);
  projectTile.remove();
  await settle();
  assert.equal(inFlight.signal?.aborted, true);
  assert.equal(timers.size, 0);
} finally {
  globalThis.setTimeout = nativeTimeout;
  globalThis.clearTimeout = nativeClear;
}
