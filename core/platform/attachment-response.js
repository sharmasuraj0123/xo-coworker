// @ts-check

import { isResponseObject } from "./http.js";

/** @typedef {{w?: number | null, h?: number | null, tint?: string | null}} AttachmentImage */

/** @typedef {{id: string, name: string, type: string, bytes: number} & AttachmentImage} UploadedAttachment */

/** @param {unknown} value @returns {value is UploadedAttachment} */
export function isUploadedAttachment(value) {
  return isResponseObject(value) && [value.id, value.name, value.type].every((part) => typeof part === "string")
    && typeof value.bytes === "number" && Number.isInteger(value.bytes) && value.bytes >= 0
    && [value.w, value.h].every((part) => part == null || typeof part === "number" && part > 0 && Number.isInteger(part))
    && (value.tint == null || typeof value.tint === "string");
}
