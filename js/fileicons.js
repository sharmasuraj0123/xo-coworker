// File icons: one resolver for every place a file shows (Files, Made, the viewer's header, the Map, a
// turn's file chips), so a file looks the same everywhere and is known before its name is read.
//
// The idea is VS Code's Seti and the swarm's Pierre Trees icons: identity by shape and colour, matched
// by exact filename first (package.json, Dockerfile, README…), then by extension, with a plain page
// for anything unknown. Code gets a small coloured tile with its letters (JS, TS, PY…), the way
// JetBrains and Seti tell languages apart at a glance; documents, data, images, fonts and archives get
// a drawn glyph in their colour. Folders stay quiet: outline, with a distinct open state.
//
// Hand-drawn, inline, no dependency: the UI has no build step and loads nothing from a CDN.
// 16 px on a 16 px grid; only the glyph is coloured, never the row.

const svg = (body, label) => `<svg class="fi" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"${label ? ` data-fi="${label}"` : ""}>${body}</svg>`;

/** A coloured tile with one to three letters: a language. `ink` is the letters' colour. */
const tile = (letters, bg, ink = "#fff") => {
  const txt = letters.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fs = letters.length >= 3 ? 5.2 : 6.4;
  return svg(`<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="${bg}"/><text x="8" y="${letters.length >= 3 ? 10.1 : 10.4}" text-anchor="middle" font-family="'Geist Mono',ui-monospace,monospace" font-size="${fs}" font-weight="700" letter-spacing="-.2" fill="${ink}">${txt}</text>`, letters.toLowerCase().replace(/[^a-z0-9+#]/g, "") || "code");
};
/** A page (a document) with a coloured mark on it. */
const page = (mark, color, label) => svg(`<path d="M4 1.75h5.25L12.5 5v8.75a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75v-11.25a.75.75 0 0 1 .75-.75z" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 1.9V5.2h3.3" fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>${mark}`, label);

const C = {
  js: "#E5C02E", ts: "#3178C6", react: "#3EB8D8", py: "#3E7CB1", html: "#E2552B", css: "#3D8FE0", scss: "#CD6799",
  json: "#C7A93D", yaml: "#A074C4", md: "#5E9FCE", sh: "#4EAA56", go: "#00ACD7", rs: "#C7704C", java: "#E0703A",
  kt: "#8F6EE8", rb: "#D4423C", php: "#7A86B8", c: "#5C8FD1", cpp: "#6C7FD8", cs: "#58A14E", swift: "#F0623C",
  sql: "#DF8B2A", img: "#A675D6", svg: "#F0A33A", pdf: "#E5534B", font: "#9AA0A6", zip: "#B5925C", txt: "#9AA0A6",
  csv: "#5AA65A", lock: "#8C8C8C", git: "#E8603C", docker: "#2496ED", env: "#D8B53B", npm: "#CB3837", lic: "#D0B13E",
  info: "#5E9FCE", vue: "#41B883", svelte: "#F0602D", diff: "#41B883", log: "#8C8C8C", xml: "#E37933", sql2: "#DF8B2A",
};

const ICONS = {
  js: tile("JS", C.js, "#1C1C1C"), ts: tile("TS", C.ts), jsx: tile("JSX", C.react, "#10232B"), tsx: tile("TSX", C.react, "#10232B"),
  py: tile("PY", C.py), html: tile("<>", C.html), css: tile("#", C.css), scss: tile("S", C.scss), go: tile("GO", C.go),
  rs: tile("RS", C.rs), java: tile("JV", C.java), kt: tile("KT", C.kt), rb: tile("RB", C.rb), php: tile("PHP", C.php),
  c: tile("C", C.c), cpp: tile("C+", C.cpp), h: tile("H", C.c), cs: tile("C#", C.cs), swift: tile("SW", C.swift),
  sql: tile("SQL", C.sql), vue: tile("V", C.vue, "#0E2A1E"), svelte: tile("SV", C.svelte), sh: tile(">_", C.sh),
  json: svg(`<path d="M5.6 2.5c-1.6 0-1.6 1.2-1.6 2.3 0 1.3-.4 2.2-1.6 2.7v.9c1.2.5 1.6 1.4 1.6 2.7 0 1.1 0 2.4 1.6 2.4M10.4 2.5c1.6 0 1.6 1.2 1.6 2.3 0 1.3.4 2.2 1.6 2.7v.9c-1.2.5-1.6 1.4-1.6 2.7 0 1.1 0 2.4-1.6 2.4" fill="none" stroke="${C.json}" stroke-width="1.35" stroke-linecap="round"/>`, "json"),
  yaml: svg(`<path d="M2.5 4h11M2.5 8h7M2.5 12h9" stroke="${C.yaml}" stroke-width="1.5" stroke-linecap="round"/><circle cx="12.5" cy="8" r="1.1" fill="${C.yaml}"/>`, "yaml"),
  md: svg(`<rect x="1.25" y="3.25" width="13.5" height="9.5" rx="2" fill="none" stroke="${C.md}" stroke-width="1.2"/><path d="M3.8 10.2V5.8l1.7 2 1.7-2v4.4M10.8 5.8v4.2M9.3 8.7l1.5 1.5 1.5-1.5" fill="none" stroke="${C.md}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`, "md"),
  txt: page(`<path d="M5.5 8h5M5.5 10.3h5M5.5 12.6h3" stroke="${C.txt}" stroke-width="1" stroke-linecap="round"/>`, C.txt, "txt"),
  log: page(`<path d="M5.5 8h5M5.5 10.3h3.5M5.5 12.6h5" stroke="${C.log}" stroke-width="1" stroke-linecap="round"/>`, C.log, "log"),
  csv: svg(`<rect x="2" y="2.5" width="12" height="11" rx="1.8" fill="none" stroke="${C.csv}" stroke-width="1.2"/><path d="M2 6.2h12M2 9.8h12M6.2 2.5v11" stroke="${C.csv}" stroke-width="1.05"/>`, "csv"),
  xml: tile("</>", C.xml),
  img: svg(`<rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" fill="none" stroke="${C.img}" stroke-width="1.2"/><circle cx="5.6" cy="6.2" r="1.25" fill="${C.img}"/><path d="M2.4 12.2l3.6-3.7 2.6 2.4 2-1.9 3.2 3.1" fill="none" stroke="${C.img}" stroke-width="1.2" stroke-linejoin="round"/>`, "image"),
  svg: svg(`<path d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5z" fill="none" stroke="${C.svg}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="${C.svg}"/>`, "svg"),
  pdf: page(`<rect x="3.9" y="8.4" width="8.2" height="4.2" rx="1" fill="${C.pdf}"/><text x="8" y="11.65" text-anchor="middle" font-family="'Geist Mono',ui-monospace,monospace" font-size="3.4" font-weight="700" fill="#fff">PDF</text>`, C.pdf, "pdf"),
  font: svg(`<path d="M2.2 13 5.6 3.4h.9L9.9 13M3.5 9.6h5.1" fill="none" stroke="${C.font}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.6 8.2v4.8M13.6 9.7c-.4-1-1.2-1.5-2-1.5-1.1 0-1.9.9-1.9 2.4s.8 2.4 1.9 2.4c.8 0 1.6-.5 2-1.5" fill="none" stroke="${C.font}" stroke-width="1.2" stroke-linecap="round"/>`, "font"),
  zip: svg(`<rect x="2.5" y="1.75" width="11" height="12.5" rx="2" fill="none" stroke="${C.zip}" stroke-width="1.2"/><path d="M8 1.9v1.6M8 4.6v1.6M8 7.3v1.4" stroke="${C.zip}" stroke-width="1.3"/><rect x="6.6" y="9.4" width="2.8" height="2.6" rx=".6" fill="${C.zip}"/>`, "archive"),
  lock: svg(`<rect x="3" y="7" width="10" height="7" rx="1.8" fill="none" stroke="${C.lock}" stroke-width="1.2"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7" fill="none" stroke="${C.lock}" stroke-width="1.2"/><circle cx="8" cy="10.5" r="1" fill="${C.lock}"/>`, "lock"),
  git: svg(`<path d="M8 1.9 14.1 8 8 14.1 1.9 8z" fill="${C.git}"/><circle cx="8" cy="5.4" r="1" fill="#fff"/><circle cx="8" cy="10.6" r="1" fill="#fff"/><circle cx="10.5" cy="8" r="1" fill="#fff"/><path d="M8 5.4v5.2M8 5.4l2.5 2.6" stroke="#fff" stroke-width=".9"/>`, "git"),
  docker: svg(`<path d="M1.8 8.3h11.6c.5-1 1.3-1.5 2.1-1.4-.3 3.7-3.2 6.4-7.4 6.4-3.4 0-5.6-1.9-6.3-5z" fill="${C.docker}"/><path d="M3.5 6.2h2v1.6h-2zM5.9 6.2h2v1.6h-2zM8.3 6.2h2v1.6h-2zM5.9 3.8h2v1.6h-2zM8.3 3.8h2v1.6h-2z" fill="${C.docker}"/>`, "docker"),
  env: svg(`<circle cx="5.2" cy="8" r="2.9" fill="none" stroke="${C.env}" stroke-width="1.3"/><path d="M8.1 8h6.2M12.2 8v2.4M14.2 8v1.6" stroke="${C.env}" stroke-width="1.3" stroke-linecap="round"/>`, "env"),
  npm: tile("npm", C.npm),
  license: svg(`<circle cx="8" cy="6.4" r="3.9" fill="none" stroke="${C.lic}" stroke-width="1.2"/><path d="M5.6 9.6 4.6 14l3.4-1.6L11.4 14l-1-4.4" fill="none" stroke="${C.lic}" stroke-width="1.15" stroke-linejoin="round"/>`, "license"),
  readme: svg(`<circle cx="8" cy="8" r="6.2" fill="none" stroke="${C.info}" stroke-width="1.25"/><path d="M8 7.2v4" stroke="${C.info}" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="4.9" r=".9" fill="${C.info}"/>`, "readme"),
  diff: svg(`<path d="M5 2.5v6M2 5.5h6M2.5 12h6" stroke="${C.diff}" stroke-width="1.4" stroke-linecap="round"/><path d="M11 3.5v9" stroke="${C.diff}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`, "diff"),
  config: svg(`<circle cx="8" cy="8" r="2.1" fill="none" stroke="#9AA0A6" stroke-width="1.25"/><path d="M8 1.9v1.8M8 12.3v1.8M1.9 8h1.8M12.3 8h1.8M3.7 3.7l1.3 1.3M11 11l1.3 1.3M3.7 12.3 5 11M11 5l1.3-1.3" stroke="#9AA0A6" stroke-width="1.25" stroke-linecap="round"/>`, "config"),
  file: page("", "currentColor", "file"),
};

// folders: quiet, in the text's own colour; open is visibly open
export const FOLDER_ICON = svg(`<path d="M1.75 12.6V3.9c0-.6.5-1.15 1.15-1.15h3.2l1.6 1.7h5.4c.6 0 1.15.5 1.15 1.15v7c0 .6-.5 1.15-1.15 1.15H2.9c-.6 0-1.15-.5-1.15-1.15z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`, "folder");
export const FOLDER_OPEN_ICON = svg(`<path d="M1.75 12.4V3.9c0-.6.5-1.15 1.15-1.15h3.2l1.6 1.7h4.9c.6 0 1.15.5 1.15 1.15v1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M1.9 12.9 3.6 7.6c.15-.5.6-.85 1.1-.85h9.2c.55 0 .95.55.8 1.05l-1.5 4.6c-.15.5-.6.85-1.1.85H2.6c-.5 0-.85-.45-.7-.95z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`, "folder-open");

const BY_NAME = {
  "package.json": "npm", "package-lock.json": "lock", "yarn.lock": "lock", "pnpm-lock.yaml": "lock", "bun.lockb": "lock",
  "cargo.lock": "lock", "poetry.lock": "lock", "uv.lock": "lock", "gemfile.lock": "lock", "go.sum": "lock",
  "dockerfile": "docker", "docker-compose.yml": "docker", "docker-compose.yaml": "docker", "compose.yaml": "docker", ".dockerignore": "docker",
  ".gitignore": "git", ".gitattributes": "git", ".gitmodules": "git", ".gitkeep": "git",
  "license": "license", "license.md": "license", "license.txt": "license", "copying": "license",
  "makefile": "config", "procfile": "config", ".editorconfig": "config", ".prettierrc": "config", ".eslintrc": "config",
  "tsconfig.json": "ts", "jsconfig.json": "js", ".nvmrc": "config", ".npmrc": "npm",
};
const BY_EXT = {
  js: "js", mjs: "js", cjs: "js", ts: "ts", mts: "ts", cts: "ts", "d.ts": "ts", jsx: "jsx", tsx: "tsx",
  py: "py", pyi: "py", ipynb: "py", html: "html", htm: "html", css: "css", scss: "scss", sass: "scss", less: "css",
  json: "json", jsonl: "json", json5: "json", yaml: "yaml", yml: "yaml", toml: "yaml", ini: "yaml", cfg: "yaml", conf: "yaml",
  md: "md", mdx: "md", markdown: "md", txt: "txt", rst: "txt", log: "log", csv: "csv", tsv: "csv", xml: "xml", plist: "xml",
  sh: "sh", bash: "sh", zsh: "sh", fish: "sh", ps1: "sh", go: "go", rs: "rs", java: "java", kt: "kt", kts: "kt",
  rb: "rb", php: "php", c: "c", h: "h", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "cs", swift: "swift", sql: "sql",
  vue: "vue", svelte: "svelte", png: "img", jpg: "img", jpeg: "img", gif: "img", webp: "img", avif: "img", bmp: "img", ico: "img",
  svg: "svg", pdf: "pdf", woff: "font", woff2: "font", ttf: "font", otf: "font", eot: "font",
  zip: "zip", gz: "zip", tgz: "zip", tar: "zip", bz2: "zip", xz: "zip", "7z": "zip", rar: "zip",
  lock: "lock", diff: "diff", patch: "diff", env: "env", pem: "lock", key: "lock",
};

/** Which icon a file gets: its exact name first, then README / .env* by prefix, then its extension. */
export function iconKey(name) {
  const n = String(name || "").split("/").pop().toLowerCase();
  if (BY_NAME[n]) return BY_NAME[n];
  if (/^readme(\.|$)/.test(n)) return "readme";
  if (/^\.env(\.|$)/.test(n) || n === ".envrc") return "env";
  if (/^license|^licence/.test(n)) return "license";
  if (n.endsWith(".d.ts")) return "ts";
  const m = /\.([a-z0-9]+)$/.exec(n);
  return (m && BY_EXT[m[1]]) || "file";
}

/** The icon for a file, by its name or path. */
export function fileIcon(name) { return ICONS[iconKey(name)] || ICONS.file; }
const KEY_COLOR = { js: C.js, ts: C.ts, jsx: C.react, tsx: C.react, py: C.py, html: C.html, css: C.css, scss: C.scss, go: C.go, rs: C.rs,
  java: C.java, kt: C.kt, rb: C.rb, php: C.php, c: C.c, cpp: C.cpp, h: C.c, cs: C.cs, swift: C.swift, sql: C.sql, vue: C.vue,
  svelte: C.svelte, sh: C.sh, json: C.json, yaml: C.yaml, md: C.md, csv: C.csv, xml: C.xml, img: C.img, svg: C.svg, pdf: C.pdf,
  zip: C.zip, git: C.git, docker: C.docker, env: C.env, npm: C.npm, license: C.lic, readme: C.info, diff: C.diff };
/** A file's colour (its icon's), or null for one with no colour of its own: for a dot standing in for it. */
export function fileColor(name) { return KEY_COLOR[iconKey(name)] || null; }
/** A folder's icon, open or not. */
export const folderIcon = (open = false) => (open ? FOLDER_OPEN_ICON : FOLDER_ICON);
