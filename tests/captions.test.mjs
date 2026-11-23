// A caption is small print: one rule sizes and inks every caption under a picture, a set or a diagram.
//   node tests/captions.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
const media = sheets.find(([f]) => f === "media.css")[1];
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the caption rule: meta size and line, regular, a quieter ink", () => {
  assert.match(media, /\n:is\(\.mx-cap,\.ximg-cap,\.md-dg-why\)\{font:var\(--fw-regular\) var\(--fs-meta\)\/var\(--lh-meta\) var\(--sans\);color:var\(--ink-3\)\}/);
  assert.match(media, /\n\.mx-cap\{max-width:66ch;margin-bottom:var\(--s-2\)\}/);
});
t("no other rule sizes or inks a caption", () => {
  const bad = [];
  for (const [f, css] of sheets) for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if ([".mx-cap", ".ximg-cap", ".md-dg-why"].includes(sel) && /(^|;)\s*(font|font-size|color):/.test(m[2])) bad.push(`${f}: ${sel}`);
  }
  assert.deepEqual(bad, []);
});
console.log(`\n${passed} passed`);
