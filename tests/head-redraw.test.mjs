// The viewer's head is redrawn in one place, which keeps a focused head control focused (the controls grader's C092 v1
// on 7e0db5b, held-image-header-focus-through-decode, 1440 dark: More had native focus while an image was read; when it
// decoded, its size went into the head by a direct outerHTML, past paintHead, and focus fell to BODY at 0, 250 and 800
// ms). Every head redraw goes through paintHead.
//   node tests/head-redraw.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("only paintHead replaces the head", () => {
  const direct = [...src.matchAll(/^.*outerHTML = head\(\).*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(direct, ["top.outerHTML = head();"], "the one head redraw, paintHead's");
  const i = src.indexOf("function paintHead()");
  assert.ok(i > 0 && src.slice(i, src.indexOf("\n  }\n", i)).includes("top.outerHTML = head();"), "and it's paintHead's");
});
t("an image's size goes into the head by paintHead, so focus in the head stays", () => {
  const i = src.indexOf('el.addEventListener("load", (e) => {');
  assert.ok(i > 0, "the image's load handler");
  const body = src.slice(i, src.indexOf("}, true);", i));
  assert.match(body, /V\.dims = \{ w: img\.naturalWidth, h: img\.naturalHeight \};\s*paintHead\(\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
