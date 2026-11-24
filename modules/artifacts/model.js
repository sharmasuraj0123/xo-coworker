// @ts-check

// What threads made, as the Made tab, Home's strip and the Artifacts page show it: kinds, previews, groups and the backend's pages.

/** @typedef {import("./types").Made} Made @typedef {import("./types").Kind} Kind @typedef {import("./types").MadeRow} MadeRow */

import { DAY_MS } from "../../core/platform/time.js";

/** @param {unknown} name */
const EXT = (name) => ((/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "").toLowerCase();
const IMG = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const PAGE = new Set(["html", "htm"]);
const DOC = new Set(["md", "markdown", "txt", "pdf", "rtf", "doc", "docx"]);
const DATA = new Set(["json", "jsonl", "csv", "tsv", "yaml", "yml", "toml", "xml"]);

/** A made file's kind: image, page, doc, data or code. @param {import("./types").MadeFile} f @returns {Kind} */
export function madeKind(f) {
  const type = String(f.type || "");
  const ext = EXT(f.name || f.path);
  if (type.startsWith("image/") || IMG.has(ext)) return "image";
  if (type === "text/html" || PAGE.has(ext)) return "page";
  if (type === "text/markdown" || type === "application/pdf" || DOC.has(ext)) return "doc";
  if (DATA.has(ext) || type === "application/json" || type === "text/csv") return "data";
  return "code";
}
/** @type {[string, string][]} */
export const KINDS = [["all", "All"], ["doc", "Docs"], ["image", "Images"], ["page", "Pages"], ["code", "Code"], ["data", "Data"], ["link", "Links"], ["branch", "Branches"]];
/** @type {Record<Kind, string>} */
export const KIND_WORD = { image: "Image", page: "Page", doc: "Document", data: "Data", code: "Code", link: "Link", branch: "Branch" };

/** A text file's card page from its first bytes: a document's title and first words, else its first lines. @param {string | null | undefined} name @param {string | null | undefined} content @param {{ lines?: number, words?: number }} [opts] @returns {import("./types").Preview | null} */
export function previewOf(name, content, { lines: n = 14, words = 320 } = {}) {
  const src = String(content || "").replace(/\r\n?/g, "\n");
  if (!src.trim()) return null;
  const ext = (/\.([\w-]+)$/.exec(String(name || "")) || [])[1]?.toLowerCase() || "";
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    const ls = src.split("\n");
    const h = ls.find((l) => /^#{1,3}\s+\S/.test(l));
    const title = h ? h.replace(/^#+\s*/, "").trim() : null;
    const body = ls.filter((l) => l !== h && l.trim() && !/^(#|```|\||>|-{3,}|<)/.test(l.trim()))
      .map((l) => l.replace(/^[-*+]\s+|^\d+\.\s+/, "").replace(/[*_`]/g, "")).join(" ").replace(/\s+/g, " ").trim();
    return { kind: "doc", title, text: body.slice(0, words) };
  }
  return { kind: "lines", lines: src.split("\n").slice(0, n).map((l) => l.replace(/\t/g, "  ").slice(0, 120)) };
}

/** A file's own title: one line of words, or null (absent, null or blank all mean none). @param {unknown} t @returns {string | null} */
const fileTitle = (t) => (typeof t === "string" && t.trim() ? t.replace(/\s+/g, " ").trim() : null);

/** One key per file per thread, stable across reloads (pins are kept by it). @param {string} tid @param {string} path */
export const madeKey = (tid, path) => `${tid}|${path}`;

/** Everything the threads shared, newest thread first and its last shared file first; pins are flagged, not moved. @param {import("./types").MadeThread[]} threads @param {{ pins?: Set<string> }} [opts] @returns {Made[]} */
export function madeItems(threads, { pins = new Set() } = {}) {
  /** @type {Made[]} */
  const out = [];
  const ts = threads.filter((t) => t.outputs && t.outputs.length).slice().sort((a, b) => b.lastAt - a.lastAt);
  for (const t of ts) {
    const files = /** @type {import("./types").MadeFile[]} */ (t.outputs).slice().reverse();
    files.forEach((f, i) => {
      const path = f.path || f.name;
      if (!path) return;
      const key = madeKey(t.id, path);
      out.push({ key, tid: t.id, project: t.project, threadTitle: t.title || "", title: fileTitle(f.title), path, name: f.name || /** @type {string} */ (path.split("/").pop()), type: f.type || "", bytes: f.bytes ?? null,
        kind: madeKind(f), at: t.lastAt - i, pinned: pins.has(key) });
    });
  }
  return out;
}

/** @param {MadeRow[] | null | undefined} rows @param {import("./row-types").MadeOptions} [opts] @returns {Made[]} */
export function madeFromServer(rows, { project, threadTitle = () => "" } = {}) {
  return (rows || []).filter((r) => r && r.id).map((r) => {
    const name = r.name || (r.path || r.url || r.git?.branch || "").split("/").filter(Boolean).pop() || "Untitled";
    const kind = r.kind === "link" ? "link" : r.kind === "branch" ? "branch" : r.kind === "image" ? "image" : madeKind({ name, type: r.mime || "" });
    return { key: r.id, id: r.id, server: true, tid: r.thread_ts || null, project, threadTitle: threadTitle(r.thread_ts ?? "") || "", title: fileTitle(r.title), path: r.path || r.relative_path || r.url || name, name,
      type: r.mime || "", bytes: r.bytes ?? null, kind, at: Date.parse(r.updated_at || r.created_at || "") || 0, pinned: !!r.pinned,
      exists: r.exists !== false, url: r.url || null, git: r.git || null, turn: r.turn_id || null,
      fileProject: r.project_id || null, rel: r.relative_path || null };
  }).sort((a, b) => b.at - a.at);
}

/** Narrow made items by kind and words (its title, name and path, and the title of the thread that made it). @param {Made[]} items @param {{ kind?: string, q?: string }} [opts] */
export function filterMade(items, { kind = "all", q = "" } = {}) {
  const w = String(q || "").trim().toLowerCase();
  return items.filter((m) => (kind === "all" || m.kind === kind) && (!w || `${m.title || ""} ${m.name} ${m.path} ${m.threadTitle || ""}`.toLowerCase().includes(w)));
}

/** Made items in the groups the view shows: Pinned, Today, This week, Earlier (empty ones dropped). @param {Made[]} items @param {number} [now] @returns {import("./types").Group[]} */
export function madeGroups(items, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  /** @type {[string, string, Made[]][]} */
  const G = [["pinned", "Pinned", []], ["today", "Today", []], ["week", "This week", []], ["earlier", "Earlier", []]];
  for (const m of items) {
    const g = m.pinned ? 0 : m.at >= today ? 1 : m.at >= today - 6 * DAY_MS ? 2 : 3;
    G[g][2].push(m);
  }
  return G.filter((g) => g[2].length).map(([id, label, list]) => ({ id, label, items: list }));
}

/** The Artifacts page's counts per kind in the chosen project, and the whole set filtered and grouped; never only what's drawn. @param {Made[]} all @param {{ pid?: string, kind?: string, q?: string, now?: number }} [opts] */
export function artsView(all, { pid = "", kind = "all", q = "", now = Date.now() } = {}) {
  const inPj = pid ? all.filter((m) => m.project === pid) : all;
  /** @type {Record<string, number>} */
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, 0]));
  counts.all = inPj.length;
  for (const m of inPj) if (m.kind in counts) counts[m.kind]++;
  const list = filterMade(inPj, { kind, q });
  return { counts, total: list.length, groups: madeGroups(list, now) };
}

/** A chat's Made rows after reading a page (newest first): the page wins by id; `first` drops vanished newer rows; `complete` keeps only the page. @param {MadeRow[] | null | undefined} had @param {MadeRow[] | null | undefined} page @param {{ first?: boolean, complete?: boolean }} [opts] @returns {MadeRow[]} */
export function mergeMadeRows(had, page, { first = false, complete = false } = {}) {
  const fresh = (page || []).filter((r) => r && r.id);
  if (complete || !had || !had.length) return fresh;
  const ids = new Set(fresh.map((r) => r.id));
  /** @param {MadeRow} r */
  const at = (r) => r.updated_at || r.created_at || "";
  const oldest = fresh.length ? fresh.reduce((m, r) => (at(r) < m ? at(r) : m), at(fresh[0])) : "";
  const kept = had.filter((r) => !ids.has(r.id) && !(first && fresh.length && at(r) > oldest));
  return [...fresh, ...kept].sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0));
}

/** Where the next older page starts: one second after the last row's, since the Space's `before` is strict by the second. @param {string | null | undefined} nextBefore */
export function olderCursor(nextBefore) {
  const t = Date.parse(nextBefore || "");
  return Number.isFinite(t) ? new Date(t + 1000).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}
