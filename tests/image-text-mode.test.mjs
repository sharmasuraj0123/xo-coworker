// A document's mode is its own: an image's Fit or Actual never changes it (the controls grader on 131d146, I79
// continuity, 1440 dark: Source on a document, then an image's Actual and Fit, then the document again: it came back
// in Preview. The mode buttons share their values, "preview" being both HTML's Preview and an image's Fit). Three
// modes, each kept apart: an image's Fit or 1:1 (V.imgMode, every image opening at Fit), Markdown's Page or Source
// (V.textMode) and HTML's Preview or Source (V.mode), the documents' kept as you move between files.
//   node tests/image-text-mode.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = ["../modules/files/viewer-events.js", "../modules/files/viewer-head.js", "../modules/files/viewer.js"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a mode chosen on an image is never the documents' mode", () => {
  const i = src.indexOf("const mode = m.dataset.vwMode;"), h = src.slice(i, i + 900);
  assert.ok(i > 0, "the mode handler");
  const img = h.indexOf('if (V.file.image || (V.data && V.data.kind === "image")) { V.imgMode = mode; render(); return; }');
  const md = h.indexOf("V.textMode = mode;"), html = h.indexOf("V.mode = mode;");
  assert.ok(img > 0 && md > img && html > img, "an image's choice is taken first, and stops there");
  assert.doesNotMatch(src, /if \(V\.mode !== "actual"\) V\.textMode = V\.mode;/, "not by the value, which an image's Fit shares with Preview");
  assert.match(src, /V\.imgMode = V\.imgMode === "actual" \? "preview" : "actual";/, "a click on the image is its own too");
});
t("an image opens at Fit; a document keeps the mode last chosen on a document", () => {
  assert.match(src, /imgMode: "preview", copied/, "every file shown starts its image at Fit");
  assert.doesNotMatch(src, /showTab[\s\S]{0,600}mode: t\.file\.image/, "showing a file doesn't touch the documents' modes");
  assert.match(src, /const actual = V\.imgMode === "actual";/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
