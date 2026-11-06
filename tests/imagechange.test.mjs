// An image in a place's changes (js/imagechange.js): which changes show as the image itself, and the words
// under it. The owner, 6 Nov: an image in the panel's Changes said only "Binary file".
//   node tests/imagechange.test.mjs
import assert from "node:assert/strict";
import { isImageChange, imageWords } from "../js/imagechange.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("a binary change to a picture a browser shows: the image", () => {
  for (const p of ["shots/a.png", "x.JPG", "y.jpeg", "z.gif", "w.webp", "v.avif", "u.bmp", "favicon.ico"]) assert.ok(isImageChange({ path: p, binary: true }), p);
  assert.ok(isImageChange({ path: "a.png", patch_omitted: "binary" }), "Space's patch_omitted says so too");
});
t("everything else keeps what it had: a diff, or \"Binary file\"", () => {
  assert.equal(isImageChange({ path: "logo.svg", binary: false, patch: "@@" }), false, "SVG is text: it has a diff");
  assert.equal(isImageChange({ path: "a.png", binary: false, patch_omitted: "too_large" }), false);
  assert.equal(isImageChange({ path: "blob.bin", binary: true }), false);
  assert.equal(isImageChange({ path: "doc.pdf", binary: true }), false);
  assert.equal(isImageChange(null), false);
});
t("the words under it: new, changed (the earlier version can't be shown yet), deleted, renamed", () => {
  assert.deepEqual(imageWords({ path: "a.png", status: "added" }), { what: "New image", note: "", shows: true });
  assert.deepEqual(imageWords({ path: "a.png", status: "modified" }), { what: "Changed image", note: "The earlier version can't be shown yet.", shows: true });
  assert.deepEqual(imageWords({ path: "a.png", status: "deleted" }), { what: "Deleted image", note: "The earlier version can't be shown yet.", shows: false });
  assert.deepEqual(imageWords({ path: "img/b.png", status: "renamed", old_path: "old/a.png" }), { what: "Renamed from a.png", note: "", shows: true });
});
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
