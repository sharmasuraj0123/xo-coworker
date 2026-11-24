// @ts-check

// The conversation's pictures lent to the core lightbox: what each one is, where it's drawn, and how its file is fetched.
import { createLightbox as create } from "../../core/ui/lightbox.js";
import { api, attachmentUrl } from "../../core/platform/api.js";
import { typeWord, fmtSize } from "../../core/services/media/attachment-rules.js";
import { mediaItemOf } from "../../core/services/media/render.js";
import { labelOf, midName, midNameHtml } from "../../core/services/media/items.js";
import { galleryOf, slotOf, cachedSrc, loadSrc } from "../../core/services/media/hydrate.js";

const pictures = { mediaItemOf, galleryOf, slotOf, cachedSrc, loadSrc, labelOf, midName, midNameHtml, typeWord, fmtSize, attachmentUrl, projectDownload: (/** @type {string} */ project, /** @type {string} */ rel) => api.projectDownload(project, rel) };

/** @param {Omit<Parameters<typeof create>[0], "pictures">} [opts] */
export const createLightbox = (opts = {}) => create({ ...opts, pictures });
