// @ts-check

import { PIERRE } from "../../../vendor/pierre/icons.js";
import { xi } from "./icon.js";
import { XI } from "./xoicons.js";

/** @type {{ symbols: Record<string, { vb: string, body: string }>, names: Record<string, string>, exts: Record<string, string>, overrides: Record<string, string>, colors: Record<string, string[]> }} */
const { symbols, names, exts, overrides, colors } = PIERRE;
const GRAY = colors.default || ["#84848a", "#adadb1"];

/** @type {Record<string, string>} */
const OWN = { default: "file-default", text: "file-text", html: "file-code-html", json: "file-json", yml: "file-yaml",
  bash: "file-shell", image: "file-image", svg: "file-svg", font: "file-font", table: "file-table", database: "file-database",
  markdown: "file-markdown", zip: "file-archive", archive: "file-archive", pdf: "file-pdf", audio: "file-audio",
  video: "file-video" };
/** Kinds Pierre has no token for, by the last extension. @type {Record<string, string>} */
const KINDS = { pdf: "pdf", mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio", aac: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video", "7z": "archive", rar: "archive",
  bz2: "archive", xz: "archive", zst: "archive", tgz: "archive" };

/** @param {string} vb @param {string} body @param {string} token */
const draw = (vb, body, token) => {
  const [l, d] = colors[token] || GRAY;
  return `<svg class="fi" viewBox="${vb}" width="16" height="16" aria-hidden="true" data-fi="${token}" style="--fi-l:${l};--fi-d:${d}">${body}</svg>`;
};
/** @type {Map<string, string>} */
const cache = new Map();

/** Pierre's token for a file: its exact name, else its extensions from the longest, else "default". @param {unknown} name @returns {string} */
export function iconKey(name) {
  const file = /** @type {string} */ (String(name || "").split("/").pop());
  const lower = file.toLowerCase();
  if (names[lower]) return names[lower];
  const segs = lower.split(".");
  for (let i = 1; i < segs.length; i++) {
    const ext = segs.slice(i).join(".");
    if (overrides[ext]) return overrides[ext];
    if (exts[ext]) return exts[ext];
    const raw = file.split(".").slice(i).join(".");
    if (exts[raw]) return exts[raw]; // a few of Pierre's rules are keyed in capitals (LICENSE, CHANGELOG…)
  }
  if (exts[file]) return exts[file]; // a bare LICENSE, AUTHORS…
  if (segs.length > 1 && KINDS[segs[segs.length - 1]]) return KINDS[segs[segs.length - 1]];
  return "default";
}

/** The icon for a file, by its name or path. @param {unknown} name @returns {string} */
export function fileIcon(name) {
  const t = iconKey(name);
  if (!cache.has(t)) {
    const own = OWN[t] || (!symbols[t] && "file-default");
    const s = symbols[t];
    cache.set(t, own ? draw(XI[own][0], XI[own][1], OWN[t] ? t : "default") : draw(s.vb, s.body, t));
  }
  return /** @type {string} */ (cache.get(t));
}

export const FOLDER_ICON = xi("folder", "fi fi-line").replace("<svg ", '<svg data-fi="folder" ');
export const FOLDER_OPEN_ICON = xi("folder-open", "fi fi-line").replace("<svg ", '<svg data-fi="folder-open" ');
/** A folder's icon, open or not. */
export const folderIcon = (open = false) => (open ? FOLDER_OPEN_ICON : FOLDER_ICON);

/** A file's colour for the current theme (for a dot standing in for it), or null for a plain one. @param {unknown} name */
export function fileColor(name) {
  const c = colors[iconKey(name)];
  if (!c) return null;
  const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light ? c[0] : c[1];
}
