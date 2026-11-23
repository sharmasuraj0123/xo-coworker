// @ts-check

import { esc, isImagePath } from "../../platform/index.js";
import { attachmentUrl } from "../../platform/api.js";
import { titleOf } from "../world/rows.js";
import { dim, safeTint } from "./layout.js";

/** @import { MadeRef, MediaDate, FileRoute, MediaInput, SharedFile } from "./types.d.ts" */

/** The made ids a list of files carries. @param {readonly (MadeRef | null | undefined)[] | null | undefined} files */
export function madeIds(files) {
  return new Set((files || []).map((f) => f && f.made_id).filter(Boolean).map(String));
}

/** A turn's shared files less the ones a message already carries (same made_id): never the same picture twice. @template {MadeRef | null | undefined} T @param {readonly T[] | null | undefined} files @param {Set<string> | readonly (MadeRef | null | undefined)[] | null | undefined} carried */
export function dedupeByMade(files, carried) {
  const c = carried instanceof Set ? carried : madeIds(carried);
  return (files || []).filter((f) => !(f && f.made_id && c.has(String(f.made_id))));
}

/** How much of a stem's end a cut name keeps: enough for "-v2", "final", "320". */
export const TAIL = 5;
/** A file name's stem and its extension (".png"; "" for none, a dotfile, or a dot that ends no extension). @param {unknown} name */
export function splitExt(name) {
  const s = String(name ?? "");
  const m = /^(.+?)(\.[A-Za-z0-9]{1,10})$/.exec(s);
  return m ? { stem: m[1], ext: m[2] } : { stem: s, ext: "" };
}
/** @param {unknown} name */
export function midName(name, max = 32) {
  const s = String(name ?? "");
  if (s.length <= max) return s;
  const { stem, ext } = splitExt(s);
  let tail = Math.min(TAIL, stem.length - 1);
  let head = max - 1 - tail - ext.length;
  if (head < 1) { tail = Math.max(0, tail + head - 1); head = 1; }
  if (head + 1 + tail + ext.length > max) return s.slice(0, Math.max(1, max - 1)) + "…"; // no room for the extension
  return stem.slice(0, head) + "…" + (tail ? stem.slice(-tail) : "") + ext;
}
/** @param {unknown} name */
export function midNameHtml(name, after = "") {
  const s = String(name ?? "");
  const { stem, ext } = splitExt(s);
  const tail = Math.min(TAIL, stem.length - 1);
  if (s.length <= 12 || tail < 1) return esc(s + after);
  return `<span class="mx-mid"><span class="mx-mh">${esc(stem.slice(0, -tail))}</span><span class="mx-mt">${esc(stem.slice(-tail) + ext + after)}</span></span>`;
}
/** What names an item: its title, else its file name. @param {{title?: string | null, name?: string | null} | null | undefined} it */
export const labelOf = (it) => (it && (it.title || it.name)) || "";


const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml|bmp|x-icon|vnd\.microsoft\.icon)$/i;
/** A picture the conversation shows, from the server's type, else the name. @param {unknown} type @param {string | null | undefined} name */
export const isPicture = (type, name) => (type ? IMAGE_TYPE.test(String(type)) : isImagePath(name));

/** A plain item (the demo builds its own; the adapters below build theirs). @param {MediaInput} raw */
export function mediaItem(raw) {
  const name = String(raw.name || String(raw.path || "").split("/").pop() || "file");
  const type = String(raw.type || "");
  const it = {
    key: String(raw.key || (raw.src ? `src:${raw.src}` : `name:${name}`)),
    name, title: titleOf(raw.title) || null, type, bytes: raw.bytes ?? null,
    w: dim(raw.w), h: dim(raw.h), tint: safeTint(raw.tint),
    made: raw.made_id ? String(raw.made_id) : raw.made || null,
    by: raw.by || "", at: raw.at ?? null,
    src: raw.src || null, att: raw.att || null, project: raw.project || null, rel: raw.rel || null,
    path: raw.path || null, why: raw.why || null, web: raw.web || null,
  };
  const readable = !!(it.src || it.att || (it.project && it.rel));
  return { ...it, kind: it.web || (readable && isPicture(type, name)) ? "image" : "file" };
}

/** @param {{alt?: string, url: string}} source @param {{at?: MediaDate}} [options] */
export function fromWebImage({ alt = "", url }, { at = null } = {}) {
  let host = "", file = "";
  try { const u = new URL(url); host = u.host.replace(/^www\./i, ""); file = decodeURIComponent(u.pathname.split("/").pop() || ""); } catch { /* checked by markdown.js */ }
  return mediaItem({ key: `web:${url}`, name: file || host || "picture", title: alt, src: url, web: { url, host }, by: host, at });
}

/** @param {string} project @param {string} rel @param {string | number | null | undefined} mtime */
const prjKey = (project, rel, mtime) => `prj:${project}:${rel}${mtime ? `@${mtime}` : ""}`;

/** @param {SharedFile} f @param {{chat?: string | null, by?: string, at?: MediaDate}} [options] */
export function fromAttachment(f, { chat = null, by = "", at = null } = {}) {
  const c = f.chat || chat;
  const base = { name: f.name, title: f.title, type: f.type, bytes: f.bytes ?? f.size, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, by, at };
  if (f.id && c) return mediaItem({ ...base, key: `att:${c}:${f.id}`, att: { chat: c, id: String(f.id) }, src: attachmentUrl(c, f.id) });
  if (f.project_id && f.relative_path) return mediaItem({ ...base, key: prjKey(f.project_id, f.relative_path, f.mtime), project: String(f.project_id), rel: String(f.relative_path), path: f.path || f.relative_path });
  return mediaItem({ ...base, key: `none:${f.name || ""}` }); // not uploaded yet: a card that can't open
}

/** @param {SharedFile} f @param {{route?: ((path: string | null | undefined) => FileRoute | null | undefined) | null, by?: string, at?: MediaDate}} [options] */
export function fromSharedFile(f, { route = null, by = "", at = null } = {}) {
  const base = { name: f.name || f.path, title: f.title, type: f.type, bytes: f.bytes, w: f.w, h: f.h, tint: f.tint, made_id: f.made_id, path: f.path || f.name, by, at };
  const r = f.project_id && f.relative_path ? { project: String(f.project_id), rel: String(f.relative_path) } : route ? route(f.path || f.name) : null;
  if (r && r.project && r.rel) return mediaItem({ ...base, key: prjKey(r.project, r.rel, f.mtime), project: r.project, rel: r.rel });
  return mediaItem({ ...base, key: `path:${f.path || f.name}`, why: (r && r.why) || "This file is in a folder XO doesn't serve to the UI yet." });
}

/** What the side viewer (js/viewer.js) opens for an item. @param {ReturnType<typeof mediaItem>} it */
export function viewerFile(it) {
  const base = { name: it.name, type: it.type, bytes: it.bytes };
  if (it.att) return { ...base, att: it.att };
  if (it.project && it.rel) return { ...base, path: it.path || it.rel, project: it.project, rel: it.rel };
  return { ...base, path: it.path || it.name, why: it.why || "This file can't be opened here." };
}
