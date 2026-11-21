// Find an artifact's box follows the one rule for every message and search box: no ring of its own while you type
// (the owner, 11 Nov 07:52Z: "remove the current border of textbox").
//   node tests/conv-find-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const all = css.map(([, s]) => s).join("\n");
t("Find an artifact's box is in the one no-ring rule", () => {
  const m = /:is\(([^)]*)\):has\(:is\(input,textarea\):focus-visible\)[^{]*\{outline:none\}/.exec(all);
  assert.ok(m, "the rule"); assert.ok(m[1].split(",").includes(".ar-q"), ".ar-q in it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
