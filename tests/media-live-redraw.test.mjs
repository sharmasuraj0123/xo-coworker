// @ts-check

import assert from "node:assert/strict";
import { api } from "../core/platform/api.js";
import { dom, settle } from "./lib/dom.mjs";

const { window, document } = await dom("<main></main>");
globalThis.MutationObserver = window.MutationObserver;
const { mediaHtml } = await import("../core/services/media/render.js");
const { hydrateMedia } = await import("../core/services/media/hydrate.js");
const { mediaItem } = await import("../core/services/media/items.js");
const { reconcile } = await import("../core/ui/redraw.js");
const main = /** @type {HTMLElement} */ (document.querySelector("main"));

URL.createObjectURL = () => "blob:https://example.com/shared";
api.projectImage = async () => new Blob();
const shared = mediaItem({ key: "shared-1", project: "project", rel: "shot.png", name: "shot.png", w: 640, h: 480 });
const turn = (/** @type {string} */ head) => [{ key: "turn", html: `<div class="m"><p>${head}</p><div class="tb tb-files">${mediaHtml([shared])}</div></div>` }];

reconcile(main, turn("Thinking · 1s"));
hydrateMedia(main);
await settle();
const img = /** @type {HTMLImageElement} */ (main.querySelector("img.mx-img"));
assert.equal(img.getAttribute("src"), "blob:https://example.com/shared");

reconcile(main, turn("Thinking · 2s"));
hydrateMedia(main);
assert.equal(main.querySelector("img.mx-img") === img, true, "the live turn's redraw keeps the picture's element");
assert.equal(img.getAttribute("src"), "blob:https://example.com/shared", "the live turn's redraw keeps the loaded picture");
