// The sidebar's Projects line and the first project row sit 8 px apart: the label's bottom margin and the list's ring room.
//   node tests/side-spacing.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const px = (v) => v.replace(/calc\(8px - var\(--ring-room\)\)/, "2").replace(/var\(--ring-room\)/, "6").replace(/px$/, "");
t("label → first row 8", () => {
  const label = /\.side-label\{[^}]*margin:\S+ \S+ ([^ ;]+(?: - var\(--ring-room\)\))?) /.exec(css), list = /\.projects\{[^}]*padding:(var\(--ring-room\)) /.exec(css);
  assert.ok(label && list, "the two rules");
  assert.equal(+px(label[1]) + +px(list[1]), 8);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
