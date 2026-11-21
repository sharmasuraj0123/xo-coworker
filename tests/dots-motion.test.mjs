import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

test("the dots share one long sequence of the loop and the row turns with them", () => {
  for (const n of ["a", "b", "c", "turn"]) assert.match(css, new RegExp(`@keyframes dot-${n}\\{`));
  assert.match(css, /\.dots\{[^}]*animation:dot-turn calc\(var\(--d-loop\) \* 8\)/);
  assert.match(css, /\.dots i\{[^}]*animation:dot-a calc\(var\(--d-loop\) \* 8\)/);
  assert.match(css, /@keyframes dot-glow\{/);
});

test("the dots move only translate, rotate, scale and opacity", () => {
  for (const k of css.match(/@keyframes dot-[a-z]+\{(?:[^{}]*\{[^}]*\})*\}/g)) for (const d of k.match(/\{[^{}]*\}/g)) for (const p of d.slice(1, -1).split(";").filter(Boolean)) assert.ok(["translate", "rotate", "scale", "opacity"].includes(p.split(":")[0]), p);
});

test("the dots stay on the page's one clock and still under reduced motion", () => {
  assert.match(ui, /String\(a\.animationName\)\.startsWith\("dot-"\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.dots\{animation:none\}\.dots i\{animation:none/);
});
