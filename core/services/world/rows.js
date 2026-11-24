// @ts-check

/** @import { MessageRow, Row } from "../storm/types.d.ts" */

const COORDINATORS = new Set(["workspace-coordinator", "project-coordinator"]);

/** @param {Row} row */
export function uiMsg(row) {
  /** @type {"you" | "system" | "coord" | "agent"} */
  const who = row.author_kind === "owner" ? "you"
    : row.author_kind === "system" ? "system"
      : COORDINATORS.has(row.author_id) ? "coord" : "agent";
  const x = row.extra || {};
  const f = x.forwarded_from;
  const p = x.passed_on;
  return {
    id: row.id,
    chatId: row.chat_id || null,
    seq: row.seq ?? null,
    at: Date.parse(row.created_at) || 0,
    who,
    role: row.author_id || null,
    text: String(row.text ?? ""),
    // `root`: where the message began, when XO says so (a copy of a copy names it; older copies don't)
    fwd: f && f.message_id ? { chatId: f.chat_id || null, id: f.message_id, via: f.via || [], ...(f.root && f.root.message_id ? { root: { chatId: f.root.chat_id || null, id: f.root.message_id } } : {}) } : null,
    job: x.job || null,
    noOne: !!row.reply_to, // XO's "This message reached no one: …" note
    files: attachmentsOf(row),
    passedOn: p && p.project ? { project: String(p.project), to: (p.forwarded_message_ids || [])[0] || null } : null,
    reactions: Array.isArray(x.reactions) ? x.reactions.filter((/** @type {Row} */ r) => r && r.emoji) : [],
    continuedIn: x.continued_in || null,
    continuedFrom: x.continued_from || null,
  };
}

/** @template {Row} T @param {T[] | undefined} list @param {Row} d @param {string | null} [at] */
export function addReaction(list, d, at = null) {
  const i = list?.findIndex((r) => r && r.id === d.message_id) ?? -1;
  if (!list || i < 0 || !d.emoji) return null;
  const row = list[i], x = row.extra || {};
  const next = [...list];
  next[i] = { ...row, extra: { ...x, reactions: [...(x.reactions || []), { emoji: d.emoji, by: d.by || null, at }] } };
  return next;
}

/** @template {Row} T @param {T[] | undefined} list @param {Row} d */
export function updateMessage(list, d) {
  const i = d && d.id ? list?.findIndex((r) => r && r.id === d.id) ?? -1 : -1;
  if (!list || i < 0 || !d.extra || typeof d.extra !== "object") return null;
  const row = list[i];
  const next = [...list];
  next[i] = { ...row, extra: { ...(row.extra || {}), ...d.extra } };
  return next;
}

/** @param {MessageRow[]} list @param {MessageRow[] | null | undefined} incoming */
export function mergeRows(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  const added = [];
  for (const row of incoming || []) {
    if (!row || !row.id) continue;
    const old = byId.get(row.id);
    if (!old) added.push(row);
    byId.set(row.id, old && old.seq != null && row.seq == null ? { ...row, seq: old.seq } : row);
  }
  return { list: [...byId.values()].sort(bySeq), added };
}

/** @param {Row} a @param {Row} b */
const bySeq = (a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);

/** A conversation's history after one page's answer: its cursor (next_before_seq), whether that was all, and whether it ever had more than one page. @param {Row | null | undefined} h @param {Row | null | undefined} d @returns {Row} */
export function pageAfter(h, d) {
  const before = d && d.next_before_seq != null ? d.next_before_seq : null;
  return { ...h, loaded: true, before, all: before == null, paged: !!(h && h.paged) || before != null };
}

/** Whether to read the next older page now: loaded, more to read, nothing on its way, no failure to retry by hand. @param {Row | null | undefined} h */
export function canPageOlder(h) {
  return !!(h && h.loaded && !h.all && !h.loading && !h.older && !h.olderError && h.before != null);
}

/** Whether a session's stored frames still stop short of a page's oldest message (read one more page of them). @param {number | null | undefined} framesBefore @param {number | null | undefined} floor */
export const framesShort = (framesBefore, floor) => framesBefore != null && floor != null && framesBefore > floor;

/** A stored message's files (extra.attachments): uploads read through their chat, files an agent shared through their project's route; a title and picture size when sent. @param {Row | null | undefined} row */
export function attachmentsOf(row) {
  const list = row && row.extra && row.extra.attachments;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list) {
    if (!a) continue;
    /** @type {import("../media/types.d.ts").SharedFile} */
    const f = { name: String(a.name || "file"), type: String(a.type || ""), bytes: a.bytes ?? null };
    if (a.id) f.id = String(a.id);
    else if (a.project_id && a.relative_path) Object.assign(f, { project_id: String(a.project_id), relative_path: String(a.relative_path), path: String(a.path || a.relative_path) });
    else continue; // no way to read it
    if (a.made_id) f.made_id = String(a.made_id);
    if (a.mtime != null) f.mtime = a.mtime;
    const title = titleOf(a.title);
    if (title) f.title = title;
    Object.assign(f, picDims(a));
    out.push(f);
  }
  return out;
}

/** @param {unknown} t */
export const titleOf = (t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");

/** A picture's w, h and tint as the server sent them (only the keys it sent). @param {Row | null | undefined} a @returns {Row} */
export function picDims(a) {
  /** @type {Row} */
  const out = {};
  for (const k of ["w", "h", "tint"]) if (a && k in a) out[k] = a[k];
  return out;
}
