// @ts-check
import { retryMedia } from "../../core/services/media/hydrate.js";
import { mediaItemOf } from "../../core/services/media/render.js";
import { viewerFile } from "../../core/services/media/items.js";

/** @param {{ msgsEl: HTMLElement; LB: {open(key: string, from: HTMLElement, root: HTMLElement): unknown}; VW: {open(file: ReturnType<typeof viewerFile>, from: HTMLElement): unknown} }} options */
export function createMediaOpener({ msgsEl, LB, VW }) {
  /** @param {HTMLElement} el @param {Pick<MouseEvent, "shiftKey">} e */
  return function openMedia(el, e) {
    if (retryMedia(el)) return;
    const it = mediaItemOf(/** @type {string} */ (el.dataset.mx), el);
    if (!it) return;
    // ← → walk the conversation's pictures; a picture elsewhere (an ask's words, a document) walks its own set
    const root = msgsEl.contains(el) ? msgsEl : el.closest(".mx-stack")?.parentElement || msgsEl;
    // ⇧ opens a file in the viewer; a web picture has no file here, so it's the lightbox either way
    if (it.kind === "image" && (!e.shiftKey || it.web)) LB.open(it.key, el, root);
    else VW.open(viewerFile(it), el);
  };
}
