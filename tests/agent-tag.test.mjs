// An agent's tag on the Map (the controls grader on e55c2d8, S083: it shrinks with the drawing, 43 × 14.8 px after Fit,
// and opened on the first tap; white on the agent's blue read 3.20:1). The owner's Map choice (9 Nov 18:02): what's too
// small to press surely brings the map in on the first press and acts on the second, so the tag takes the boxes' guard;
// and its words take one token that reads on every agent colour. The drawn result is the flows cases "S083 (tag)".
//   node tests/agent-tag.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = new URL("../", import.meta.url);
const map = readFileSync(new URL("js/map.js", R), "utf8");
const css = ["css/app.css", "css/panel.css", "css/tokens.css"].map((f) => readFileSync(new URL(f, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const lum = (h) => { const c = [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, a) => "#" + [0, 2, 4].map((i) => Math.round(a * parseInt(fg.slice(1 + i, 3 + i), 16) + (1 - a) * parseInt(bg.slice(1 + i, 3 + i), 16)).toString(16).padStart(2, "0")).join("");

t("a pointer press on a tag too small to press surely brings the map in to it, and doesn't open", () => {
  const i = map.indexOf('const g = t.closest("[data-mp-go]");'), b = map.slice(i, map.indexOf("go(g.dataset.mpGo); return;", i));
  assert.ok(i > 0, "the tag's press");
  assert.match(b, /if \(e\.detail > 0 && m && tooSmall\(g, cg\.s, true\)\) \{/, "by its own target on screen, at any scale, the pointer's press only (the keyboard acts at any size)");
  assert.match(b, /centerOn\(cg, \{ x: \+m\[1\], y: \+m\[2\] \}, true, pressScale\(g, cg\.s, true\)\);/, "in to it, until it's pressable");
  assert.match(b, /announce\(`Closer to \$\{g\.textContent\.trim\(\) \|\| "it"\}: press it again to open it\.`\);\s*return;/, "said, and no open");
});
// the owner, 9 Nov (rv_49d00670fa4c48c9): on a phone a Map box opens on one tap only from 36 px; below, the first tap
// zooms in and the second opens; a desktop stays at 24. The phone is the app's floor's breakpoint (css/phone.css, 760 px)
t("the press floor: 36 px on a phone (the app's 760 px breakpoint), 24 on a desktop; boxes, nodes and tags alike", () => {
  const floor = readFileSync(new URL("css/phone.css", R), "utf8");
  assert.match(floor, /@media \(max-width:760px\)\{\n  \/\* a label that holds a checkbox/, "the app's 36 px floor's breakpoint");
  assert.match(map, /const PHONE = typeof matchMedia === "function" \? matchMedia\("\(max-width:760px\)"\) : null;/);
  assert.match(map, /const pressMin = \(\) => \(onPhone\(\) \? 36 : PRESS_PX\);/);
  assert.match(map, /const PRESS_PX = 24;/);
  assert.match(map, /const tooSmall = \(b, s, anyScale = false\) => \(onPhone\(\) \? pressPx\(b, s\) < 36 : \(anyScale \|\| s < READABLE\) && pressPx\(b, s\) < PRESS_PX\);/, "a phone: under 36 at any scale; a desktop as before");
  const nb = map.slice(map.indexOf('const nb = t.closest("[data-node]");'), map.indexOf("const key = M.scope.key;"));
  assert.match(nb, /if \(e\.detail > 0 && tooSmall\(nb, cz\.s\)\) \{/, "a box's or a node's press");
  assert.match(nb, /centerOn\(cz, \{ x: pt\.x - tagW\(\) \/ 2, y: pt\.y \}, true, pressScale\(nb, cz\.s\)\);/, "in to where it's pressable");
  assert.match(map, /const pressScale = \(b, s, anyScale = false\) => Math\.min\(2\.4, Math\.max\(READABLE, \.\.\.\(onPhone\(\) \|\| anyScale \? \[s, pressMin\(\) \/ Math\.max\(1, Math\.min\(b\.offsetWidth, b\.offsetHeight\)\)\] : \[\]\)\)\);/, "its own size alone reaches the floor");
});
t("its words take one token that reads on every agent colour, the softer part too", () => {
  const pal = JSON.parse(map.match(/const PALETTE = (\[[^\]]+\]);/)[1]);
  const ink = css.match(/--on-agent:(#[0-9A-Fa-f]{6})/);
  assert.ok(ink, "--on-agent");
  assert.match(css, /\.dg-tag\{[^}]*background:var\(--c\);color:var\(--on-agent\)/, "the tag's words");
  assert.doesNotMatch(css, /\.dg-tag\{[^}]*color:#fff/, "never white on the agent's colour");
  const soft = +(css.match(/\.dg-tag span\{[^}]*opacity:([.\d]+)/) || [0, 1])[1];
  for (const c of pal) {
    assert.ok(cr(ink[1], c) >= 4.5, `${ink[1]} on ${c}: ${cr(ink[1], c).toFixed(2)}`);
    assert.ok(cr(mix(ink[1], c, soft), c) >= 4.5, `its softer part (${soft}) on ${c}: ${cr(mix(ink[1], c, soft), c).toFixed(2)}`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
