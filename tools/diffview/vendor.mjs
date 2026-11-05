// Vendors @pierre/diffs into js/vendor/pierre-diffs/: ES modules the page imports as they are, with no
// build step at run time. Development only; nothing here runs in the app.
//
//   mkdir /tmp/pv && cd /tmp/pv && npm init -y && npm i --ignore-scripts @pierre/diffs@1.6.4 esbuild@0.28.2
//   node tools/diffview/vendor.mjs /tmp/pv/node_modules
//
// What it makes:
//   diffs.js    FileDiff, File, parsePatchFiles, registerCustomTheme, the worker pool (js/diffview.js)
//   edit.js     the editor (Files › Edit), sharing the chunks above
//   worker.js   the highlighting worker (a module worker; languages and themes arrive from the page)
//   c/*.js      shared chunks and one chunk per language, each fetched on first use
//   manifest.json  the versions and a sha256 per file (tests/diffview.test.mjs checks them)
//   LICENSES.md the licence of every package inside the bundle
//
// What it leaves out, on purpose: every bundled colour theme (XO registers its own two, js/diffthemes.js),
// Shiki's WebAssembly engine (the JavaScript regex engine needs none), the Highlights backend and its
// theme catalogue (XO uses Shiki), and all but the languages below.

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const PIN = { "@pierre/diffs": "1.6.4", esbuild: "0.28.2" };
// Shiki language ids, each with its own aliases. A file of any other kind shows as plain text.
export const LANGS = [
  "javascript", "typescript", "jsx", "tsx", "json", "jsonc", "python", "go", "rust", "java", "kotlin", "swift",
  "c", "cpp", "csharp", "ruby", "php", "shellscript", "powershell", "sql", "yaml", "toml", "ini", "dotenv",
  "markdown", "css", "scss", "html", "xml", "vue", "svelte", "graphql", "diff", "docker", "make", "lua",
  "r", "dart", "scala", "elixir", "haskell", "perl", "proto", "terraform", "nginx", "latex",
];

const nm = resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(join(nm, "@pierre/diffs/package.json"))) {
  console.error("usage: node tools/diffview/vendor.mjs <node_modules with @pierre/diffs and esbuild>");
  process.exit(2);
}
const ver = (p) => JSON.parse(readFileSync(join(nm, p, "package.json"), "utf8")).version;
for (const [p, v] of Object.entries(PIN)) if (ver(p) !== v) { console.error(`${p} is ${ver(p)}, pinned to ${v}`); process.exit(2); }

const require = createRequire(join(nm, "noop.js"));
const esbuild = require("esbuild");
const { bundledLanguagesInfo } = await import(pathToFileURL(join(nm, "shiki/dist/langs.mjs")).href);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "js/vendor/pierre-diffs");
const tmp = mkdtempSync(join(tmpdir(), "pierre-diffs-"));

// the entries: only what js/diffview.js uses
writeFileSync(join(tmp, "diffs.js"), `export { FileDiff, File, VirtualizedFile, Virtualizer, UnresolvedFile, parsePatchFiles, parseDiffFromFile, registerCustomTheme, getSharedHighlighter } from "@pierre/diffs";
export { getOrCreateWorkerPoolSingleton } from "@pierre/diffs/worker";
`);
writeFileSync(join(tmp, "edit.js"), `export * from "@pierre/diffs/edit";\n`);
writeFileSync(join(tmp, "worker.js"), `import "@pierre/diffs/worker/worker.js";\n`);

// shiki/langs, cut to LANGS: the same map Shiki exports, so Pierre's resolveLanguage works unchanged
const info = LANGS.map((id) => {
  const l = bundledLanguagesInfo.find((x) => x.id === id);
  if (!l) throw new Error(`no Shiki language "${id}"`);
  return l;
});
const langsModule = `const L = {};\n` + info.map((l) => {
  const load = `() => import(${JSON.stringify(`@shikijs/langs/${l.id}`)})`;
  return [l.id, ...(l.aliases || [])].map((k) => `L[${JSON.stringify(k)}] = ${load};`).join("\n");
}).join("\n") + `\nexport const bundledLanguages = L;\nexport const bundledLanguagesInfo = ${JSON.stringify(info.map(({ id, name, aliases }) => ({ id, name, aliases })))};\n`;

const STUB = {
  "shiki/langs": langsModule,
  // themes: XO registers xo-dark and xo-light; no catalogue is ever needed
  "@pierre/theming/themes": `export const themes = { getTheme() { return null; } };`,
  "@pierre/highlights/themes/loader": `export const themes = {};`,
  "shiki/themes": `export const bundledThemes = {}; export const bundledThemesInfo = [];`,
  // engines: Shiki's JavaScript regex engine only
  "shiki/wasm": `export default null;`,
  "shiki/engine/oniguruma": `export function createOnigurumaEngine() { throw new Error("XO ships Shiki's JavaScript engine only"); }`,
  // the Highlights backend is never chosen (preferredHighlighter stays "shiki-js")
  "@pierre/highlights": `const no = () => { throw new Error("XO doesn't ship the Highlights backend"); };
export class LiveTokenizer { constructor() { no(); } }
export const codeToTokens = no, isSupportedLanguage = () => false;`,
};
const stubs = {
  name: "xo-stubs",
  setup(b) {
    const filter = new RegExp(`^(${Object.keys(STUB).map((k) => k.replace(/[/.]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter }, (a) => ({ path: a.path, namespace: "xo-stub" }));
    b.onLoad({ filter: /.*/, namespace: "xo-stub" }, (a) => ({ contents: STUB[a.path], loader: "js", resolveDir: nm }));
  },
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const res = await esbuild.build({
  entryPoints: { diffs: join(tmp, "diffs.js"), edit: join(tmp, "edit.js"), worker: join(tmp, "worker.js") },
  absWorkingDir: tmp,
  nodePaths: [nm],
  bundle: true, format: "esm", splitting: true, minify: true, target: "es2022", platform: "browser",
  outdir: OUT, entryNames: "[name]", chunkNames: "c/[name]-[hash]",
  legalComments: "none", metafile: true, logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [stubs],
});

// the licences of every package that ended up inside
const pkgs = new Map();
for (const input of Object.keys(res.metafile.inputs)) {
  const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input.replace(/\\/g, "/"));
  if (!m || pkgs.has(m[1])) continue;
  const dir = join(nm, m[1]);
  const lic = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  pkgs.set(m[1], { version: pj.version, license: pj.license, text: lic ? readFileSync(join(dir, lic), "utf8").trim() : `(${pj.license}; no licence file in the package)` });
}
const names = [...pkgs.keys()].sort();
writeFileSync(join(OUT, "LICENSES.md"), `# Licences of the code in this folder\n\n` + names.map((n) => { const p = pkgs.get(n); return `## ${n}@${p.version} (${p.license})\n\n\`\`\`\n${p.text}\n\`\`\`\n`; }).join("\n"));

// the manifest: every file and its sha256
const files = {};
const walk = (d) => { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files[relative(OUT, p)] = createHash("sha256").update(readFileSync(p)).digest("hex"); } };
walk(OUT);
const manifest = {
  package: "@pierre/diffs", version: PIN["@pierre/diffs"], esbuild: PIN.esbuild, shiki: ver("shiki"),
  languages: LANGS, bundled: Object.fromEntries(names.map((n) => [n, pkgs.get(n).version])), files,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
rmSync(tmp, { recursive: true, force: true });

const size = (f) => statSync(join(OUT, f)).size;
const total = Object.keys(files).reduce((a, f) => a + size(f), 0);
console.log(`js/vendor/pierre-diffs: ${Object.keys(files).length} files, ${(total / 1024).toFixed(0)} KB`);
for (const f of ["diffs.js", "edit.js", "worker.js"]) console.log(`  ${f}  ${(size(f) / 1024).toFixed(1)} KB`);
