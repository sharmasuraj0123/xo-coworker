// @ts-check

// What a session's loaded turns did to files, from storm's activity rows: what it made, edited, deleted or read, and what it is on now.

import { placeOf, pathsInCommand } from "./places.js";

const FILE_KINDS = new Set(["create_file", "edit_file", "delete_file", "read"]);
/** @type {Record<string, string>} */
const VERB_NOW = { create_file: "Writing", edit_file: "Editing", delete_file: "Deleting", read: "Reading" };

/** What a session's turns touched: files inside `root` by relative path, others by absolute path, and the step running now. @param {import("./types").Turns | null | undefined} turns @param {string | null | undefined} session @param {string | null | undefined} root @returns {import("./types").Activity} */
export function activityOf(turns, session, root) {
  /** @type {import("./types").Activity} */
  const out = { files: new Map(), outside: new Map(), now: null, last: null, running: null, nowSpots: [], lastFile: null };
  if (!turns || !session) return out;
  let n = 0;
  for (const tu of turns.list((x) => x.session === session)) {
    const live = tu.status === "running";
    if (live) out.running = tu;
    for (const b of turns.blocksOf(tu)) {
      if (b.type !== "activity") continue;
      for (const r of b.rows || []) {
        n++;
        if (r.kind === "notice" || r.kind === "error") continue;
        const on = live && r.status === "running";
        out.last = { row: r, turn: tu };
        if (on) out.now = { row: r, turn: tu };
        if (on && (r.kind === "command" || r.kind === "search" || r.kind === "list") && r.target) out.nowSpots = pathsInCommand(r.target, root);
        if (!FILE_KINDS.has(r.kind) || !r.target || r.status === "error" || r.status === "denied" || r.status === "cancelled") continue;
        const pl = placeOf(root, r.target);
        if (!pl) continue;
        const into = pl.rel != null ? out.files : out.outside;
        const key = pl.rel ?? pl.abs;
        const f = into.get(key) || { path: key, kinds: new Set(), seq: 0 };
        f.kinds.add(r.kind);
        f.lastKind = r.kind;
        f.seq = n;
        f.live = on;
        f.waiting = on && !!r.waiting;
        f.verb = VERB_NOW[r.kind];
        into.set(key, f);
        if (pl.rel != null) out.lastFile = pl.rel;
      }
    }
  }
  for (const m of [out.files, out.outside]) for (const f of m.values()) {
    f.mark = f.lastKind === "delete_file" ? "deleted" : f.kinds.has("create_file") ? "new" : f.kinds.has("edit_file") ? "edited" : "read";
  }
  return out;
}
