// node tests/since-card-gone.test.mjs: the Since you left card (removed for the one quiet line) has no code, no styles and no control rows left.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePaths, readSource } from "./lib/sources.mjs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("nothing draws the card or its controls", () => {
  for (const f of sourcePaths(".js")) {
    const src = readSource(f);
    assert.doesNotMatch(src, /class="syl[ "-]|data-rec-more|data-made-open|projectSince|homeSinceHtml/, f);
  }
});
t("the app's own sheets keep no rule for it", () => {
  for (const f of ["css/app.css", ...sourcePaths(".css").filter((p) => p.startsWith("modules/"))]) assert.doesNotMatch(readSource(f).replace(/\/\*[\s\S]*?\*\//g, ""), /\.syl[\w-]*\b/, f);
});
t("the control registry lists none of its buttons", () => {
  const ids = JSON.parse(readFileSync(new URL("../e2e/fixtures/controls/controls-ids.json", import.meta.url), "utf8")).ids;
  for (const e of Object.values(ids)) assert.doesNotMatch(e.key, /data-rec-more|data-made-open/);
});
t("the quiet line stays: Got it, its parts and Home's lines", () => {
  const rv = readSource("js/recordview.js");
  assert.match(rv, /function sinceLine\(pid, needs\)/);
  assert.match(rv, /function homeSinceLines\(needs\)/);
  assert.match(rv, /data-rec-got/);
});
console.log(`\n${passed} passed`);
