// The Markdown page (js/mdlive.js, css/docs.css) reads as a document: no control chrome on the editing surface or its
// drawn blocks when the pointer passes over them (the owner, 19 Nov 13:35Z: "what's with the hover border when i am in md
// canvas?": a 1 px outline drawn on every table, formula and diagram on hover). A table cell you type in keeps its own
// focus mark.
//   node tests/page-no-hover.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cssNames } from "./lib/sources.mjs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const all = cssNames().map((f) => [f, readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);

t("no stylesheet draws anything on the page's surface or its blocks on hover", () => {
  const found = [];
  for (const [f, css] of all) for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const sel = m[1];
    if (!/:hover/.test(sel)) continue;
    if (/\.cm-md-|\.cm-xo-page|\.vw-doc \.cm-(content|line|editor)\b/.test(sel)) found.push(`${f}: ${sel.trim()}`);
  }
  assert.deepEqual(found, []);
});

t("a table cell you're typing in keeps its own focus mark", () => {
  const docs = all.find(([f]) => f === "docs.css")[1];
  assert.match(docs, /\.cm-md-table td:focus,\.cm-md-table th:focus\{/);
});

console.log(`${passed} passed`);
