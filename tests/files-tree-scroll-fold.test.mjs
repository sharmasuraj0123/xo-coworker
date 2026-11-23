// Files' tree (js/files.js): its list scrolls to its end and stays there, and its sections fold.
// The owner, 19 Nov 13:03Z: "i am not able to scroll till bottom, its coming back automatically" and "all files and
// changed files should be minimizable".
//   node tests/files-tree-scroll-fold.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const src = ["../js/files.js", "../modules/files/tree.js"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
const folds = readFileSync(new URL("../modules/files/section-folds.js", import.meta.url), "utf8");
const css = ["panel.css", "foundation.css"].map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");

// the old rule, kept here as the evidence: every scroll that ended was settled to the nearest multiple of 28 px, but
// rows are 32 (var(--h-ctl)), headings 28 and the list ends in 14 px of padding, so its end sat off that grid
const oldSettle = (top, max) => { const t = Math.round(top / 28) * 28; return Math.abs(t - top) >= 1 && t <= max ? t : top; };

t("the cause: for about half of all window heights, the old rule pulled a scroll to the end back by up to 14 px", () => {
  const content = 2 * 28 + 21 * 32 + 6 * 32 + 14; // the screenshot's tree: two headings, 21 changed files, 6 folders, padding
  let pulled = 0, most = 0;
  for (let view = 400; view < 900; view++) {
    const max = content - view, at = oldSettle(max, max);
    if (at !== max) { pulled++; most = Math.max(most, max - at); }
  }
  assert.ok(pulled > 200, `${pulled} of 500 heights`);
  assert.ok(most > 0 && most <= 14, `pulled back by up to ${most} px`);
});

t("the fix: no snapping to a fixed row height, and no whole-row height on the list", () => {
  assert.doesNotMatch(src, /const ROW = 28/);
  assert.doesNotMatch(src, /Math\.round\(l\.scrollTop \/ ROW\)/, "no settling of a scroll");
  assert.doesNotMatch(src, /function fitList/, "the list's height isn't cut to whole rows");
  assert.doesNotMatch(src, /scrollend/, "nothing listens for a scroll's end to move it");
});

t("Changed and All files fold from their heads, remembered per project", () => {
  assert.match(src, /<button type="button" class="fl-sec" data-fl-sec="\$\{part\}" aria-expanded="\$\{open\}"/, "a head is a button that says whether it's open");
  assert.match(src, /secHead\(s, "changed", `Changed \$\{s\.base \? "in this thread" : "here"\}`/);
  assert.match(src, /secHead\(s, "all", "All files"\)/);
  assert.match(folds, /const SECS_KEY = "xo-files-secs"/, "kept in this browser");
  assert.match(folds, /const p = secState\[s\.project\]/, "by project");
  assert.match(src, /if \(rootG && rootG\.hidden !== allFolded\) rootG\.hidden = allFolded;/, "All files folded hides the tree, kept as it was");
  assert.match(src, /if \(folded\(s, "changed"\)\) return secHead/, "Changed folded leaves its rows out");
  assert.match(src, /if \(sec\) \{ const part = sec\.dataset\.flSec; setFolded\(F\.scope, part, !folded\(F\.scope, part\)\); paint\(\); host\.querySelector\(`\[data-fl-sec="\$\{part\}"\]`\)\?\.focus/, "a press folds or opens it, and focus stays on its head");
  assert.match(src, /if \(F\.scope && F\.scope\.project && folded\(F\.scope, which\)\) \{ setFolded\(F\.scope, which, false\)/, "the rail's Changed or All files opens a folded section");
});

t("the heads use the panel's own fold look and tokens: the chevron turns, a control's height, the one ring", () => {
  assert.match(css, /\.fl-sec\[aria-expanded="true"\] \.fl-c svg\{transform:rotate\(90deg\)\}/);
  assert.match(css, /\.fl-sec\{box-sizing:border-box;height:var\(--h-ctl\)/);
  assert.match(css, /:is\(\.fl-r,\.fl-sec,/, "the rows' focus ring");
  assert.match(css, /button\.fl-sec:hover\{color:var\(--ink-2\)/, "answers the pointer");
});

console.log(`${passed} passed`);
