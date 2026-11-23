// A file shows what it is now, never an older drawing of it. The editor is made per document (js/viewer.js drawText:
// keyed by the document's key, its project and path, and whether it's a page or source) and shows the document's
// live text; the document (modules/files/documents.js) takes the version each save answers, so the next save is sent against it,
// whether or not Space says when (a save it couldn't log answers saved_at null: the controls grader's lead on
// 4f5315a, C095, when a key of path, size and time kept an old drawing). No browser.
//   node tests/file-cache.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const v = ["../modules/files/viewer.js", "../modules/files/viewer-text.js", "../modules/files/viewer-reads.js"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
const docs = readFileSync(new URL("../modules/files/documents.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the editor is keyed by its document (and page or source), so another file never shows in it", () => {
  const m = /async function drawText\(\) \{[\s\S]*?const key = `([^`]*)`;/.exec(v);
  assert.ok(m, "drawText's key");
  assert.match(m[1], /D\.key/, `the key: ${m[1]}`);
  assert.match(v, /if \(TX\.key === key && TX\.h\) return;/, "the same document's editor stays");
});
t("a save takes the version it answers, whether or not it says when", () => {
  assert.match(docs, /d\.base = text; d\.version = r\.version;/, "the saved version replaces the old one");
  assert.match(docs, /at: r\.saved_at \|\| null/, "no saved_at: the version still moves on");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
