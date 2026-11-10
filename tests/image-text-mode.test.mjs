// A document's Preview or Source is its own: an image's Fit or Actual never changes it (the controls grader on 131d146,
// I79 continuity, 1440 dark: Source on a document, then an image's Actual and Fit, then the document again: it came
// back in Preview, Source aria-pressed=false. The mode buttons share their values, "preview" being both a document's
// Preview and an image's Fit, and the handler kept every value but "actual" as the document's mode). Only a mode
// chosen on a document is remembered for documents; an image always opens at Fit.
//   node tests/image-text-mode.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a mode chosen on an image is never the documents' mode", () => {
  assert.match(src, /if \(m\) \{ V\.mode = m\.dataset\.vwMode; if \(!V\.file\.image && !\(V\.data && V\.data\.kind === "image"\)\) V\.textMode = V\.mode; render\(\); return; \}/);
  assert.doesNotMatch(src, /if \(V\.mode !== "actual"\) V\.textMode = V\.mode;/, "not by the value, which an image's Fit shares with Preview");
});
t("an image opens at Fit; a document at the mode last chosen on a document", () => {
  assert.match(src, /mode: V\.textMode \|\| "preview"/);
  assert.match(src, /if \(V\.file\.image\) V\.mode = "preview";/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
