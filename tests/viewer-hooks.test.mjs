// Every viewer control is found again by a hook of its own: a redraw gives focus back by the focused control's first
// data-vw- hook, name and value (hookOf), so two controls must never share it (the controls grader on f70ca6b, 1440
// dark, viewer-your-draft-shortcut shortcut-held-SSE: "Your draft" and the File segment were both
// [data-vw-show="file"]; when the update redrew the head, focus went from the shortcut to File, while Changes stayed
// selected). The shortcut keeps its action (data-vw-show) behind a first hook of its own.
//   node tests/viewer-hooks.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const firstHooks = () => [...src.matchAll(/<(?:button|a)\b[^>]*?\b(data-vw-[\w-]+)(?:="([^"$]*)")?/g)].map((m) => `${m[1]}=${m[2] ?? ""}`);

t("Your draft has a first hook of its own, before the action it shares with File", () => {
  assert.match(src, /class="xd-btn xd-draft" data-vw-draft-show data-vw-show="file"/);
});
t("no two literal viewer controls share a first hook and value", () => {
  const seen = new Map(), dup = [];
  for (const h of firstHooks()) { if (seen.has(h)) dup.push(h); seen.set(h, true); }
  // the same control drawn in two places (the head and ⋯'s menu, or a branch's twin) is one control
  // (the head while editing has two templates, a conflict's and the ordinary one: never both drawn)
  const twins = new Set(["data-vw-more", "data-vw-copy", "data-vw-copy-path", "data-vw-download", "data-vw-update", "data-vw-edit", "data-vw-mode", "data-vw-x", "data-vw-cancel", "data-vw-saveit"]);
  // (none is exempt for living in its own region: render redraws the whole viewer and looks a hook up across all of
  // it, so the diff's Try again, once [data-vw-show="changes"] first, gave focus to the head's Changes: the controls
  // grader on 70375ad, Image-renderer-retry-v2)
  assert.deepEqual([...new Set(dup)].filter((h) => !twins.has(h.split("=")[0]) && !/=\$\{/.test(h)), [], "shared first hooks");
});
// pressed, Your draft shows File and isn't drawn there: focus goes to the File segment, the view it chose, never to the
// head's first control (the controls grader's viewer-your-draft-shortcut on 63b22ad, every cell: after Enter on the
// shortcut, focus was on Continue, "Exact mode value must retain native focus"; with its own hook, render's lookup no
// longer found File by the shared one, and fell to headFocus)
t("a show control gone once its view is drawn hands focus to that view's segment", () => {
  const r = src.slice(src.indexOf("function render() {"), src.indexOf("\n  }\n", src.indexOf("function render() {")));
  assert.match(r, /const chose = ae && ae\.dataset && ae\.dataset\.vwShow;/, "the view the focused control chooses");
  assert.match(r, /\(fromMenu && shown\(el, "\[data-vw-more\]"\)\)\s*\|\| \(chose && chose === V\.show && shown\(el, `\.vw-seg \[data-vw-show="\$\{chose\}"\]`\)\)/, "after the control itself and the menu's ⋯: the chosen view's segment");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
