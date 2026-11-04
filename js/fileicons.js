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
// API (kept for every caller): fileIcon(name), folderIcon(open), iconKey(name), fileColor(name),
// FOLDER_ICON, FOLDER_OPEN_ICON. An icon is an inline <svg class="fi"> carrying its two colours as
// --fi-l / --fi-d; css/panel.css picks the one for the theme.

import { PIERRE } from "./vendor/pierre/icons.js";
import { LUCIDE } from "./vendor/lucide/files.js";

const { symbols, plainFile, names, exts, overrides, colors } = PIERRE;
const GRAY = colors.default || ["#84848a", "#adadb1"];

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
  return "default";
}

/** The icon for a file, by its name or path. */
export function fileIcon(name) {
  const t = iconKey(name);
  if (!cache.has(t)) {
    const s = symbols[t];
    cache.set(t, s ? draw(s.vb, s.body, t) : draw(plainFile.vb, plainFile.body, "default"));
  }
  return cache.get(t);
}

const line = (n, label) => `<svg class="fi fi-line" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-fi="${label}">${LUCIDE[n]}</svg>`;
export const FOLDER_ICON = line("folder", "folder");
export const FOLDER_OPEN_ICON = line("folder-open", "folder-open");
/** A folder's icon, open or not. */
export const folderIcon = (open = false) => (open ? FOLDER_OPEN_ICON : FOLDER_ICON);

/** A file's colour for the current theme (for a dot standing in for it), or null for a plain one. */
export function fileColor(name) {
  const c = colors[iconKey(name)];
  if (!c) return null;
  const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light ? c[0] : c[1];
}
