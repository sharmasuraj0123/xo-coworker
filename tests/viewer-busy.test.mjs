// One pending state for the viewer's ⋯ actions (the controls grader on 76a53c1, S124/S125: with the clipboard held,
// nothing said it was copying at 250 or 800 ms, and Enter, Space, a tap or More opened again stacked four clipboard
// calls; More guarded only the download). V.busy is the one state: a copy or a download on its way takes no repeat
// and keeps More shut; a copy says "Copying…" once it outlasts a moment; success or refusal ends it.
//   node tests/viewer-busy.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const body = (name) => { const i = src.indexOf(`async function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n  }\n", i)); };

t("one state for both: no separate download flag left", () => {
  assert.doesNotMatch(src, /V\.saving/, "V.saving is gone");
  assert.match(src, /busy: null, saveError: null/, "V.busy, null when nothing's on its way");
});
t("a copy on its way takes no repeat, says so past a moment, and ends on success or refusal", () => {
  const b = body("copy");
  assert.match(b, /if \(V\.busy\) return;/, "a repeat (or a copy during a download) is ignored");
  assert.match(b, /const busy = V\.busy = \{ kind: "copy", shown: false \}/);
  assert.match(b, /setTimeout\(\(\) => \{ if \(V\.busy === busy\) \{ busy\.shown = true; redrawKeep\(\); \} \}, COPY_SAYS_MS\)/, "says it's copying once it outlasts COPY_SAYS_MS");
  assert.match(b, /clearTimeout\(slow\);\n\s*if \(V\.busy !== busy \|\| V\.file !== file\) return;[^\n]*\n\s*V\.busy = null;/, "ends before Copied or the refusal is said");
  const ms = +(src.match(/const COPY_SAYS_MS = (\d+);/) || [])[1];
  assert.ok(ms > 0 && ms < 250, `before 250 ms (${ms})`);
});
t("the download is the same state, and More stays shut while either is on its way", () => {
  assert.match(body("download"), /if \(V\.busy\) return;/);
  assert.match(body("download"), /V\.busy = \{ kind: "download", shown: true \};/);
  const i = src.indexOf('if (e.target.closest("[data-vw-more]")) {'), a = src.slice(i, i + 600);
  assert.match(a, /if \(V\.busy\) return;/, "More: one guard, for both");
  assert.match(src, /word = done \? "Copied" : busy \? \(V\.busy\.kind === "copy" \? "Copying…" : "Downloading…"\) : ""/, "the ⋯ says which");
});
t("a copy's result belongs to it and its file: settled after the file went, it says nothing; its Copied is cleared by its own timer only", () => {
  const b = body("copy");
  assert.match(b, /const busy = V\.busy = \{ kind: "copy", shown: false \}, file = V\.file;/, "its token and its file");
  assert.match(b, /if \(V\.busy !== busy \|\| V\.file !== file\) return;/, "another file opened meanwhile (it resets V.busy): nothing said, no focus moved");
  assert.match(b, /V\.copied = busy;/, "this copy's Copied");
  assert.match(b, /setTimeout\(\(\) => \{ if \(V\.copied === busy\) \{ V\.copied = false; redrawKeep\(\); \} \}, 1400\)/, "cleared only by this copy's timer (the old one cleared the new Copied: C81)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
