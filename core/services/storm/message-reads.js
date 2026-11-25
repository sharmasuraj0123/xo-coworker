// @ts-check
import { addReaction, updateMessage } from "../world/rows.js";

/** @import { Row, MessageRow } from "./types.d.ts" */

/** @param {MessageRow[] | undefined} initial */
export function beginMessageRead(initial) {
  const before = new Map(initial?.map((row) => [row.id, row]));
  /** @type {Map<string, Array<{ data: Row, at: string | null, reaction: boolean }>>} */
  const edits = new Map();
  return {
    /** @param {Row} data @param {string | null} at @param {boolean} reaction */
    record(data, at, reaction) {
      const id = reaction ? data.message_id : data.id;
      if (typeof id !== "string") return;
      const list = edits.get(id) || [];
      list.push({ data, at, reaction });
      edits.set(id, list);
    },
    /** @param {MessageRow[] | undefined} current @param {MessageRow[]} incoming */
    reconcile(current, incoming) {
      const live = new Map(current?.map((row) => [row.id, row]));
      return incoming.map((row) => {
        const newer = live.get(row.id);
        if (newer && newer !== before.get(row.id)) return newer;
        for (const { data, at, reaction } of edits.get(row.id) || []) {
          const reactions = row.extra?.reactions;
          if (reaction && Array.isArray(reactions) && reactions.some((r) =>
            r?.emoji === data.emoji && r.by === (data.by || null) && r.at === at)) continue;
          row = (reaction ? addReaction([row], data, at) : updateMessage([row], data))?.[0] || row;
        }
        return row;
      });
    },
  };
}
