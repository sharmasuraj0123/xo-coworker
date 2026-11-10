// A card whose picture is positioned draws its focus ring above the picture (the controls grader on b340841, C013:
// an Artifacts card's ring, drawn by its open control as an inset outline, lay under the thumbnail, which is
// positioned and so paints over it; the top two-thirds were hidden in all four cells). A message's picture tiles had
// the same cause. And a pinned card's pin answers hover (S094: the pinned colour was the stronger rule and held).
//   node tests/card-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = read("css/app.css"), media = read("css/media.css"), fnd = read("css/foundation.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("an Artifacts card's ring is a layer above its picture, inside its edge; the open control draws none of its own", () => {
  assert.match(app, /\.md-th\{position:relative;/, "the picture is positioned (why an inset outline lay under it)");
  assert.match(app, /\.md-open:focus-visible\{outline:none\}/);
  assert.match(app, /\.md-it:has\(\.md-open:focus-visible\)::after\{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 2px var\(--focus\)\}/);
  assert.match(app, /\.md-it\{position:relative;/, "the card holds the layer");
  assert.doesNotMatch(fnd, /:is\([^)]*\.md-open[^)]*\):focus-visible\{outline-offset:-2px\}/, "no inset outline for it in the shared list");
});
t("a message's picture tile draws its ring above its picture too", () => {
  assert.match(media, /\.mx-img\{position:absolute;/, "the picture is positioned");
  assert.match(media, /\.mx-tile:focus-visible\{z-index:3;outline:none\}/);
  assert.match(media, /\.mx-tile:focus-visible::after\{content:"";position:absolute;inset:0;z-index:3;[^}]*box-shadow:inset 0 0 0 2px var\(--focus\)\}/);
});
t("a pin answers hover, a pinned one too: its own rule at least as strong as the pinned colour", () => {
  assert.match(app, /\.md-it\.is-pin \.md-pin\{color:var\(--accent\)\}/);
  assert.match(app, /\.md-it\.is-pin \.md-pin:hover\{color:var\(--accent-hover\)\}/);
  assert.match(app, /\.md-pin:hover\{background:rgb\(44 44 44 \/ \.92\);color:var\(--ink\)\}/);
  assert.match(app, /:root\[data-theme="light"\] \.md-pin:hover\{background:#FFFFFF;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
