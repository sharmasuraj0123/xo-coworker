// A message's headings are never smaller than its text: they take the message's own size and line, in bold.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { renderMarkdown } from "../js/markdown.js";

const dir = new URL("../css/", import.meta.url);
const app = sheet(new URL("app.css", dir));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the renderer's levels are unchanged: # to #### draw h3 to h6, each .md-h", () => {
  const html = renderMarkdown("# a\n\n## b\n\n### c\n\n#### d");
  for (const [n, x] of [[3, "a"], [4, "b"], [5, "c"], [6, "d"]]) assert.ok(html.includes(`<h${n} class="md-h">${x}</h${n}>`), `h${n}`);
});
t("one rule sizes them: the message's own size and line, strong, in ink", () => {
  assert.match(app, /\n\.prose :is\(h3,h4,h5,h6\)\.md-h\{font-size:inherit;line-height:inherit;font-weight:var\(--fw-strong\);letter-spacing:0;color:var\(--ink\)\}/);
});
t("nothing else sizes a message heading", () => {
  const bad = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim();
      if (/h[1-6]\.md-h|\.prose[^,{]*\bh[1-6]\b/.test(sel) && !sel.endsWith(".prose :is(h3,h4,h5,h6).md-h") && /font/.test(m[2])) bad.push(`${f}: ${sel}`);
    }
  }
  assert.deepEqual(bad, []);
});
console.log(`\n${passed} passed`);
