// A thread's docked decision never drops focus to the page, and it sits on the column's edges at every width (the
// create-project grader on 22046ec, round 16, all four cells, Enter, Space and a press):
//   S014: the docked Allow put focus on the page (its card became "Allowed. Undo" and Allow went with it), and so did
//         Undo (the line stayed until its 3 s were up, then the dock emptied under it and the card came back with
//         nothing focused).
//   S240: Unfold drew the card, then focused it a frame later: the folded line pressed was gone in between. At 390
//         the folded line's ring was cut on the left: a phone rule from before the one grid zeroed the dock's margin,
//         so it sat at the screen's edge, 16 px left of the composer.
// The rule, at the cause: whatever replaces the dock's contents hands focus on in the same step, to what takes their
// place (the card, the folded line), else the place; the done line hands it to its Undo; an undo ends that line at
// once and the card comes back with focus on it. The browser cases are in tests/browser/flows.test.cjs.
//   node tests/dock-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rules, context, decls } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const app = readFileSync(new URL("js/app.js", ROOT), "utf8");
const body = (from, to) => { const i = app.indexOf(from); assert.ok(i >= 0, `${from} is in app.js`); const j = app.indexOf(to, i); assert.ok(j > i, `${to} follows it`); return app.slice(i, j); };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one hand-off for the dock: focus on what goes moves, in the same step, to what takes its place, else the place", () => {
  const swap = body("function dockSwap(", "\nfunction ");
  assert.match(swap, /const had = tdock\.contains\(document\.activeElement\);/, "it notes whether focus was in the dock before");
  assert.match(swap, /fill\(\);\s*if \(had && !tdock\.contains\(document\.activeElement\)\) \(to && usable\(to\) \? to : placeRegion\(\)\)\.focus\(\{ preventScroll: true \}\);/, "and moves it in the step that fills it");
  assert.match(swap, /if \(opts\) morph\(tdock, run, opts\); else run\(\);/, "inside the morph's own step, never after it");
});
t("every change dockRender makes to the dock goes through it: the card and the folded line take focus as they're drawn", () => {
  const dr = body("function dockRender(needs) {", "\ntdock.addEventListener(\"click\"");
  const writes = (dr.match(/tdock\.(innerHTML\s*=|appendChild|replaceChildren)/g) || []).length;
  const swapped = (dr.match(/dockSwap\(\(\) => \{ tdock\.innerHTML = [^;]*;( tdock\.appendChild\((bar|frame)\);)?/g) || []).reduce((n, m) => n + (m.includes("appendChild") ? 2 : 1), 0);
  assert.ok(writes > 0);
  assert.equal(swapped, writes, `${writes} writes to the dock, ${swapped} through dockSwap`);
  assert.doesNotMatch(dr, /morph\(tdock,/, "no morph of the dock but dockSwap's");
  assert.match(dr, /dockSwap\(\(\) => \{ tdock\.innerHTML = ""; tdock\.appendChild\(bar\); \}, bar, /, "folded: the line takes focus");
  assert.match(dr, /dockSwap\(\(\) => \{ tdock\.innerHTML = ""; tdock\.appendChild\(frame\); fitDock\(frame\); \}, frame, /, "open: the card takes focus");
});
t("S014: the done line's Undo takes focus from the control pressed, as the line replaces the card", () => {
  const dr = body("function dockRender(needs) {", "\ntdock.addEventListener(\"click\"");
  assert.match(dr, /const had = frame\.contains\(document\.activeElement\);\s*morph\(frame, \(\) => \{[^]*?data-dock-undo>Undo<\/button><\/p>`;\s*if \(had && !frame\.contains\(document\.activeElement\)\) frame\.querySelector\("\[data-dock-undo\]"\)\.focus\(\{ preventScroll: true \}\);\s*\}, \{ duration: 300 \}\);/);
});
t("S014: an undo ends the done line at once and draws the card again (it took focus from the Undo it replaced)", () => {
  assert.match(app, /onUndone: \(key\) => \{[^\n]*if \(TD\.undone && TD\.undone\.key === key\) TD\.undone\.end\(\); \},/, "the decisions' undo, by the line's Undo or a key, reaches the dock");
  const dr = body("function dockRender(needs) {", "\ntdock.addEventListener(\"click\"");
  assert.match(dr, /await new Promise\(\(end\) => \{ TD\.undone = \{ key: n\.key, end: \(\) => \{ undone = true; end\(\); \} \}; hold\(RM\.matches \? 3000 : 2700\)\.then\(end\); \}\);/, "the 3 s window, or less if it's undone");
  assert.match(dr, /TD\.undone = null;\s*if \(undone\) \{ TD\.busy = false; TD\.key = null; dockRender\(D\.needItems\(\)\); schedule\(\); return; \}/, "undone: the card at once, not after the window");
  assert.match(dr, /TD\.key = "__settling";\s*dockSwap\(\(\) => \{ tdock\.innerHTML = ""; \}, null, \{ duration: 320 \}\);/, "the window over: the dock empties and focus on its Undo goes to the place");
});
t("S240: Unfold focuses the card in the step that draws it, not a frame later", () => {
  const unfold = body('const u = e.target.closest("[data-unfold]");', "\n  if (e.target.closest(\"[data-dock-undo]\"))");
  assert.match(unfold, /dockRender\(D\.needItems\(\)\); tdock\.querySelector\("\.card"\)\?\.focus\(\{ preventScroll: true \}\); return;/);
  assert.doesNotMatch(unfold, /requestAnimationFrame/);
});
t("S240: the dock sits on the column's edges at 390 as at 1440: no phone rule takes its margin away", () => {
  for (const w of [1440, 390]) {
    const set = rules(new URL("tests/lib/x.mjs", ROOT)).filter((r) => context(r, w).active && !context(r, w).cond && /(^|[\s>])\.tdock$/.test(r.sel))
      .flatMap((r) => decls(r.d).filter((d) => /^margin(-left)?$/.test(d.p)).map((d) => `${r.f}: ${r.sel} { ${d.p}: ${d.v} }`));
    assert.deepEqual(set, ["app.css: .tdock { margin-left: var(--col-x) }"], `at ${w}, the dock's left margin is set only as the column's`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
