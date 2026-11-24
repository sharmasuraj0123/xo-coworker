// Build both CodeMirror entries together so they share one copy of editor state.

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const PIN = {
  "@codemirror/state": "6.7.6", "@codemirror/view": "6.43.15", "@codemirror/commands": "6.11.1",
  "@codemirror/search": "6.7.2", "@codemirror/language": "6.13.1", "@codemirror/autocomplete": "6.20.4",
  "@codemirror/merge": "6.12.3", "@codemirror/lang-markdown": "6.5.2", "@codemirror/language-data": "6.5.2",
  "@lezer/highlight": "1.2.5", "@lezer/markdown": "1.8.1", "@lezer/common": "1.5.5", esbuild: "0.28.2",
};

// cm.js: package → the names it re-exports ("*" = every export of the package, minus DROP)
const CM = [
  ["@codemirror/state", "*"],
  ["@codemirror/view", "*"],
  ["@codemirror/commands", "*"],
  ["@codemirror/search", "*"],
  ["@codemirror/language", "*"],
  ["@codemirror/autocomplete", "*"],
  ["@codemirror/lang-markdown", "*"],
  ["@lezer/highlight", "*"],
  ["@lezer/common", "*"],
  // Markdown parser extensions for markdown({ extensions }); `Line` is @codemirror/state's (OWNER)
  ["@lezer/markdown", ["GFM", "Table", "TaskList", "Strikethrough", "Autolink", "Emoji", "Subscript", "Superscript",
    "MarkdownParser", "parseCode", "BlockContext", "InlineContext", "LeafBlock", "Element", "parser as markdownParser"]],
  ["@codemirror/language-data", ["languages"]],
];
const MERGE = [["@codemirror/merge", "*"]];
// internal names nobody should import
const DROP = new Set(["__test"]);
// a name more than one package exports → the package cm.js takes it from
const OWNER = { Line: "@codemirror/state" };

const nm = resolve(process.argv[2] || "");
if (!process.argv[2] || !existsSync(join(nm, "@codemirror/state/package.json"))) {
  console.error("usage: node tools/codemirror/vendor.mjs <node_modules with the packages in PIN and esbuild>");
  process.exit(2);
}
const ver = (p) => JSON.parse(readFileSync(join(nm, p, "package.json"), "utf8")).version;
for (const [p, v] of Object.entries(PIN)) if (ver(p) !== v) { console.error(`${p} is ${ver(p)}, pinned to ${v}`); process.exit(2); }
// one @codemirror/state, nowhere nested
const nested = [];
const seek = (d, depth) => { if (depth > 4 || !existsSync(d)) return; for (const f of readdirSync(d)) { const p = join(d, f); if (!statSync(p).isDirectory()) continue; if (f === "node_modules") { if (existsSync(join(p, "@codemirror/state"))) nested.push(p); } seek(p, depth + 1); } };
seek(join(nm, "@codemirror"), 0);
if (nested.length) { console.error(`a second @codemirror/state is installed under ${nested.join(", ")}`); process.exit(2); }

const require = createRequire(join(nm, "noop.js"));
const esbuild = require("esbuild");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "vendor/codemirror");
const tmp = mkdtempSync(join(tmpdir(), "codemirror-"));

// the names each package exports, read by importing it (Node has `navigator`; nothing touches `document`
// at module load). Then the entry modules, every name written out once.
const esm = (p) => { const j = JSON.parse(readFileSync(join(nm, p, "package.json"), "utf8")); return join(nm, p, j.exports?.import || j.exports?.["."]?.import || j.module); };
const namesOf = async (p) => Object.keys(await import(pathToFileURL(esm(p)).href)).filter((k) => k !== "default");
const entry = async (spec) => {
  const by = new Map(); // exported name → package
  const lines = [];
  for (const [p, which] of spec) {
    const all = await namesOf(p);
    const list = which === "*" ? all.filter((k) => !DROP.has(k)) : which;
    const keep = [];
    for (const item of list) {
      const [from, as = from] = item.split(" as ");
      if (!all.includes(from)) throw new Error(`${p} has no export "${from}"`);
      if (by.has(as) || (OWNER[as] && OWNER[as] !== p)) {
        if (!OWNER[as]) throw new Error(`"${as}" comes from both ${by.get(as)} and ${p}: say which in OWNER`);
        if (OWNER[as] !== p) continue;
      }
      by.set(as, p);
      keep.push(item);
    }
    lines.push(`export { ${keep.join(", ")} } from ${JSON.stringify(p)};`);
  }
  return { source: lines.join("\n") + "\n", names: [...by.keys()].sort() };
};
const cm = await entry(CM);
const merge = await entry(MERGE);
writeFileSync(join(tmp, "cm.js"), cm.source);
writeFileSync(join(tmp, "merge.js"), merge.source);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const res = await esbuild.build({
  entryPoints: { cm: join(tmp, "cm.js"), merge: join(tmp, "merge.js") },
  absWorkingDir: tmp,
  nodePaths: [nm],
  bundle: true, format: "esm", splitting: true, minify: true, target: "es2022", platform: "browser",
  outdir: OUT, entryNames: "[name]", chunkNames: "c/[name]-[hash]",
  legalComments: "none", metafile: true, logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
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

// what cm.js loads before anything else: it and its static imports, recursively
const outs = Object.fromEntries(Object.entries(res.metafile.outputs).map(([k, v]) => [relative(OUT, resolve(tmp, k)), v]));
const initial = (f, seen = new Set()) => {
  if (seen.has(f)) return seen;
  seen.add(f);
  for (const i of outs[f].imports) if (i.kind === "import-statement" && !i.external) initial(relative(OUT, resolve(tmp, i.path)), seen);
  return seen;
};
const cmInitial = [...initial("cm.js")].sort();
const mergeInitial = [...initial("merge.js")].sort();

// the manifest: every file and its sha256
const files = {};
const walk = (d) => { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files[relative(OUT, p)] = createHash("sha256").update(readFileSync(p)).digest("hex"); } };
walk(OUT);
const manifest = {
  package: "codemirror", esbuild: PIN.esbuild,
  pinned: Object.fromEntries(Object.entries(PIN).filter(([p]) => p !== "esbuild")),
  bundled: Object.fromEntries(names.map((n) => [n, pkgs.get(n).version])),
  exports: { "cm.js": cm.names, "merge.js": merge.names },
  initial: { "cm.js": cmInitial, "merge.js": mergeInitial },
  files,
};
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
rmSync(tmp, { recursive: true, force: true });

const size = (f) => statSync(join(OUT, f)).size;
const gz = (f) => gzipSync(readFileSync(join(OUT, f)), { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const total = Object.keys(files).reduce((a, f) => a + size(f), 0);
const sum = (l, fn) => l.reduce((a, f) => a + fn(f), 0);
const lazy = Object.keys(files).filter((f) => f.endsWith(".js") && !cmInitial.includes(f) && !mergeInitial.includes(f));
console.log(`vendor/codemirror: ${Object.keys(files).length} files, ${kb(total)}`);
console.log(`  cm.js + static imports (${cmInitial.length} files): ${kb(sum(cmInitial, size))}, ${kb(sum(cmInitial, gz))} gzipped`);
console.log(`  merge.js + static imports (${mergeInitial.length} files): ${kb(sum(mergeInitial, size))}, ${kb(sum(mergeInitial, gz))} gzipped`);
console.log(`  ${lazy.length} lazy chunks, ${kb(sum(lazy, size))}`);
console.log(`  cm.js exports ${cm.names.length} names, merge.js ${merge.names.length}`);
