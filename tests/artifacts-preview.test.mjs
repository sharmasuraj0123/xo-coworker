// Artifacts show the thing itself (the owner, 19 Nov): a card's page is a document's title and first words, code and
// data their first lines, a picture whole; read only for cards near view, from the file's first bytes; corners from
// the scale (card 12 → well --r at --cell-in → page --r-xs), tokens only.
//   node tests/artifacts-preview.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// the view: only near view, once, through the thread's folder; never a binary
const view = ["../modules/artifacts/made.js", "../modules/artifacts/previews.js", "../modules/artifacts/cards.js", "../modules/artifacts/page.js"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n").replace(/\bPV\./g, "");
assert.match(view, /if \(m\) \{ nearY\.set\(m\.key, \{ y: e\.boundingClientRect\.top - e\.rootBounds\.top \+ A\.box\.scrollTop \}\); loadThumbs\(\[m\]\); loadTexts\(\[m\]\); \}/, "read when its card comes near view; where it is comes from the observer, no layout read");
assert.match(view, /String\(\(await api\.projectFile\(r\.project, r\.rel\)\)\?\.content \|\| ""\)\.slice\(0, 4096\)/, "from its first bytes");
assert.match(view, /!\/\\\.\(pdf\|docx\?\|xlsx\?\|pptx\?\|zip\|gz\)\$\/i\.test/);
assert.match(view, /if \(where === "page" \|\| where === true\) \{ const w = wellHtml\(m\); if \(w\) return w \+ iconHtml\(m\); \}/, "on the Artifacts page and Home's strip; the icon stays for a phone's rows");
assert.match(view, /loadThumbs\(list\); loadTexts\(list\);/, "Home's strip reads its previews too, through the queue");

// previews never hold the page up (the owner, 19 Nov 14:46Z): one queue, a few at a time, nearest the view first;
// what arrives is drawn once a frame; kept on the device (pictures as a small copy); a card is drawn at once
assert.match(view, /const PREV_CAP = 3, PREV_W = 640, PREV_CACHE = "xo-previews-1";/);
assert.match(view, /while \(PQ\.n < PREV_CAP && PQ\.q\.length\)/);
assert.match(view, /return Math\.abs\(w\.y - box\.scrollTop - box\.clientHeight \/ 3\);/, "nearest the view first");
assert.match(view, /PQ\.landed = requestAnimationFrame\(/, "arrivals drawn once a frame");
assert.doesNotMatch(view, /api\.(projectImage|projectFile)\([^)]*\)\.then\(/, "no read outside the queue");
assert.match(view, /const hit = await cached\(m, "pic"\);/);
assert.match(view, /const hit = await cached\(m, "text"\);/);
assert.match(view, /c\.convertToBlob\(\{ type: "image\/webp", quality: 0\.82 \}\)/, "a picture kept small for its card");
assert.match(view, /`<span class="md-well is-wait"\$\{wt\}>\$\{iconHtml\(m\)\}<\/span>`/, "the well at once, tinted, with the kind's icon");
assert.match(view, /loadThumbs\(list\.slice\(0, 48\)\)/, "the panel's Made asks for its first screens only");

// every well is tinted with its file icon's colour, a picture's too (the owner, 19 Nov 14:29Z); the card's link back
// to its thread wears the thread mark, not a "‹" that reads as Back (proposal round 4)
assert.match(view, /const tint = fileColor\(m\.name \|\| m\.path\) \|\| "";/);
assert.match(view, /<span class="md-well"\$\{wt\}><img class="md-pic"/);
assert.doesNotMatch(view, /m\.kind === "image" \? "" : fileColor/);
assert.match(view, /title="Open the thread that made it">\$\{ICON\.threadOne\}<span>/);

// CSS: concentric, tokens only
const css = readFileSync(new URL("../modules/artifacts/artifacts.css", import.meta.url), "utf8");
const block = css.slice(css.indexOf(":is(.ar-grid,.md-grid.is-strip) .md-th.has-well"));
assert.match(block, /:is\(\.ar-grid,\.md-grid\.is-strip\) \.md-th\.has-well\{display:block;place-items:normal;padding:var\(--cell-in\) var\(--cell-in\) 0;/);
assert.match(block, /\.md-well\{[^}]*border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\) calc\(var\(--nest-r\) - var\(--nest-in\)\) 0 0;/);
assert.match(block, /\.md-sheet\{[^}]*border-radius:var\(--r-xs\);/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("artifacts-preview: ok");
