// Every control shows it's held, a step past hovered, where a person can see it (the controls grader on 03e9b44): a
// phone's long-press menu items (S170 Copy, S171 Select text) held as hovered, the shared press layer named out for
// them; a picture's tile (S090) hovered and pressed under its own picture, 0.5–3.6% of its pixels.
//   node tests/press-reach.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const fnd = read("foundation.css"), media = read("media.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the long-press menu's items take the shared press layer over their focus fill (S170, S171)", () => {
  const press = /:where\(button,a\[href\]\[class\],[^)]*\):where\(:not\(([^{]*)\)\):where\(:active\)\{background-image:linear-gradient\(var\(--press-fill\)/.exec(fnd);
  assert.ok(press, "the press layer");
  assert.doesNotMatch(press[1], /\.lp-menu button/, "not named out of it");
});
t("a picture's tile says hover and press over its picture: a veil, deeper held (S090)", () => {
  assert.match(media, /\.mx-one::before,\.mx-tile::before\{content:"";position:absolute;inset:0;z-index:2;/);
  const hov = /\.mx-one:hover::before,\.mx-tile:hover::before\{background-color:color-mix\(in srgb,var\(--ink\) (\d+)%/.exec(media), act = /\.mx-one:active::before,\.mx-tile:active::before\{background-color:color-mix\(in srgb,var\(--ink\) (\d+)%/.exec(media);
  assert.ok(hov && act && +act[1] > +hov[1], "held deeper than hovered");
});
t("a chosen control held goes three veils deep, past its own fill and its hover's layer (C084: Follow on, held vs hovered 18–20 RGB-sum)", () => {
  assert.match(fnd, /\.is-on\):where\(:active:not\([^)]*\)\)\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important\}/);
  const one = fnd.search(/\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important/), three = fnd.search(/\.is-on\):where\(:active/);
  assert.ok(one >= 0 && three > one, "after the shared press, so it wins on a chosen control");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
