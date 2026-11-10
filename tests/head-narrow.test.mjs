// The file's name keeps its room in a narrow head while ⋯ says Copying…, Downloading… or Copied (the controls grader on
// 1ed50f6 at 320 dark, V96S: More grew to 95 px with its word and the name shrank to a 19 px "a…"). Where the head is
// narrower than its controls with that word (under 360 px of content: a 375 or 320 phone; a 390 phone has 370 and shows the word), ⋯ keeps its 36 px and says it by its icon (the spinner, the
// check), with the word as its name and title; wider, the word shows beside the icon as before.
//   node tests/head-narrow.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = ["panel.css", "diffs.css"].map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("in a head under 360 px, ⋯ with a state keeps its square and shows the state by its icon", () => {
  const q = css.match(/@container vwtop \(max-width:360px\)\{([\s\S]*?)\n\}/);
  assert.ok(q, "the narrow head's query");
  assert.match(q[1], /\.vw-top \.vw-more:is\(\.is-done,\.is-busy\) span\{display:none\}/, "the word steps aside");
  assert.match(q[1], /\.vw-top \.vw-more:is\(\.is-done,\.is-busy\)\{width:36px;padding:0\}/, "the square stays");
});
t("the state stays said: the word is ⋯'s name and title, the icon a spinner or a check", () => {
  assert.match(src, /title="\$\{word \|\| "Copy, download"\}" aria-label="\$\{word \|\| "More: copy, download"\}"/);
  assert.match(src, /\$\{done \? ICON\.check : busy \? `<i class="spin" aria-hidden="true"><\/i>` : MORE_IC\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
