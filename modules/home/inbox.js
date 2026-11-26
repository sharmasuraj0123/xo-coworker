// @ts-check
import { readInbox } from "../../core/platform/inbox-response.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { missingRoute } from "../../core/platform/http.js";

/** @import {InboxItem} from "../../core/platform/inbox-response.js" */

/** @param {InboxItem} item */
export function arrival(item) {
  const href = item.url && URL.canParse(item.url) ? new URL(item.url) : null;
  const link = href && ["https:", "http:"].includes(href.protocol)
    ? `<a href="${esc(href.href)}" target="_blank" rel="noopener noreferrer">Open</a>` : "";
  const project = item.project_id ? `<button type="button" data-go="p:${esc(item.project_id)}">Open project</button>` : "";
  return `<li><details><summary>${esc(item.title)}</summary><p>${esc(item.body || item.source || "")}</p>${link || project}</details></li>`;
}

/** @typedef {import("../../core/kernel/types").ModuleContext} Context */

/** @param {Context} ctx @param {() => boolean} visible */
export function homeInbox(ctx, visible) {
  /** @type {InboxItem[]} */
  let items = [];
  let pending = false, last = -Infinity, failed = false;
  async function refresh() {
    if (pending || !visible() || Date.now() - last < 30000) return;
    pending = true;
    try {
      items = (await readInbox(ctx.signal)).items;
      failed = false;
    } catch (error) {
      if (ctx.signal.aborted) return;
      failed = true;
      if (!missingRoute(error)) requestFailureMessage(error, "Space inbox unavailable");
    } finally {
      last = Date.now();
      pending = false;
      if (!ctx.signal.aborted && visible()) ctx.invalidate("workspace");
    }
  }
  ctx.interval(refresh, 30000);
  return () => { void refresh(); return { items, failed }; };
}
