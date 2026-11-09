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
  assert.match(b, /if \(e\.detail > 0 && m && pressPx\(g, cg\.s\) < PRESS_PX\) \{/, "by its own target on screen, the pointer's press only (the keyboard acts at any size)");
  assert.match(b, /centerOn\(cg, \{ x: \+m\[1\], y: \+m\[2\] \}, true, Math\.min\(2\.4, Math\.max\(READABLE, cg\.s, PRESS_PX \/ Math\.max\(1, g\.offsetHeight\)\)\)\);/, "in to it, until it's pressable");
  assert.match(b, /announce\(`Closer to \$\{g\.textContent\.trim\(\) \|\| "it"\}: press it again to open it\.`\);\s*return;/, "said, and no open");
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
