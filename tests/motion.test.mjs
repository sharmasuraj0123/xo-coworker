// One motion system: the curve and durations the code animates with are the ones css/tokens.css draws with.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const M = await import("../core/ui/motion.js");
const tokens = readFileSync(new URL("../css/tokens.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the curve and the three durations are the tokens'", () => {
  const tok = (n) => (tokens.match(new RegExp(`--${n}:([^;]+);`)) || [])[1];
  assert.equal(M.EASE, tok("ease"));
  assert.equal(`${M.IN}ms`, tok("d-in"));
  assert.equal(`${M.MOVE}ms`, tok("d-move"));
  assert.equal(`${M.OUT}ms`, tok("d-out"));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
