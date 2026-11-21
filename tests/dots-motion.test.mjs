import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

test("each dot travels its own path at its own period of the one loop", () => {
  for (const n of ["a", "b", "c"]) assert.match(css, new RegExp(`@keyframes dot-${n}\\{`));
  assert.match(css, /\.dots i:nth-child\(2\)\{[^}]*animation-duration:calc\(var\(--d-loop\) \* 4 \/ 3\)/);
  assert.match(css, /\.dots i:nth-child\(3\)\{[^}]*animation-duration:calc\(var\(--d-loop\) \* 5 \/ 3\)/);
  assert.match(css, /@keyframes dot-glow\{/);
});

test("the dots move only translate, scale and opacity", () => {
  for (const k of css.match(/@keyframes dot-[a-z]+\{(?:[^{}]*\{[^}]*\})*\}/g)) for (const d of k.match(/\{[^{}]*\}/g)) for (const p of d.slice(1, -1).split(";").filter(Boolean)) assert.ok(["translate", "scale", "opacity"].includes(p.split(":")[0]), p);
});

test("the dots stay on the page's one clock and still under reduced motion", () => {
  assert.match(ui, /String\(a\.animationName\)\.startsWith\("dot-"\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.dots i\{animation:none/);
});
