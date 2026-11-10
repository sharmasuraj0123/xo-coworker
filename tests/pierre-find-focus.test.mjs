// Our pinned Pierre's find bar focuses its field when it opens, and its first frame never takes focus back (the owner's
// decision, 10 Nov 05:19, rv_f6e25f1d57634a20: "Also patch our copy of Pierre"). Pierre 1.6.4 left the field unfocused
// as the bar opened and focused it a frame later, by its frame callback's select(), even if focus had moved on: after
// a quick Tab to Close, Enter went to the field (EDITOR-close, 6 of 6 within the first frame). Patched: the field takes
// focus at once; the frame callback still updates the matches, and selects the query only while the field holds focus,
// or focus is still where it was as the bar opened. The patch is marked in the file, as Apache-2.0 asks, and in
// manifest.json, whose hash is the patched file's.
//   node tests/pierre-find-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const raw = readFileSync(new URL("../js/vendor/pierre-diffs/edit.js", import.meta.url));
const lib = raw.toString("utf8");
const manifest = JSON.parse(readFileSync(new URL("../js/vendor/pierre-diffs/manifest.json", import.meta.url), "utf8"));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the bar's field takes focus as the bar opens", () => {
  assert.match(lib, /n\.before\(this\.#n\);let __xoRoot=this\.#s\.getRootNode\(\),__xoWas=__xoRoot\.activeElement;this\.#s\.focus\(\),this\.#s\.select\(\),requestAnimationFrame\(/);
});
t("its first frame updates the matches and never takes focus back", () => {
  assert.match(lib, /requestAnimationFrame\(\(\)=>\{o!==void 0\?u\(\):c\(\[\]\);let __xoNow=__xoRoot\.activeElement;\(__xoNow===this\.#s\|\|__xoNow===__xoWas\)&&this\.#s\.select\(\)\}\)\}/);
  assert.doesNotMatch(lib, /requestAnimationFrame\(\(\)=>\{o!==void 0\?u\(\):c\(\[\]\),this\.#s\.select\(\)\}\)/, "the unguarded select is gone");
});
t("the change is marked in the file and in manifest.json, whose hash is the patched file's", () => {
  assert.ok(lib.startsWith("/* Modified by XO, 10 Nov 2026"), "a notice at the top (Apache-2.0 §4b)");
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.files["edit.js"]);
  const p = (manifest.patches || []).find((x) => x.file === "edit.js");
  assert.ok(p && /find bar/.test(p.what) && /owner/.test(p.why), "manifest.json names the patch and why");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
