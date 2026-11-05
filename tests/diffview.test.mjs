// Diffs and files (js/diffview.js, design-research/2026-11-vision/pierre): the vendored library is the one
// pinned and hashed, the syntax theme still matches XO's code tokens, every language the adapter asks for is
// one the build carries, and nothing loads the library on the app's first load. No network, no browser.
//   node tests/diffview.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
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

await t("the vendored library is @pierre/diffs 1.6.4, every file as hashed, nothing extra", () => {
  assert.equal(manifest.package, "@pierre/diffs");
  assert.equal(manifest.version, "1.6.4");
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f !== "manifest.json") files.push(relative(VENDOR, p)); } };
  walk(VENDOR);
  assert.deepEqual(files.sort(), Object.keys(manifest.files).sort(), "files on disk and in manifest.json differ: rerun tools/diffview/vendor.mjs");
  for (const f of files) assert.equal(createHash("sha256").update(readFileSync(join(VENDOR, f))).digest("hex"), manifest.files[f], `${f} changed since it was vendored`);
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

await t("js/diffthemes.js matches the code tokens (else: node tools/diffview/theme.mjs)", () => {
  assert.equal(readFileSync(join(ROOT, "js/diffthemes.js"), "utf8"), moduleSource(codeColors(ROOT)));
});

await t("the theme resolver follows the cascade: light overrides dark, color-mix is worked out", () => {
  const p = rootProps(ROOT);
  assert.equal(p.dark["--code-bg"], "#1B1B1B");
  assert.equal(p.light["--code-bg"], "#F5F5F5");
  assert.deepEqual(color("color-mix(in srgb,#000000 25%,#FFFFFF)", {}).map(Math.round), [191, 191, 191]);
  assert.deepEqual(color("var(--a)", { "--a": "var(--b)", "--b": "#102030" }), [16, 32, 48]);
  const c = codeColors(ROOT);
  assert.notEqual(c.dark.kw, c.light.kw, "light and dark keywords should differ");
  for (const th of ["dark", "light"]) for (const [k, v] of Object.entries(c[th])) assert.match(v, /^#[0-9A-F]{6}$/, `${th} ${k}`);
});

await t("every language langOf() asks for is in the build", async () => {
  const { langOf } = await import("../js/diffview.js");
  const src = readFileSync(join(ROOT, "js/diffview.js"), "utf8");
  const asked = new Set([...src.matchAll(/:\s*"([a-z0-9+#-]+)"/g)].map((m) => m[1]).filter((l) => !["text", "dark", "light", "xo-dark", "xo-light", "shiki-js", "module", "split", "unified", "bars", "word", "line-info", "wrap", "scroll"].includes(l)));
  for (const l of asked) assert.ok(manifest.languages.includes(l), `"${l}" isn't vendored`);
  const cases = { "js/app.js": "javascript", "a/b.tsx": "tsx", "Makefile": "make", "x/Dockerfile": "docker", ".env": "dotenv", ".env.local": "dotenv", "run.sh": "shellscript", "README": "text", "notes.unknown": "text", ".gitignore": "text", "css/app.css": "css", "README.md": "markdown", "a.H": "c" };
  for (const [p, l] of Object.entries(cases)) assert.equal(langOf(p), l, p);
});

await t("first load stays as it was: only js/diffview.js reaches the library, and only by import()", () => {
  const src = readFileSync(join(ROOT, "js/diffview.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/^\s*import\s[^(]/m.test(src), "js/diffview.js has a static import");
  for (const f of readdirSync(join(ROOT, "js")).filter((n) => n.endsWith(".js") && n !== "diffview.js")) {
    const s = readFileSync(join(ROOT, "js", f), "utf8");
    assert.ok(!/vendor\/pierre-diffs|diffthemes/.test(s), `js/${f} reaches the library directly`);
  }
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.ok(!/pierre-diffs|diffview/.test(html), "index.html loads the library");
});

console.log(`\n${passed} passed`);
