// Diffs and files (modules/changes/diffview.js): the vendored library is the one
// pinned and hashed, the syntax theme still matches XO's code tokens, every language the adapter asks for is
// one the build carries, and nothing loads the library on the app's first load. No network, no browser.
//   node tests/diffview.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { declarations } from "./lib/layers.mjs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { codeColors, moduleSource, rootProps, color } from "../tools/diffview/theme.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VENDOR = join(ROOT, "js/vendor/pierre-diffs");
const manifest = JSON.parse(readFileSync(join(VENDOR, "manifest.json"), "utf8"));

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n    " + e.message); process.exitCode = 1; }
};

await t("the Changes adapter loads Pierre and starts its module worker on the first diff", async () => {
  const library = new URL("../js/vendor/pierre-diffs/diffs.js", import.meta.url).href;
  const worker = new URL("worker.js", library).href;
  const loads = [];
  const workers = [];
  const hooks = registerHooks({
    load(url, context, next) {
      if (url !== library) return next(url, context);
      loads.push(url);
      return { format: "module", shortCircuit: true, source: `
        export function registerCustomTheme() {}
        export function parsePatchFiles() { return [{ files: [{ name: "file.js" }] }]; }
        export function getOrCreateWorkerPoolSingleton({ poolOptions }) { return poolOptions.workerFactory(); }
        export class FileDiff { render() {} }
      ` };
    },
  });
  const originals = { document: globalThis.document, Worker: globalThis.Worker };
  try {
    globalThis.document = { documentElement: { dataset: {} } };
    globalThis.Worker = class { constructor(url, options) { workers.push([url, options.type]); } };
    const { diff } = await import("../modules/changes/diffview.js");
    assert.deepEqual(loads, []);
    await diff({}, "patch");
    assert.deepEqual(loads, [library]);
    assert.deepEqual(workers, [[worker, "module"]]);
  } finally {
    hooks.deregister();
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

await t("the vendored files match the pinned @pierre/diffs inventory", () => {
  assert.equal(manifest.package, "@pierre/diffs");
  assert.equal(manifest.version, "1.6.4");
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files.push(relative(VENDOR, p)); } };
  walk(VENDOR);
  assert.deepEqual(files.sort(), Object.keys(manifest.files).sort(), "files on disk and in manifest.json differ: rerun tools/diffview/vendor.mjs");
});

await t("the bundle carries no colour theme catalogue and no WebAssembly", () => {
  const names = Object.keys(manifest.files);
  // the WebAssembly engine's two imports are stubs that throw (tools/diffview/vendor.mjs STUB)
  const big = names.filter((f) => /wasm|onig/i.test(f) && statSync(join(VENDOR, f)).size > 1024);
  assert.deepEqual(big, [], "Shiki's WebAssembly engine slipped in");
  assert.ok(!names.some((f) => /(github|dracula|monokai|nord|one-dark|pierre-dark|vitesse)/.test(f)), "a bundled colour theme slipped in");
  assert.ok(names.length < 120, `${names.length} files: the language list grew?`);
});

await t("every language the bundle names carries its licence", () => {
  const lic = readFileSync(join(VENDOR, "LICENSES.md"), "utf8");
  for (const p of Object.keys(manifest.bundled)) assert.ok(lic.includes(`## ${p}@`), `${p} has no licence entry`);
  assert.ok(Object.keys(manifest.bundled).includes("@pierre/diffs") && Object.keys(manifest.bundled).includes("shiki"));
});

await t("the runtime syntax themes match the generated themes", async () => {
  const generated = await import("data:text/javascript," + encodeURIComponent(moduleSource(codeColors(ROOT))));
  const runtime = await import("../modules/changes/diffthemes.js");
  assert.deepEqual({ ...runtime }, { ...generated }, "regenerate with node tools/diffview/theme.mjs");
});

await t("the theme resolver follows the cascade: light overrides dark, color-mix is worked out", () => {
  const p = rootProps(ROOT);
  assert.equal(color("var(--code-bg)", p.dark).map(Math.round).join(), "23,23,23");
  assert.equal(color("var(--code-bg)", p.light).map(Math.round).join(), "245,245,245");
  assert.deepEqual(color("color-mix(in srgb,#000000 25%,#FFFFFF)", {}).map(Math.round), [191, 191, 191]);
  assert.deepEqual(color("var(--a)", { "--a": "var(--b)", "--b": "#102030" }), [16, 32, 48]);
  const c = codeColors(ROOT);
  assert.notEqual(c.dark.kw, c.light.kw, "light and dark keywords should differ");
  for (const th of ["dark", "light"]) for (const [k, v] of Object.entries(c[th])) assert.match(v, /^#[0-9A-F]{6}$/, `${th} ${k}`);
});

await t("the adapter picks bundled highlighting languages and falls back to plain text", async () => {
  const { langOf } = await import("../modules/changes/diffview.js");
  const samples = [
    "js", "ts", "jsx", "tsx", "json", "jsonc", "py", "go", "rs", "java", "kt", "swift", "c", "cpp", "cs", "rb", "php",
    "sh", "ps1", "sql", "yaml", "toml", "ini", "md", "css", "scss", "html", "xml", "vue", "svelte", "graphql",
    "diff", "lua", "r", "dart", "scala", "ex", "hs", "pl", "proto", "tf", "tex",
  ].map((extension) => `file.${extension}`).concat(["Dockerfile", "Makefile", "nginx.conf", ".env"]);
  assert.deepEqual(new Set(samples.map(langOf)), new Set(manifest.languages));
  const cases = { "js/app.js": "javascript", "a/b.tsx": "tsx", "Makefile": "make", "x/Dockerfile": "docker", ".env": "dotenv", ".env.local": "dotenv", "run.sh": "shellscript", "README": "text", "notes.unknown": "text", ".gitignore": "text", "css/app.css": "css", "README.md": "markdown", "a.H": "c" };
  for (const [p, l] of Object.entries(cases)) assert.equal(langOf(p), l, p);
});

await t("the adapter offers only what the app draws: diffs, J/K, the theme, idle warm-up; no editor or merge view", async () => {
  const D = await import("../modules/changes/diffview.js");
  assert.deepEqual(Object.keys(D).sort(), ["diff", "jump", "langOf", "prefetch", "setTheme"]);
  assert.ok(!("edit.js" in manifest.files) && !manifest.patches, "Pierre's editor isn't vendored, so nothing patches it");
});

await t("no rule styles the deleted merge view's choices", () => {
  assert.deepEqual(declarations().filter(({ sel }) => /\.xd-merge\b|\.xd-mbtn\b/.test(sel)), []);
});

await t("tools/diffview holds only what makes the vendored library and its themes, no one-off probes", () => {
  assert.deepEqual(readdirSync(join(ROOT, "tools/diffview")).sort(), ["theme.mjs", "vendor.mjs"]);
});


console.log(`\n${passed} passed`);
