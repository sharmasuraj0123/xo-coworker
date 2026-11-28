import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { previewOf } from "../modules/artifacts/model.js";

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

const css = sheet(new URL("../modules/artifacts/artifacts.css", import.meta.url));
const block = css.slice(css.indexOf(":is(.ar-grid,.md-grid.is-strip) .md-th.has-well"));
assert.match(block, /:is\(\.ar-grid,\.md-grid\.is-strip\) \.md-th\.has-well\{display:block;place-items:normal;padding:var\(--cell-in\) var\(--cell-in\) 0;/);
assert.match(block, /\.md-well\{[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\) calc\(var\(--nest-r\) - var\(--nest-in\)\) 0 0;/);
assert.match(block, /\.md-sheet\{[^}]*border-radius:var\(--r-xs\);/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("artifacts-preview: ok");
