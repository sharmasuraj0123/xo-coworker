// A refused Copy path says the path didn't copy, and hands you the path itself to copy (the controls grader on 4d33649,
// S125 / V49, docs/note.md: the refusal said "Select the text and copy it, or download the file", which yields the
// document, never its path; one generic content-copy failure served both actions). The line under the head shows the
// whole path in a read-only field: focused or clicked, it selects all of it, for Ctrl/Cmd+C or a long-press. A refused
// copy of the contents is said as before; a copy that succeeds is unchanged.
//   node tests/copy-path-fail.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("copy knows what it copies: Copy path says so", () => {
  assert.match(src, /async function copy\(text, what = "contents"\) \{/);
  assert.match(src, /if \(e\.target\.closest\("\[data-vw-copy-path\]"\)\) \{ copy\(V\.file\.rel \? localPath\(\) : V\.file\.path, "path"\); return; \}/);
  assert.match(src, /if \(e\.target\.closest\("\[data-vw-copy\]"\)\) \{ copy\(String\(V\.data\.content\)\); return; \}/, "Copy: the contents, as before");
});
t("a refused path copy says the path didn't copy and offers the path; a refused contents copy is said as before", () => {
  assert.match(src, /V\.saveError = what === "path"\s*\? \{ text: "Couldn't copy the path: the browser didn't allow it here\. Here it is to copy:", select: text \}\s*: "Couldn't copy: the browser didn't allow it here\. Select the text and copy it, or download the file\.";/);
  assert.match(src, /announce\(what === "path" \? "Couldn't copy the path\." : "Couldn't copy\."\)/);
});
t("the line under the head draws the path in a read-only field that selects all of it", () => {
  assert.match(src, /const cut = V\.saveError && \(typeof V\.saveError === "string" \? \{ text: V\.saveError \} : V\.saveError\);/);
  assert.match(src, /<input class="vw-cut-sel" readonly value="\$\{esc\(cut\.select\)\}" aria-label="The path, to copy" spellcheck="false">/);
  assert.match(src, /if \(e\.target\.matches\?\.\("\.vw-cut-sel"\)\) e\.target\.select\(\);/, "focused, it's all selected");
  assert.match(css, /\.vw-cut-sel\{[^}]*font:[^;]*var\(--mono\)/, "the path reads as a path");
});
// the offered path is read whole: it takes its own row under the words, as wide as the line, so a path isn't cut
// sideways (the controls grader on 1ed50f6 at 390 light, V98: the field was 92 × 24, "docs/note.md" clipped; the line
// kept one row and the field shrank to what the words left); on a phone it's at the 36 px floor (phone.css)
t("the offered path takes its own row under the words, the line's width", () => {
  assert.match(css, /\.vw-cut:has\(\.vw-cut-sel\)\{flex-wrap:wrap\}/, "the line wraps when it offers a path");
  assert.match(css, /\.vw-cut-sel\{flex:1 0 calc\(100% - 22px\);margin-left:22px;/, "its own row, aligned with the words");
  assert.doesNotMatch(css, /\.vw-cut-sel\{[^}]*min-width:0/, "it never shrinks to what the words leave");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
