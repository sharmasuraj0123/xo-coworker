// @ts-check

import { createLru } from "../../core/platform/cache.js";
import { once } from "../../core/platform/pending.js";

/** @import {SinceApi, TreeMap} from "./model-types" */

const TREES_MS = 60_000;
const MAX_CACHED_CHATS = 32;
let ownerSequence = 0;

/** @param {SinceApi["worktrees"]} load @param {AbortSignal} signal @param {() => void} changed @param {(error: unknown) => void} failed */
export function createSinceTrees(load, signal, changed, failed) {
  /** @type {ReturnType<typeof createLru<string, {at: number, map: TreeMap}>>} */
  const cache = createLru({ max: MAX_CACHED_CHATS });
  const ownerKey = `since:worktrees:${++ownerSequence}:`;
  /** @type {TreeMap} */
  const empty = new Map();

  /** @param {string} [chat] */
  return function treesFor(chat = "") {
    const entry = cache.get(chat);
    if (!signal.aborted && (!entry || Date.now() - entry.at > TREES_MS)) {
      void once(ownerKey + chat, () => refresh(chat, entry?.map ?? empty));
    }
    return entry?.map ?? empty;
  };

  /** @param {string} chat @param {TreeMap} previous */
  async function refresh(chat, previous) {
    if (signal.aborted) return;
    let map = previous;
    try {
      const data = await load(chat || undefined, signal);
      map = new Map((data?.worktrees ?? []).map((tree) => [tree.thread_ts, tree]));
      for (const tree of data?.removed ?? []) {
        if (tree?.thread_ts && !map.has(tree.thread_ts)) map.set(tree.thread_ts, { ...tree, exists: false });
      }
    } catch (error) {
      failed(error);
    } finally {
      if (!signal.aborted) {
        cache.set(chat, { at: Date.now(), map });
        changed();
      }
    }
  }
}
