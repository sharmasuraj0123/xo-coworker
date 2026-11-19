// One motion system: the curve and durations are the tokens', and only core/ui/motion.js keeps the curve or asks for reduced motion.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

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
t("no other file keeps a copy of the curve or asks the reduced-motion question itself", () => {
  const platformOwned = new Set(["js/gestures.js"]);
  const copies = [];
  for (const dir of ["js", "core"]) for (const f of readdirSync(new URL(`../${dir}`, import.meta.url), { recursive: true })) {
    const p = `${dir}/${f}`;
    if (!p.endsWith(".js") || p.includes("vendor/") || p === "core/ui/motion.js" || platformOwned.has(p)) continue;
    const s = readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    if (s.includes("cubic-bezier(.2,.8,.2,1)") || s.includes('matchMedia("(prefers-reduced-motion: reduce)")')) copies.push(p);
  }
  assert.deepEqual(copies, []);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
