// File icons: one resolver for every place a file shows (Files, Made, the viewer's header, the Map, a
// turn's file chips, links in chat), so a file looks the same everywhere.
//
// The set is the swarm's: Pierre Trees' "complete" coloured icons (js/vendor/pierre, Apache-2.0), its
// glyphs, its filename and extension rules and its colours, each with a light-theme and a dark-theme
// value. A file is matched as Pierre matches it: exact filename (package.json, Dockerfile,
// vite.config.ts…), then each extension from the longest (".d.ts", ".env.local") to the last, with
// its plain page for anything else. Folders keep a quiet line glyph (Pierre shows folders by their
// chevron; the Map and Made still want a folder mark).
//
// The plain kinds are the owner's (assets/icons/xo/i-file-types, 19 Nov): a page, text, code, data, a picture… drawn
// in their kind's colour; other projects' marks (TypeScript, React, Docker…) stay theirs, from Pierre. Archives
// (.zip, .tar, .gz…) have their own icon now. Folders are the owner's folder and open folder.
//
// API (kept for every caller): fileIcon(name), folderIcon(open), iconKey(name), fileColor(name),
// FOLDER_ICON, FOLDER_OPEN_ICON. An icon is an inline <svg class="fi"> carrying its two colours as
// --fi-l / --fi-d; css/panel.css picks the one for the theme.

import { PIERRE } from "./vendor/pierre/icons.js";
import { xi } from "./icon.js";
import { XI } from "./xoicons.js";

const { symbols, plainFile, names, exts, overrides, colors } = PIERRE;
const GRAY = colors.default || ["#84848a", "#adadb1"];

// Pierre's plain kinds → the owner's file icons (the rest of Pierre's tokens are other projects' marks)
const OWN = { default: "file-default", text: "file-text", html: "file-code-html", json: "file-json", yml: "file-yaml",
  bash: "file-shell", image: "file-image", svg: "file-svg", font: "file-font", table: "file-table", database: "file-database",
  markdown: "file-markdown", zip: "file-archive", archive: "file-archive", pdf: "file-pdf", audio: "file-audio",
  video: "file-video" };
// kinds Pierre has no token for, by the last extension
const KINDS = { pdf: "pdf", mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio", aac: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video", "7z": "archive", rar: "archive",
  bz2: "archive", xz: "archive", zst: "archive", tgz: "archive" };

const draw = (vb, body, token) => {
  const [l, d] = colors[token] || GRAY;
  return `<svg class="fi" viewBox="${vb}" width="16" height="16" aria-hidden="true" data-fi="${token}" style="--fi-l:${l};--fi-d:${d}">${body}</svg>`;
};
const cache = new Map();

/** Pierre's token for a file: its exact name, else its extensions from the longest, else "default". */
export function iconKey(name) {
  const file = String(name || "").split("/").pop();
  const lower = file.toLowerCase();
  if (names[lower]) return names[lower];
  const segs = lower.split(".");
  for (let i = 1; i < segs.length; i++) {
    const ext = segs.slice(i).join(".");
    if (overrides[ext]) return overrides[ext];
    if (exts[ext]) return exts[ext];
    // a few of Pierre's rules are keyed in capitals (LICENSE, CHANGELOG…)
    const raw = file.split(".").slice(i).join(".");
    if (exts[raw]) return exts[raw];
  }
  if (exts[file]) return exts[file]; // a bare LICENSE, AUTHORS…
  if (segs.length > 1 && KINDS[segs[segs.length - 1]]) return KINDS[segs[segs.length - 1]];
  return "default";
}

/** The icon for a file, by its name or path. */
export function fileIcon(name) {
  const t = iconKey(name);
  if (!cache.has(t)) {
    const own = OWN[t] || (!symbols[t] && "file-default");
    const s = symbols[t];
    cache.set(t, own ? draw(XI[own][0], XI[own][1], OWN[t] ? t : "default") : draw(s.vb, s.body, t));
  }
  return cache.get(t);
}

export const FOLDER_ICON = xi("folder", "fi fi-line").replace("<svg ", '<svg data-fi="folder" ');
export const FOLDER_OPEN_ICON = xi("folder-open", "fi fi-line").replace("<svg ", '<svg data-fi="folder-open" ');
/** A folder's icon, open or not. */
export const folderIcon = (open = false) => (open ? FOLDER_OPEN_ICON : FOLDER_ICON);

/** A file's colour for the current theme (for a dot standing in for it), or null for a plain one. */
export function fileColor(name) {
  const c = colors[iconKey(name)];
  if (!c) return null;
  const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light ? c[0] : c[1];
}
