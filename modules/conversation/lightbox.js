// @ts-check

import { createLightbox as create } from "../../core/ui/lightbox.js";
import { api, attachmentUrl } from "../../core/platform/api.js";
import { typeWord, fmtSize } from "../../core/services/media/attachment-rules.js";
import { mediaItemOf } from "../../core/services/media/stack-data.js";
import { labelOf, midName, midNameHtml } from "../../core/services/media/items.js";
import { galleryOf, slotOf } from "../../core/services/media/hydrate.js";
import { showSrc } from "../../core/services/media/images.js";

const pictures = { mediaItemOf, galleryOf, slotOf, showSrc, labelOf, midName, midNameHtml, typeWord, fmtSize, attachmentUrl, projectDownload: (/** @type {string} */ project, /** @type {string} */ rel) => api.projectDownload(project, rel) };

/** @param {Omit<Parameters<typeof create>[0], "pictures">} [opts] */
export const createLightbox = (opts = {}) => create({ ...opts, pictures });
