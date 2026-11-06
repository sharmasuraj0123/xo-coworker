// An image in a place's changes (js/imagechange.js): which changes show as the image itself, and the words
// under it. The owner, 6 Nov: an image in the panel's Changes said only "Binary file".
//   node tests/imagechange.test.mjs
import assert from "node:assert/strict";
import { isImageChange, imageWords, noRoute } from "../js/imagechange.js";

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
t("the words, and which versions each has: new (now), changed (before and now), deleted (before), renamed (now)", () => {
  assert.deepEqual(imageWords({ path: "a.png", status: "added" }), { what: "New image", before: false, now: true });
  assert.deepEqual(imageWords({ path: "a.png", status: "modified" }), { what: "Changed image", before: true, now: true });
  assert.deepEqual(imageWords({ path: "a.png", status: "deleted" }), { what: "Deleted image", before: true, now: false });
  assert.deepEqual(imageWords({ path: "img/b.png", status: "renamed", old_path: "old/a.png" }), { what: "Renamed from a.png", before: false, now: true });
});
t("the version route not there yet (the server's own 404) is told apart from its answers", () => {
  assert.equal(noRoute({ status: 404, code: "http_404" }), true, "FastAPI's {detail: \"Not Found\"}: xo-space not restarted");
  assert.equal(noRoute({ status: 404, code: "version_not_found" }), false);
  assert.equal(noRoute({ status: 404, code: "file_not_found" }), false);
  assert.equal(noRoute({ status: 413, code: "image_too_large" }), false);
  assert.equal(noRoute(null), false);
});
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
