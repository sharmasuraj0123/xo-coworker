// The design budget (design-research/2026-11-vision/direction, "Plan F"): every stylesheet is built from
// the one scale in css/tokens.css, and this test fails the moment a new literal size, weight, radius,
// curve or heavy shadow sneaks back in. It counts what the CSS declares, outside the left sidebar
// (which keeps its own look, the owner's decision) and outside the token file itself.
// No network, no browser.
//   node tests/design-budget.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../css/", import.meta.url);
const SIDEBAR = /\.side\b|\.side-|\.brand|\.nrow|\.nr-|\.prow|\.pr-|\.projects|#projects|\.gear|\.theme\b|\.th-(?:track|knob)|\.sc-|\.sf-|\.nv-|#nv-|\.pf-|#side|\.nav\b|#set-side/;
const FRAME = /^\s*(?:from|to|[\d.]+%)(?:\s*,\s*(?:from|to|[\d.]+%))*\s*$/;

/** Every declaration outside the sidebar, token blocks, @font-face and keyframe frames. */
function declarations() {
  const out = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith(".css") && n !== "tokens.css")) {
    const css = readFileSync(new URL(f, DIR), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const sel = m[1].trim();
      if (!sel || sel.startsWith("@font-face") || FRAME.test(sel) || /^:root(\[[^\]]*\])?(:not\([^)]*\))?$/.test(sel) || SIDEBAR.test(sel)) continue;
      for (const d of m[2].split(/;(?![^(]*\))/)) {
        const i = d.indexOf(":");
        if (i > 0) out.push({ file: f, sel, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() });
      }
    }
  }
  return out;
}
const D = declarations();
if (process.env.VERBOSE) console.log(`  ${D.length} declarations checked`);
const literal = (re) => [...new Set(D.flatMap((d) => [...(d.prop + ":" + d.value).matchAll(re)].map((m) => m[1])))];
const where = (pred) => D.filter(pred).slice(0, 5).map((d) => `${d.file}: ${d.sel.slice(0, 60)} { ${d.prop}: ${d.value.slice(0, 60)} }`).join("\n    ");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n    " + e.message); process.exitCode = 1; }
};

// Px font sizes allowed outside the token names: 16 (inputs: a phone zooms into anything smaller) and
// the 9–10 px glyph marks drawn as text (counts inside dots, arrows). Everything else uses --fs-*.
const SIZE_OK = new Set(["16px", "9px", "10px"]);
t("font sizes come from the scale", () => {
  const bad = D.filter((d) => (d.prop === "font-size" && /^[\d.]+px/.test(d.value) && !SIZE_OK.has(d.value)) || (d.prop === "font" && /(?:^|\s)([\d.]+px)(?:\/|\s)/.test(d.value) && !SIZE_OK.has(d.value.match(/(?:^|\s)([\d.]+px)/)[1])));
  assert.equal(bad.length, 0, `literal sizes off the scale:\n    ${where((d) => bad.includes(d))}`);
});

t("three weights: 400, 500, 600", () => {
  const ws = literal(/(?:font-weight:\s*|font:\s*(?:italic\s+)?)(\d{3})\b/g).filter((w) => !["400", "500", "600"].includes(w));
  assert.deepEqual(ws, [], `weights off the scale: ${ws.join(", ")}`);
});

t("line heights are whole pixels", () => {
  const bad = D.filter((d) => (d.prop === "line-height" && /^\d*\.\d+$|^1\.\d+$/.test(d.value)) || (d.prop === "font" && /\/(\d*\.\d+|1\.\d+)\s/.test(d.value)));
  // the ceiling is today's count; it only ever goes down (a rule with no size of its own can't be pinned yet)
  assert.ok(bad.length <= 3, `${bad.length} unitless line heights (ceiling 3):\n    ${where((d) => bad.includes(d))}`);
});

// Radii: the tokens, 50%/999px for round things, and 1–3 px hairline details (segments, carets).
t("radii come from the scale", () => {
  const vals = literal(/border-radius:\s*([^;]+)/g).flatMap((v) => v.split(/\s+/));
  // a nested corner may be computed from its container's: calc(var(--r-lg) - 1px) is inner = outer − inset
  const vals2 = literal(/border-radius:\s*([^;]+)/g).flatMap((v) => v.replace(/calc\(var\(--r(?:-[\w]+)?\)\s*-\s*\d+px\)/g, "var(--r)").split(/\s+/));
  const bad = [...new Set(vals2.filter((v) => !/^var\(--r(?:-[\w]+)?\)$|^0$|^50%$|^999px$|^[123](?:\.5)?px$|^inherit$/.test(v)))];
  assert.deepEqual(bad, [], `radii off the scale: ${bad.join(", ")}`);
});

t("one motion curve (and nothing overshoots)", () => {
  const curves = literal(/cubic-bezier\(([^)]+)\)/g);
  assert.deepEqual(curves, [], `literal curves outside tokens.css: ${curves.join(" | ")}`);
  const tokens = readFileSync(new URL("tokens.css", DIR), "utf8");
  for (const m of tokens.matchAll(/cubic-bezier\(([^)]+)\)/g)) {
    const [, y1, , y2] = m[1].split(",").map(Number);
    assert.ok(y1 <= 1 && y2 <= 1, `an overshooting curve in tokens.css: ${m[0]}`);
  }
});

t("no heavy shadows: floating things use var(--e2)", () => {
  const heavy = D.filter((d) => d.prop === "box-shadow" && [...d.value.matchAll(/(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)px/g)].some((m) => +m[3] >= 30));
  assert.equal(heavy.length, 0, `blurs of 30 px or more:\n    ${where((d) => heavy.includes(d))}`);
});

console.log(`\n${passed} passed`);
