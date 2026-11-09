// A field the keyboard is in shows the one ring (the controls grader on 9d1f71b, C030 Find a loaded file and S069 the new
// file's name, all four cells: focus showed only as a darker edge). Checked from the CSS: every field whose own outline
// is taken away shows the ring on its box (a box holding a borderless search field) or on itself, the base ring's 2 px
// of the focus colour. The drawn ring is the flows case "C030/S069".
//   node tests/field-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const all = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("Files' Find and the new file's name, and the other search boxes, show the one ring", () => {
  const rule = /:is\(\.fl-q,\.all-q,\.ar-q\):has\(input:focus-visible\),\.fl-new-r input:focus-visible\{outline:2px solid var\(--focus\);outline-offset:1px\}/;
  assert.ok(rule.test(all), "the one rule");
  assert.ok(/:focus-visible\{outline:2px solid var\(--focus\);outline-offset:2px\}/.test(all), "the base ring it matches");
});
t("each search box it names holds a field whose own outline is taken away (so the box must show it)", () => {
  for (const box of ["fl-q", "all-q", "ar-q"]) assert.ok(new RegExp(`\\.${box} input\\{[^}]*outline:none`).test(all), `.${box} input has outline:none`);
  assert.ok(/\.fl-new-r input\{[^}]*outline:none/.test(all), ".fl-new-r input has outline:none");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
