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
// a control is found again by its hook's name and value, in one helper every redraw uses (the controls grader's V99-v3
// on 2a8d278 at 390 light, C092/S127: File had focus while an image was read; paintHead remembered only the hook's name,
// data-vw-show, so after the image decoded focus went to the first such control, Changes, unselected, while File stayed
// selected)
t("one helper names a control by its hook's name and value, and every redraw uses it", () => {
  assert.match(src, /const hookOf = \(e\) => \{ const a = e && e\.attributes && \[\.\.\.e\.attributes\]\.find\(\(x\) => x\.name\.startsWith\("data-vw-"\)\); return a \? \(a\.value \? `\[\$\{a\.name\}="\$\{CSS\.escape\(a\.value\)\}"\]` : `\[\$\{a\.name\}\]`\) : ""; \};/);
  assert.equal((src.match(/startsWith\("data-vw-"\)/g) || []).length, 1, "nowhere else reads a hook on its own");
  const ph = src.slice(src.indexOf("function paintHead()"), src.indexOf("function paintHead()") + 1400);
  assert.match(ph, /const had = ae && top\.contains\(ae\) \? hookOf\(ae\) : "";/, "paintHead: name and value");
  assert.match(ph, /shown\(now, had\)/, "found again by both");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
