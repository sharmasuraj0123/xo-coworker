// @ts-check
import { api } from "../../core/platform/api.js";
import { createLru } from "../../core/platform/cache.js";
import { missingRoute } from "../../core/platform/http.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";
import { createTitleQueue } from "./title-queue.js";

/** @import { Session } from "./types.d.ts" */

export const CHAT_LIST_LIMIT = 100;
const TITLE_LENGTH = 120;

/** @param {string} text */
const shortTitle = (text) => text.replace(/\s+/g, " ").slice(0, TITLE_LENGTH);

/** @param {Element | undefined} root @param {(id: string) => Session | null} session @param {() => void} searchChanged */
export function createChatTitles(root, session, searchChanged) {
  /** @type {Set<string>} */
  const untethered = new Set();
  /** @type {ReturnType<typeof createLru<string, { native: string | null, title: string }>>} */
  const cache = createLru({ max: CHAT_LIST_LIMIT, onEvict: (_, id) => untethered.delete(id) });
  /** @type {ReturnType<typeof createTitleQueue> | undefined} */
  let queue;

  /** @param {Session} row */
  function entry(row) {
    const saved = cache.get(row.id);
    const native = row.native_id ?? null;
    if (saved && !saved.native && native) {
      saved.native = native;
      untethered.delete(row.id);
    }
    return saved?.native === native ? saved : undefined;
  }

  /** @param {string} id @param {string} native @param {AbortSignal} signal */
  async function read(id, native, signal) {
    let text;
    try {
      const data = /** @type {{ messages?: import("./read-types.d.ts").Observed[] }} */ (
        await api.observedMessages(native, { offset: 0, limit: 5 }, { signal }));
      const first = data.messages?.find((message) => message.data?.role === "user");
      text = first?.parts?.map((part) => part.data?.type === "text" ? part.data.text : "").join(" ").trim();
    } catch (error) {
      if (signal.aborted || session(id)?.native_id !== native) return;
      if (!missingRoute(error)) {
        requestFailureMessage(error, "Couldn't read the chat title.");
        return;
      }
    }
    const row = session(id);
    if (signal.aborted || row?.native_id !== native || entry(row)) return;
    const title = text ? shortTitle(text) : "";
    cache.set(id, { native, title });
    if (title) {
      for (const node of root?.querySelectorAll(".chl-row") ?? []) {
        if (node.getAttribute("data-go") !== "c:" + id) continue;
        const label = node.querySelector(".chl-t");
        if (label) redraw(label, esc(title));
        break;
      }
    }
  }

  return {
    /** @param {Session} row */
    get: (row) => entry(row)?.title,
    /** @param {Session} row @param {string} text */
    remember(row, text) { if (!entry(row)?.title) cache.set(row.id, { native: row.native_id ?? null, title: shortTitle(text) }); },
    /** @param {string} id @param {string} text */
    optimistic(id, text) {
      const native = session(id)?.native_id ?? null;
      cache.set(id, { native, title: shortTitle(text) });
      if (!native) untethered.add(id);
    },
    noteSessions() {
      for (const id of untethered) {
        const row = session(id);
        if (row?.native_id) entry(row);
      }
    },
    /** @param {Session[]} rows @param {string} query */
    observe(rows, query) {
      queue ??= createTitleQueue(root, {
        native(id) { const row = session(id); return row && !entry(row) ? row.native_id : null; },
        read,
        settled: searchChanged,
      });
      return queue.sync(rows.slice(0, CHAT_LIST_LIMIT).map((row) => row.id), query);
    },
    stop() { queue?.dispose(); queue = undefined; },
    /** @param {string} id */
    invalidateEmpty(id) {
      if (cache.get(id)?.title === "") cache.delete(id);
      queue?.invalidate(id);
    },
  };
}
