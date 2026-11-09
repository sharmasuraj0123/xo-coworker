// The first-run question, answered while the chosen preset's file is still being read: the choice shows as chosen
// and busy, and the sheet's other controls say they're waiting (aria-disabled, no hover), so a later press is ignored
// honestly, not silently (the create-project/Launchpad grader's source lead on 4d33649, S117: done() set _done and
// waited, the buttons kept their ordinary labels and states; its case first-run-delayed-choice-and-refused-shared-write).
//   node tests/shape-first-pending.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const src = readFileSync(new URL("../js/shapeview.js", import.meta.url), "utf8");
const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const done = (() => { const i = src.indexOf("const done = async (id) => {"); assert.ok(i >= 0, "done()"); return src.slice(i, src.indexOf("\n    };\n", i)); })();

t("before it waits, the choice is marked chosen and busy, and every control in the sheet waiting", () => {
  const wait = done.indexOf("await shape.choose(id)");
  assert.ok(wait > 0, "it waits for the choice");
  const before = done.slice(0, wait);
  assert.match(before, /for \(const b of el\.querySelectorAll\("button"\)\)/, "every button in the sheet");
  assert.match(before, /b\.setAttribute\("aria-disabled", "true"\)/, "says it's waiting");
  assert.match(before, /if \(b\.dataset\.shf === id\) \{ b\.classList\.add\("is-on"\); b\.setAttribute\("aria-busy", "true"\); \}/, "the chosen one shows as chosen, busy");
});
t("a waiting control shows no hover: the cards and the sheet's Not now", () => {
  assert.ok(/\.set-choice:not\(:disabled,\[aria-disabled="true"\]\):hover\{/.test(css), "a card's edge");
  // (:where: the same weight as before, so no other rule's look changes)
  assert.ok(/\.shp-first-c \.set-choice:where\(:not\(\[aria-disabled="true"\]\)\):hover\{/.test(css), "a first-run card's fill");
  assert.ok(/\.x:where\(:not\(\[aria-disabled="true"\]\)\):hover\{/.test(css), "a sheet's ×");
  assert.ok(!/\.set-choice:not\(:disabled\):hover\{/.test(css) && !/\.shp-first-c \.set-choice:hover\{/.test(css) && !/(^|\})\.x:hover\{/.test(css), "the old hovers are gone");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
