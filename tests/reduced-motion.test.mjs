// Reduced motion: nothing moves, and nothing lags. A 0.01 ms transition on every property of every element (the
// default property list is "all") left a change unmade for a moment: a sheet just shown read hidden, and focus handed
// into it was refused (C029/F08: a phone's folded chat bar tapped, its head refused focus, which fell to the page;
// and grips and fields read outline:none's 3 px for a moment: C034/C035, C030/S069). Checked from base.css; the
// waits on a transition's or an animation's end keep their own time-outs.
//   node tests/reduced-motion.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = readFileSync(new URL("../css/base.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const js = (f) => readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("under reduced motion, transitions are none: no duration, no delay", () => {
  const m = /@media \(prefers-reduced-motion:reduce\)\{\s*\*,\*::before,\*::after\{([^}]*)\}/.exec(base);
  assert.ok(m, "the global reduced-motion rule");
  assert.match(m[1], /transition-duration:0s!important/);
  assert.match(m[1], /transition-delay:0s!important/);
  assert.doesNotMatch(m[1], /transition-duration:\.01ms/, "never a tiny transition on everything");
});
t("the waits on a transition's or an animation's end have their own time-outs", () => {
  assert.match(js("media.js"), /addEventListener\("transitionend"[^\n]*\n\s*setTimeout\(done, MOVE \+ 80\)/);
  assert.match(js("dropdown.js"), /addEventListener\("animationend", done, \{ once: true \}\); setTimeout\(done, \d+\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
