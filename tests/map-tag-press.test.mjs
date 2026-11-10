// A Map status tag's words keep 4.5:1 while it's pressed (the controls grader's S083-native-status, 03:21; reproduced on
// 70375ad: the secondary words, "waiting for you" and "idle", were drawn at .85 opacity, so held by Space or the pointer
// they fell to 3.95–4.19:1 on the idle grey tag in dark and 4.38:1 on the purple waiting tag in light). The words are
// drawn in full ink, their weight (400 under the name's 600) keeping the hierarchy; the idle tag's ink is the first in
// dark (6.6:1 pressed). Pressed: purple light 5.1:1, idle light 6.3:1.
//   node tests/map-tag-press.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("a tag's secondary words aren't dimmed: full ink, a lighter weight", () => {
  const r = css.match(/\.dg-tag span\{([^}]*)\}/);
  assert.ok(r, "the rule");
  assert.doesNotMatch(r[1], /opacity/, "no opacity");
  assert.match(r[1], /font-weight:400/);
});
t("the idle tag's words in the first ink on dark", () => {
  assert.match(css, /\.dg-cur\.is-idle \.dg-tag\{background:var\(--fill-4\);color:var\(--ink\)\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
