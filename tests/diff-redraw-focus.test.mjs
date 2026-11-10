// The diff's "Couldn't draw this diff · Try again" keeps focus while it tries again and after it fails again (the
// controls grader on 70375ad, Image-renderer-retry-v2, all 12 viewer cases in four cells: Enter, Space or a click left
// the same failure showing and focus on the head's Changes). Two causes:
// - its first hook was data-vw-show="changes", the head's Changes segment's too, and render finds the focused control
//   again by its first hook across the whole viewer, the head first;
// - drawing again replaced the notice with "Reading the change…" before render looked, so even a hook of its own had
//   nothing to find, and the head took focus.
// Now it has a hook of its own (keeping its action, Show changes), and drawing again after the renderer failed says so
// in its notice, in place, its Try again busy (as the file's does, S139); failed again, inRegion hands focus to the new
// Try again; drawn, the notice goes and focus is on the diff's body.
//   node tests/diff-redraw-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const dd = (() => { const i = src.indexOf("async function drawDiff("); assert.ok(i > 0, "drawDiff"); return src.slice(i, src.indexOf("\n  }\n", i)); })();

t("the renderer's Try again has a first hook of its own, before the action it shares with the head's Changes", () => {
  assert.match(dd, /<button type="button" class="vw-cut-dl" data-vw-diff-redraw data-vw-show="changes">Try again<\/button>/);
  assert.doesNotMatch(src, /class="vw-cut-dl" data-vw-show="changes"/, "never Changes' hook first");
});
t("the failure is remembered for its change, so only that change's notice is drawn busy", () => {
  assert.match(src, /const DF = \{[^}]*failed: null[^}]*\};/);
  assert.match(dd, /dropDiff\(\); \/\/ \(clears pend: Try again draws afresh\)\s*DF\.failed = at;/);
});
t("drawing again after the renderer failed: the notice says so in place and its Try again is busy, focus kept on it", () => {
  const r = dd.slice(dd.indexOf("DF.key = null; DF.pend = null;"), dd.indexOf("DF.reading = at;"));
  assert.match(r, /const redo = DF\.failed === at && host\.querySelector\(":scope > \.vw-empty \[data-vw-diff-redraw\]"\);/);
  assert.match(r, /DF\.failed = null;/);
  assert.match(r, /box\.setAttribute\("role", "status"\);/);
  assert.match(r, /words\.textContent = "Drawing this diff…"/);
  assert.match(r, /redo\.setAttribute\("aria-busy", "true"\); redo\.setAttribute\("aria-disabled", "true"\); redo\.textContent = "Trying again…";/);
  assert.match(r, /else inRegion\(host, \(\) => \{ host\.innerHTML = `<p class="vw-empty" role="status">/, "otherwise: Reading the change…");
});
t("the busy notice stays until the drawing is in, then goes; a second press does nothing more", () => {
  assert.match(dd, /if \(!host\.querySelector\(':scope > \.vw-empty \[data-vw-diff-redraw\]\[aria-busy="true"\]'\)\) inRegion\(host, \(\) => host\.replaceChildren\(\)\);/);
  assert.match(dd, /DF\.handle = h;\s*inRegion\(host, \(\) => \{ for \(const x of host\.querySelectorAll\(":scope > \.vw-empty"\)\) x\.remove\(\); \}\);/);
  const i = src.indexOf('const sh = e.target.closest("[data-vw-show]");');
  assert.ok(src.slice(i - 200, i).includes(`if (e.target.closest('[data-vw-diff-redraw][aria-busy="true"]')) return;`), "the busy Try again takes no press, before Show");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
