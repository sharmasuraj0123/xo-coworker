// File icons: one resolver for every place a file shows (Files, Made, the viewer's header, the Map, a
// turn's file chips, links in chat), so a file looks the same everywhere.
//
// The set is Lucide's (js/vendor/lucide, ISC): quiet line glyphs in the text's own colour, the way
// Claude's own interface shows files. A file's kind is told by its glyph (code, data, text, image,
// sheet, archive, terminal, config…), matched by exact filename first (README, LICENSE, package.json,
// Dockerfile…), then by extension, with a plain page for anything else. Folders have an open state.
//
// API (kept for every caller): fileIcon(name), folderIcon(open), iconKey(name), fileColor(name) (null:
// the icons take the text's colour), FOLDER_ICON, FOLDER_OPEN_ICON.

import { LUCIDE } from "./vendor/lucide/files.js";

const svg = (name, label) => `<svg class="fi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-fi="${label}">${LUCIDE[name]}</svg>`;

// what each kind is drawn with
const GLYPH = {
  code: "file-code", data: "file-braces", config: "file-cog", text: "file-text", readme: "book-open", license: "scale",
  sheet: "file-spreadsheet", db: "file-database", shell: "file-terminal", image: "file-image", font: "file-type",
  archive: "file-archive", lock: "file-lock", secret: "file-key", diff: "file-diff", container: "file-box", file: "file",
};
const ICONS = Object.fromEntries(Object.entries(GLYPH).map(([k, n]) => [k, svg(n, k)]));

export const FOLDER_ICON = svg("folder", "folder");
export const FOLDER_OPEN_ICON = svg("folder-open", "folder-open");

const BY_NAME = {
  "package.json": "data", "package-lock.json": "lock", "yarn.lock": "lock", "pnpm-lock.yaml": "lock", "bun.lockb": "lock",
  "cargo.lock": "lock", "poetry.lock": "lock", "uv.lock": "lock", "gemfile.lock": "lock", "go.sum": "lock",
  "dockerfile": "container", "docker-compose.yml": "container", "docker-compose.yaml": "container", "compose.yaml": "container", ".dockerignore": "container",
  ".gitignore": "config", ".gitattributes": "config", ".gitmodules": "config", ".editorconfig": "config", ".prettierrc": "config",
  ".eslintrc": "config", ".npmrc": "config", ".nvmrc": "config", "makefile": "config", "procfile": "config",
  "license": "license", "licence": "license", "copying": "license",
};
const BY_EXT = {
  // code
  js: "code", mjs: "code", cjs: "code", ts: "code", mts: "code", cts: "code", jsx: "code", tsx: "code", py: "code", pyi: "code",
  html: "code", htm: "code", css: "code", scss: "code", sass: "code", less: "code", go: "code", rs: "code", java: "code", kt: "code",
  kts: "code", rb: "code", php: "code", c: "code", h: "code", cc: "code", cpp: "code", hpp: "code", cs: "code", swift: "code",
  vue: "code", svelte: "code", xml: "code", plist: "code", lua: "code", dart: "code", scala: "code", ex: "code", exs: "code",
  // data and config
  json: "data", jsonl: "data", json5: "data", ipynb: "data", yaml: "config", yml: "config", toml: "config", ini: "config",
  cfg: "config", conf: "config", env: "secret", pem: "secret", key: "secret", lock: "lock",
  // words
  md: "text", mdx: "text", markdown: "text", txt: "text", rst: "text", log: "text", pdf: "text", doc: "text", docx: "text", rtf: "text",
  csv: "sheet", tsv: "sheet", xlsx: "sheet", xls: "sheet", sql: "db", sqlite: "db", db: "db",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell", ps1: "shell", bat: "shell",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", avif: "image", bmp: "image", ico: "image", svg: "image",
  woff: "font", woff2: "font", ttf: "font", otf: "font", eot: "font",
  zip: "archive", gz: "archive", tgz: "archive", tar: "archive", bz2: "archive", xz: "archive", "7z": "archive", rar: "archive",
  diff: "diff", patch: "diff",
};

/** Which kind a file is: its exact name first, then README / LICENSE / .env* by prefix, then its extension. */
export function iconKey(name) {
  const n = String(name || "").split("/").pop().toLowerCase();
  if (BY_NAME[n]) return BY_NAME[n];
  if (/^readme(\.|$)/.test(n)) return "readme";
  if (/^licen[cs]e(\.|$)/.test(n)) return "license";
  if (/^\.env(\.|$)/.test(n) || n === ".envrc") return "secret";
  const m = /\.([a-z0-9]+)$/.exec(n);
  return (m && BY_EXT[m[1]]) || "file";
}

/** The icon for a file, by its name or path. */
export function fileIcon(name) { return ICONS[iconKey(name)] || ICONS.file; }
/** A folder's icon, open or not. */
export const folderIcon = (open = false) => (open ? FOLDER_OPEN_ICON : FOLDER_ICON);
/** A file's own colour: none, the icons take the text's colour (kept for callers). */
export function fileColor() { return null; }
