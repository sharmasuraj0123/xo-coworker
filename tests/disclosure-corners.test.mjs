// An open checklist's toggle squares its bottom corners (its press fill met the list with rounded notches); inner corners are one token.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const css = (f) => readFileSync(new URL(f, dir), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("a box inside a --r-lg box's border uses --r-lg-in, never a hand-written calc", () => {
  assert.match(css("../core/ui/tokens.css"), /--r-lg-in:calc\(var\(--r-lg\) - 1px\);/);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "tokens.css")) assert.doesNotMatch(css(f), /calc\(var\(--r-lg\) - 1px\)/, f);
});
t("the toggle has the bar's inner corners, and open, its bottom ones square where it meets its list", () => {
  const app = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(app, /\n\.ck-tog\{[^}]*border-radius:var\(--r-lg-in\)/);
  assert.match(app, /\n\.ckbar\.is-open \.ck-tog\{border-end-start-radius:0;border-end-end-radius:0\}/);
});
console.log(`\n${passed} passed`);
