import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { colorOf } from "../modules/map/layout.js";

const R = new URL("../", import.meta.url);
const css = ["css/app.css", "css/panel.css", "core/ui/tokens.css"].map((f) => sheet(new URL(f, R))).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const lum = (h) => { const c = [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, a) => "#" + [0, 2, 4].map((i) => Math.round(a * parseInt(fg.slice(1 + i, 3 + i), 16) + (1 - a) * parseInt(bg.slice(1 + i, 3 + i), 16)).toString(16).padStart(2, "0")).join("");

t("its words take one token that reads on every agent colour, the softer part too", () => {
  const pal = new Set("abcdef".split("").map(colorOf));
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
