// A file drawn after a save shows what was saved: the viewer's drawing key (also the renderer's cache key) carries
// the file's version, its content hash, so two different texts never share one. Controls grader's lead on 4f5315a
// (C095): when xo-space saves but can't log the edit, it answers saved_at null (services/project_files/save.py
// _logged), so modified_at stayed as it was; a same-length edit then kept path, size and modified_at, the key didn't
// move, and the old drawing (and the renderer's cached tokens for that key) could stand. No browser.
//   node tests/file-cache.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const v = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the file's drawing key carries its version (a content hash), so a saved text never draws as the old one", () => {
  const m = /async function drawFile\(\) \{\s*const d = V\.data, f = V\.file;(?:\s*\/\/[^\n]*)*\s*const key = `([^`]*)`;/.exec(v);
  assert.ok(m, "drawFile's key");
  assert.match(m[1], /d\.version/, `the key: ${m[1]}`);
});
t("a save takes the version it answers (the key moves with it), whether or not it says when", () => {
  assert.match(v, /V\.data = \{ \.\.\.V\.data, content: text, version: r\.version,/, "the saved version replaces the old one");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
