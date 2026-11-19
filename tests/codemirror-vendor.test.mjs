// CodeMirror 6, vendored (tools/codemirror/vendor.mjs): the files are the pinned and hashed ones and nothing
// else, cm.js and merge.js share one @codemirror/state (two copies break every instanceof inside CodeMirror),
// each entry exports what the manifest says, every bundled package carries its licence, and a language from
// the language data loads lazily. No network, no browser: @codemirror/view loads in Node without a DOM.
//   node tests/codemirror-vendor.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VENDOR = join(ROOT, "js/vendor/codemirror");
const manifest = JSON.parse(readFileSync(join(VENDOR, "manifest.json"), "utf8"));
const url = (f) => pathToFileURL(join(VENDOR, f)).href;

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n    " + e.message); process.exitCode = 1; }
};

await t("the vendored files are the pinned CodeMirror 6, every file as hashed, nothing extra", () => {
  assert.equal(manifest.package, "codemirror");
  assert.equal(manifest.esbuild, "0.28.2");
  assert.equal(manifest.pinned["@codemirror/state"], "6.7.6");
  for (const [p, v] of Object.entries(manifest.pinned)) assert.equal(manifest.bundled[p], v, `${p} bundled at ${manifest.bundled[p]}, pinned ${v}`);
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files.push(relative(VENDOR, p).split("\\").join("/")); } };
  walk(VENDOR);
  assert.deepEqual(files.sort(), Object.keys(manifest.files).sort(), "files on disk and in manifest.json differ: rerun tools/codemirror/vendor.mjs");
  for (const f of files) assert.equal(createHash("sha256").update(readFileSync(join(VENDOR, f))).digest("hex"), manifest.files[f], `${f} changed since it was vendored`);
  for (const f of files) assert.ok(/^(cm\.js|merge\.js|LICENSES\.md|c\/[\w-]+\.js)$/.test(f), `${f}: unexpected file`);
});

// the static imports of a file, recursively, read from the files themselves
const staticGraph = (f, seen = new Set()) => {
  if (seen.has(f)) return seen;
  seen.add(f);
  const src = readFileSync(join(VENDOR, f), "utf8");
  for (const m of src.matchAll(/(?:^|[;}])\s*import\s*(?:[^"'()]*?from\s*)?["'](\.{1,2}\/[^"']+)["']/g)) staticGraph(posix.join(posix.dirname(f), m[1]), seen);
  return seen;
};

await t("one @codemirror/state: a single file holds it, and both entries load that file", () => {
  const all = Object.keys(manifest.files).filter((f) => f.endsWith(".js"));
  const holders = all.filter((f) => readFileSync(join(VENDOR, f), "utf8").includes("Unrecognized extension value in extension set"));
  assert.equal(holders.length, 1, `@codemirror/state is in ${holders.length} files: ${holders.join(", ")}`);
  const cm = staticGraph("cm.js"), merge = staticGraph("merge.js");
  assert.ok(cm.has(holders[0]) && merge.has(holders[0]), `${holders[0]} isn't a static import of both entries`);
  for (const f of merge) if (f !== "merge.js") assert.ok(cm.has(f), `merge.js loads ${f}, which cm.js doesn't: a second copy of shared code`);
  assert.deepEqual([...cm].sort(), manifest.initial["cm.js"], "cm.js's static imports differ from the manifest");
  assert.deepEqual([...merge].sort(), manifest.initial["merge.js"], "merge.js's static imports differ from the manifest");
});

const cm = await import(url("cm.js"));
const merge = await import(url("merge.js"));

await t("cm.js and merge.js export exactly the names the manifest lists", () => {
  assert.deepEqual(Object.keys(cm).sort(), manifest.exports["cm.js"]);
  assert.deepEqual(Object.keys(merge).sort(), manifest.exports["merge.js"]);
  for (const n of ["EditorState", "EditorView", "keymap", "defaultKeymap", "history", "searchKeymap", "syntaxHighlighting",
    "LanguageSupport", "LanguageDescription", "autocompletion", "markdown", "markdownLanguage", "markdownKeymap",
    "commonmarkLanguage", "insertNewlineContinueMarkup", "deleteMarkupBackward", "tags", "styleTags",
    "classHighlighter", "highlightTree", "Tree", "NodeProp", "languages"]) assert.ok(n in cm, `cm.js has no ${n}`);
  for (const n of ["MergeView", "unifiedMergeView", "getChunks", "acceptChunk", "rejectChunk", "goToNextChunk", "goToPreviousChunk"]) assert.ok(n in merge, `merge.js has no ${n}`);
  assert.equal(cm.Line, cm.EditorState.create({ doc: "x" }).doc.line(1).constructor, "Line is @codemirror/state's");
});

await t("merge.js's extensions work in a state made by cm.js (same @codemirror/state instance)", () => {
  const state = cm.EditorState.create({ doc: "a\nb\nc", extensions: [cm.markdown(), merge.unifiedMergeView({ original: "a\nB\nc" })] });
  const chunks = merge.getChunks(state);
  assert.ok(chunks && chunks.chunks.length === 1, "unifiedMergeView found no chunk");
  const next = state.update({ changes: { from: 0, insert: "# " } }).state;
  assert.equal(next.doc.toString(), "# a\nb\nc");
  assert.match(cm.syntaxTree(next).toString(), /^Document\(ATXHeading1/);
});

await t("languages: Python loads lazily from its own chunk and parses", async () => {
  const py = cm.languages.find((l) => l.name === "Python");
  assert.ok(py, "no Python in languages");
  const support = await py.load();
  assert.ok(support instanceof cm.LanguageSupport, "Python's load() isn't a LanguageSupport from cm.js");
  const st = cm.EditorState.create({ doc: "def f(x):\n  return x\n", extensions: [support] });
  assert.match(cm.ensureSyntaxTree(st, st.doc.length, 5000).toString(), /^Script\(FunctionDefinition/);
  assert.ok(!manifest.initial["cm.js"].some((f) => /python/i.test(f)), "Python is in cm.js's first load");
  assert.ok(Object.keys(manifest.files).some((f) => /^c\/.*python/i.test(f)), "no lazy Python chunk");
  assert.equal(cm.LanguageDescription.matchFilename(cm.languages, "main.rs")?.name, "Rust");
});

await t("every bundled package carries its licence", () => {
  const lic = readFileSync(join(VENDOR, "LICENSES.md"), "utf8");
  for (const p of Object.keys(manifest.bundled)) assert.ok(lic.includes(`## ${p}@${manifest.bundled[p]} `), `${p} has no licence entry`);
  for (const p of Object.keys(manifest.pinned)) assert.ok(p in manifest.bundled, `${p} is pinned but isn't bundled`);
});

console.log(`\n${passed} passed`);
