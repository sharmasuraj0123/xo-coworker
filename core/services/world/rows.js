// @ts-check

/** @import { MessageRow } from "../storm/types.d.ts" */
import { isRecord } from "../../platform/util.js";

const COORDINATORS = new Set(["workspace-coordinator", "project-coordinator"]);

/** @param {unknown} value */
const textOrNull = (value) => typeof value === "string" && value ? value : null;

/** @param {unknown} value */
function messageRef(value) {
  return isRecord(value) && typeof value.message_id === "string" && value.message_id
    ? { id: value.message_id, chatId: textOrNull(value.chat_id) } : null;
}

/** @param {unknown} value */
function forwarded(value) {
  const ref = messageRef(value);
  if (!ref || !isRecord(value)) return null;
  const root = messageRef(value.root);
  const via = Array.isArray(value.via) ? value.via.filter((v) => typeof v === "string") : [];
  return { ...ref, via, ...(root ? { root } : {}) };
}

/** @param {unknown} value @returns {value is {emoji: string, by?: string | null, at?: string | null}} */
const isReaction = (value) => isRecord(value) && typeof value.emoji === "string" && !!value.emoji
  && (value.by == null || typeof value.by === "string") && (value.at == null || typeof value.at === "string");

const GB = String.raw`(\d+(?:\.\d+)?)\s*GB`;
/** One "xo-space 2 GB across 9 threads" part of a notice. @param {string} part */
function spaceUser(part) {
  const m = new RegExp(String.raw`^(.+?)\s+${GB}(?:\s+across\s+(\d+)\s+threads?)?$`).exec(part.trim());
  return m ? { name: m[1].replace(/^the\s+/i, ""), gb: Number(m[2]), threads: m[3] ? Number(m[3]) : null } : null;
}

/** A Space notice's numbers: extra.advisory's percent, else what its words say. @param {MessageRow} row */
function spaceNotice(row) {
  if (row.author_kind !== "system" || row.author_id !== "space-advisory") return null;
  const a = isRecord(row.extra?.advisory) ? row.extra.advisory : null;
  const text = String(row.text ?? "");
  const said = /(\d+(?:\.\d+)?)\s*%/.exec(text);
  const percent = typeof a?.percent === "number" ? a.percent : said ? Number(said[1]) : null;
  const of = new RegExp(String.raw`%\s+of\s+${GB}`).exec(text);
  const list = /Largest users:\s*(.+?)\.?\s*$/.exec(text);
  const users = list ? list[1].split(";").map(spaceUser) : [];
  const known = /** @type {NonNullable<ReturnType<typeof spaceUser>>[]} */ (users.every(Boolean) ? users : []);
  return { percent, total: of ? Number(of[1]) : null, users: known };
}

/** @param {MessageRow} row */
export function uiMsg(row) {
  /** @type {"you" | "system" | "coord" | "agent"} */
  const who = row.author_kind === "owner" ? "you"
    : row.author_kind === "system" ? "system"
      : COORDINATORS.has(row.author_id ?? "") ? "coord" : "agent";
  const x = row.extra || {};
  const p = isRecord(x.passed_on) ? x.passed_on : null;
  return {
    id: row.id,
    chatId: row.chat_id || null,
    seq: row.seq ?? null,
    at: Date.parse(row.created_at ?? "") || 0,
    who,
    role: row.author_id || null,
    text: String(row.text ?? ""),
    fwd: forwarded(x.forwarded_from),
    job: x.job || null,
    noOne: !!row.reply_to, // XO's "This message reached no one: …" note
    files: attachmentsOf(row),
    passedOn: p && typeof p.project === "string" && p.project
      ? { project: p.project, to: Array.isArray(p.forwarded_message_ids) ? textOrNull(p.forwarded_message_ids[0]) : null } : null,
    reactions: Array.isArray(x.reactions) ? x.reactions.filter(isReaction) : [],
    continuedIn: textOrNull(x.continued_in),
    continuedFrom: textOrNull(x.continued_from),
    space: spaceNotice(row),
  };
}

/** @param {MessageRow[] | undefined} list @param {{ message_id?: unknown; emoji?: unknown; by?: unknown }} d @param {string | null} [at] */
export function addReaction(list, d, at = null) {
  const i = list?.findIndex((r) => r && r.id === d.message_id) ?? -1;
  if (!list || i < 0 || !textOrNull(d.emoji)) return null;
  const row = list[i], x = row.extra || {};
  const next = [...list];
  const reactions = Array.isArray(x.reactions) ? x.reactions : [];
  next[i] = { ...row, extra: { ...x, reactions: [...reactions, { emoji: d.emoji, by: textOrNull(d.by), at }] } };
  return next;
}

/** @param {MessageRow[] | undefined} list @param {{ id?: unknown; extra?: unknown }} d */
export function updateMessage(list, d) {
  const i = d && d.id ? list?.findIndex((r) => r && r.id === d.id) ?? -1 : -1;
  if (!list || i < 0 || !isRecord(d.extra)) return null;
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

/** @param {MessageRow} a @param {MessageRow} b */
const bySeq = (a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity)
  || (Date.parse(a.created_at || "") || 0) - (Date.parse(b.created_at || "") || 0);

/** @param {HistoryPage | null | undefined} h @param {import("../../platform/chat-response-types").CursorPage | null | undefined} d */
export function pageAfter(h, d) {
  const before = d && d.next_before_seq != null ? d.next_before_seq : null;
  return { ...h, loaded: true, before, all: before == null, paged: !!(h && h.paged) || before != null };
}

/** @typedef {NonNullable<import("./state-types.d.ts").WorldState["hist"][string]>} HistoryPage */

/** @param {HistoryPage | null | undefined} h */
export function canPageOlder(h) {
  return !!(h && h.loaded && !h.all && !h.loading && !h.older && !h.olderError && h.before != null);
}

/** Whether a session's stored frames still stop short of a page's oldest message (read one more page of them). @param {number | null | undefined} framesBefore @param {number | null | undefined} floor */
export const framesShort = (framesBefore, floor) => framesBefore != null && floor != null && framesBefore > floor;

/** @param {Pick<MessageRow, "extra"> | null | undefined} row */
export function attachmentsOf(row) {
  const list = row && row.extra && row.extra.attachments;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list) {
    if (!isRecord(a)) continue;
    /** @type {import("../media/types.d.ts").SharedFile} */
    const f = { name: String(a.name || "file"), type: String(a.type || ""), bytes: typeof a.bytes === "number" ? a.bytes : null };
    if (a.id) f.id = String(a.id);
    else if (a.project_id && a.relative_path) Object.assign(f, { project_id: String(a.project_id), relative_path: String(a.relative_path), path: String(a.path || a.relative_path) });
    else continue; // no way to read it
    if (a.made_id) f.made_id = String(a.made_id);
    if (typeof a.mtime === "string" || typeof a.mtime === "number") f.mtime = a.mtime;
    const title = titleOf(a.title);
    if (title) f.title = title;
    Object.assign(f, picDims(a));
    out.push(f);
  }
  return out;
}

/** @param {unknown} t */
export const titleOf = (t) => (typeof t === "string" ? t.replace(/\s+/g, " ").trim() : "");

/** @param {unknown} a */
export function picDims(a) {
  /** @type {Pick<import("../media/types.d.ts").SharedFile, "w" | "h" | "tint">} */
  const out = {};
  if (!isRecord(a)) return out;
  for (const k of /** @type {const} */ (["w", "h"])) {
    const value = a[k];
    if (value === null || typeof value === "number" || typeof value === "string") out[k] = value;
  }
  if (a.tint === null || typeof a.tint === "string") out.tint = a.tint;
  return out;
}
