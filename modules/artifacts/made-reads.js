// @ts-check

import { isPending, once } from "../../core/platform/pending.js";
import { missingRoute } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { mergeMadeRows, olderCursor } from "./model.js";

/** @import {MadeReader, MadeReadState} from "./read-types.d.ts" */

/** @import {MadeRow} from "./types" */

const MADE_MS = 30_000;
const PAGE_FIRST = 200;
const PAGE_MORE = 500;
const PAGES_MAX = 40;

/** @param {MadeRow[]} rows @param {Map<string, boolean>} overrides */
function withPins(rows, overrides) {
  if (!overrides.size) return rows;
  return rows.map((row) => {
    const pinned = overrides.get(row?.id);
    return pinned === undefined ? row : { ...row, pinned };
  });
}

/** @param {MadeReader} read @param {AbortSignal} signal @param {() => void} newestLanded @param {() => void} olderLanded */
export function createMadeReads(read, signal, newestLanded, olderLanded) {
  /** @type {Map<string, MadeReadState>} */
  const served = new Map();

  /** @param {string} chat */
  function newest(chat) {
    let entry = served.get(chat);
    if (!entry) {
      entry = {
        at: -Infinity, rows: null, more: null, end: false, off: false, olderFailed: false, pages: 0, version: 0,
        key: Symbol(chat), pendingPins: new Map(), readingPins: null,
      };
      served.set(chat, entry);
    }
    if (!signal.aborted && !entry.off && !isPending(entry.key) && Date.now() - entry.at > MADE_MS) {
      void once(entry.key, () => readNewest(chat, entry));
    }
    return entry;
  }

  /** @param {string} chat @param {MadeReadState} entry */
  async function readNewest(chat, entry) {
    if (signal.aborted) return;
    const pins = entry.readingPins = new Map(entry.pendingPins);
    try {
      const page = await read(chat, { limit: PAGE_FIRST }, { signal });
      if (signal.aborted) return;
      if (!Array.isArray(page?.made)) { entry.rows = null; entry.off = true; return; }
      const complete = !page.next_before;
      entry.rows = mergeMadeRows(entry.rows, withPins(page.made, pins), { first: true, complete });
      entry.more = complete || entry.end ? null : entry.more ?? page.next_before ?? null;
      if (!entry.more) entry.olderFailed = false;
      entry.version++;
    } catch (error) {
      if (signal.aborted) return;
      if (missingRoute(error)) entry.off = true;
      else requestFailureMessage(error, "Couldn't read the artifacts.");
    } finally {
      entry.readingPins = null;
      if (!signal.aborted) { entry.at = Date.now(); newestLanded(); }
    }
  }

  /** @param {MadeReadState | undefined} entry */
  function nextOlder(entry) {
    if (!entry || entry.off || !entry.rows || !entry.more || entry.pages >= PAGES_MAX) return null;
    return olderCursor(entry.more);
  }

  /** @param {string} chat @param {boolean} [retry] */
  function older(chat, retry = false) {
    const entry = served.get(chat);
    if (signal.aborted || !entry || entry.olderFailed !== retry || isPending(entry.key)) return false;
    const before = nextOlder(entry);
    if (!before) return false;
    entry.olderFailed = false;
    void once(entry.key, () => readOlder(chat, entry, before)).then(() => {
      if (!signal.aborted) olderLanded();
    });
    return true;
  }

  /** @param {string} chat @param {MadeReadState} entry @param {string} before */
  async function readOlder(chat, entry, before) {
    if (signal.aborted) return;
    const pins = entry.readingPins = new Map(entry.pendingPins);
    try {
      const page = await read(chat, { limit: PAGE_MORE, before }, { signal });
      if (signal.aborted) return;
      if (!Array.isArray(page?.made) || !entry.rows) {
        entry.more = null;
        return;
      }
      const previousCount = entry.rows.length;
      entry.rows = mergeMadeRows(entry.rows, withPins(page.made, pins));
      entry.pages++;
      entry.more = page.next_before && entry.rows.length > previousCount && page.next_before !== entry.more ? page.next_before : null;
      if (!entry.more) entry.end = true;
      entry.version++;
    } catch (error) {
      if (signal.aborted) return;
      if (missingRoute(error)) entry.more = null;
      else {
        entry.olderFailed = true;
        requestFailureMessage(error, "Couldn't read older artifacts.");
      }
    } finally {
      entry.readingPins = null;
    }
  }

  /** @param {string} chat @param {string} id @param {boolean} pinned @param {boolean} pending */
  function setPin(chat, id, pinned, pending) {
    const entry = served.get(chat);
    if (!entry) return;
    if (pending) entry.pendingPins.set(id, pinned);
    else entry.pendingPins.delete(id);
    entry.readingPins?.set(id, pinned);
    const row = entry.rows?.find((item) => item.id === id);
    if (row && row.pinned !== pinned) {
      row.pinned = pinned;
      entry.version++;
    }
  }

  return {
    newest,
    older,
    setPin,
    /** @param {string} chat */
    olderStatus(chat) {
      const entry = served.get(chat);
      if (!entry || !nextOlder(entry)) return "complete";
      return entry.olderFailed ? "retry" : "reading";
    },
    /** @param {MadeReadState} entry */
    pending: (entry) => !entry.off && entry.at === -Infinity && isPending(entry.key),
  };
}
