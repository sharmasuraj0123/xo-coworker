// The sidebar's Projects line, Find a project and the first project row sit 8 px apart, as Files' title and its Find do:
// the label's bottom margin (8 less the ring room), Find's own ring room above it and the same 8-less below, the list's
// ring room on top. It was 2 px above Find and 14 below (the owner, 11 Nov 08:02Z; c5b03b2 checked with Find hidden).
//   node tests/side-spacing.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const px = (v) => v.replace(/calc\(8px - var\(--ring-room\)\)/, "2").replace(/var\(--ring-room\)/, "6").replace(/px$/, "");
t("label → Find 8, Find → first row 8, and label → first row 8 with Find hidden", () => {
  const label = /\.side-label\{[^}]*margin:\S+ \S+ ([^ ;]+(?: - var\(--ring-room\)\))?) /.exec(css), find = /\.side-find\{[^}]*margin:(var\(--ring-room\)) 12px (calc\(8px - var\(--ring-room\)\));/.exec(css), list = /\.projects\{[^}]*padding:(var\(--ring-room\)) /.exec(css);
  assert.ok(label && find && list, "the three rules");
  const L = +px(label[1]), FT = +px(find[1]), FB = +px(find[2]), P = +px(list[1]);
  assert.deepEqual([L + FT, FB + P, L + P], [8, 8, 8]);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
