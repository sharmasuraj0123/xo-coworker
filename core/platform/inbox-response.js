// @ts-check
import { isResponseObject } from "./http.js";
import { requestChecked } from "./response.js";

/** @typedef {{id:string,title:string,body?:string|null,source?:string|null,url?:string|null,project_id?:string|null}} InboxItem */

/** @param {unknown} value @returns {value is {items:InboxItem[]}} */
function inboxPage(value) {
  return isResponseObject(value) && Array.isArray(value.items) && value.items.every(item => isResponseObject(item)
    && typeof item.id === "string" && typeof item.title === "string"
    && [item.body, item.source, item.url, item.project_id].every(field => field == null || typeof field === "string"));
}

/** @param {AbortSignal} signal */
export const readInbox = signal => requestChecked("/inbox", inboxPage, { signal, query: { status: "open", limit: 200 } });
