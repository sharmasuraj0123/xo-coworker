// @ts-check

// The conversation's pictures lent to the core lightbox: what each one is, where it's drawn, and how its file is fetched.
import { createLightbox as create } from "../core/ui/lightbox.js";
import { api, attachmentUrl } from "../core/platform/api.js";
import { typeWord, fmtSize } from "../core/services/media/attachment-rules.js";
import { mediaItemOf, galleryOf, slotOf, cachedSrc, loadSrc, labelOf, midName, midNameHtml } from "./media.js";

const pictures = { mediaItemOf, galleryOf, slotOf, cachedSrc, loadSrc, labelOf, midName, midNameHtml, typeWord, fmtSize, attachmentUrl, projectDownload: (/** @type {string} */ project, /** @type {string} */ rel) => api.projectDownload(project, rel) };

/** The lightbox over the conversation's pictures. @param {{ openFile?: ((it: any, from: any) => void) | null, announce?: (words: string) => void }} [opts] */
export const createLightbox = (opts = {}) => create({ ...opts, pictures });
