// Artifacts show the thing itself (the owner, 19 Nov): a card's page is a document's title and first words, code and
// data their first lines, a picture whole; read only for cards near view, from the file's first bytes; corners from
// the scale (card 12 → well --r at --cell-in → page --r-xs), tokens only.
//   node tests/artifacts-preview.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { previewOf } from "../js/record.js";

// a document: its first heading, then its words (lists, quotes, code fences and tables left out)
const doc = previewOf("README.md", "# Threads in the panel\n\nThis is a **proposal** only.\n\n- one\n- two\n```js\nx\n```\n| a | b |");
assert.equal(doc.kind, "doc");
assert.equal(doc.title, "Threads in the panel");
assert.equal(doc.text, "This is a proposal only. one two x");
assert.equal(previewOf("notes.txt", "just words").title, null);
assert.ok(previewOf("long.md", "# T\n" + "word ".repeat(200)).text.length <= 320, "a page's worth, no more");

// code and data: their first lines, tabs as spaces, long lines cut
const code = previewOf("app.js", "const a = 1;\n\tif (a) {\n" + "x".repeat(300) + "\n" + "l\n".repeat(30));
assert.equal(code.kind, "lines");
assert.equal(code.lines.length, 14);
assert.equal(code.lines[1], "  if (a) {");
assert.equal(code.lines[2].length, 120);
assert.equal(previewOf("data.csv", "a,b\n1,2").lines[0], "a,b");
assert.equal(previewOf("empty.js", "   \n "), null, "nothing to show: the icon stays");

// the view: only near view, once, through the thread's folder; never a binary
const view = readFileSync(new URL("../js/recordview.js", import.meta.url), "utf8");
assert.match(view, /if \(m\) \{ loadThumbs\(\[m\]\); loadTexts\(\[m\]\); \}/, "read when its card comes near view");
assert.match(view, /String\(d && d\.content \|\| ""\)\.slice\(0, 4096\)/, "from its first bytes");
assert.match(view, /!\/\\\.\(pdf\|docx\?\|xlsx\?\|pptx\?\|zip\|gz\)\$\/i\.test/);
assert.match(view, /if \(where === "page"\) \{ const w = wellHtml\(m\); if \(w\) return w \+ iconHtml\(m\); \}/, "only on the Artifacts page; the icon stays for a phone's rows");

// CSS: concentric, tokens only
const css = readFileSync(new URL("../css/artifacts.css", import.meta.url), "utf8");
const block = css.slice(css.indexOf("── The thing itself"));
assert.match(block, /\.ar-grid \.md-th\.has-well\{display:block;place-items:normal;padding:var\(--cell-in\) var\(--cell-in\) 0;/);
assert.match(block, /\.md-well\{[^}]*border-radius:var\(--r\) var\(--r\) 0 0;/);
assert.match(block, /\.md-sheet\{[^}]*border-radius:var\(--r-xs\);/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("artifacts-preview: ok");
