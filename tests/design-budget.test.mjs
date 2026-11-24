// @ts-check

import assert from "node:assert/strict";
import { sourcePaths, readSource } from "./lib/sources.mjs";
import { declarationFiles, stylesheetRows, tokenValuesFor } from "./lib/css-snapshot.mjs";

const SIDEBAR = /\.side\b|\.side-|\.brand|\.nrow|\.nr-|\.prow|\.pr-|\.projects|#projects|\.gear|\.theme\b|\.th-(?:track|knob)|\.sc-|\.sf-|\.nv-|#nv-|\.pf-|#side|\.nav\b|#set-side/;
const componentDeclarations = stylesheetRows.filter((row) =>
  row.property && !declarationFiles.get(row)?.includes("/vendor/")
  && !row.context.some((scope) => scope.at === "layer" && scope.params === "tokens"));

/** Every declaration outside the sidebar, token blocks, @font-face and keyframe frames. */
function declarations() {
  return componentDeclarations.filter((row) => !row.context.some((scope) => scope.at === "keyframes"))
    .map((row) => ({ sel: row.context.at(-1)?.selector, prop: row.property, value: row.value }))
    .filter(({ sel }) => sel && !/^:root(\[[^\]]*\])?(:not\([^)]*\))?$/.test(sel) && !SIDEBAR.test(sel));
}
const D = declarations();
if (process.env.VERBOSE) console.log(`  ${D.length} declarations checked`);
const literal = (re) => [...new Set(D.flatMap((d) => [...(d.prop + ":" + d.value).matchAll(re)].map((m) => m[1])))];
const where = (pred) => D.filter(pred).slice(0, 5).map((d) => `${d.sel.slice(0, 60)} { ${d.prop}: ${d.value.slice(0, 60)} }`).join("\n    ");

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
  // a nested corner may be computed from its container's: calc(var(--r-lg) - 1px) is inner = outer − inset
  const vals2 = literal(/border-radius:\s*([^;]+)/g).flatMap((v) => v.replace(/calc\(var\(--nest-r\)\s*-\s*var\(--nest-in\)\)/g, "var(--r)").replace(/calc\(var\(--r(?:-[\w]+)?\)\s*-\s*\d+px\)/g, "var(--r)").split(/\s+/));
  const bad = [...new Set(vals2.filter((v) => !/^var\(--(?:r|nest-r)(?:-[\w-]+)?\)$|^0$|^50%$|^999px$|^[123](?:\.5)?px$|^inherit$/.test(v)))];
  assert.deepEqual(bad, [], `radii off the scale: ${bad.join(", ")}`);
});

t("one motion curve (and nothing overshoots)", () => {
  const curves = literal(/cubic-bezier\(([^)]+)\)/g);
  assert.deepEqual(curves, [], `literal curves outside tokens.css: ${curves.join(" | ")}`);
  for (const value of tokenValuesFor().values()) {
    for (const match of value.matchAll(/cubic-bezier\(([^)]+)\)/g)) {
      const [, y1, , y2] = match[1].split(",").map(Number);
      assert.ok(y1 <= 1 && y2 <= 1, `an overshooting curve: ${match[0]}`);
    }
    assert.doesNotMatch(value, /\blinear\(/, "no overshooting linear() curve");
  }
});

t("no heavy shadows: floating things use var(--e2)", () => {
  const heavy = D.filter((d) => d.prop === "box-shadow" && [...d.value.matchAll(/(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)px/g)].some((m) => +m[3] >= 30));
  assert.equal(heavy.length, 0, `blurs of 30 px or more:\n    ${where((d) => heavy.includes(d))}`);
});

t("no malformed var() (a broken value drops its whole declaration without a word)", () => {
  const bad = D.filter((d) => /var\(--var\(|var\(\s*\)/.test(d.value));
  assert.equal(bad.length, 0, `malformed var():\n    ${where((d) => bad.includes(d))}`);
});


// State declarations may alias one colour role to another.
const ROLE = /^--(?:canvas|sunken|surface|float|fill-\d|line(?:-faint|-soft|-strong|-hover)?|ink(?:-\d)?|accent(?:-[\w]+)?|err(?:-ink)?|warn|info|violet|bg(?:-\d|-head)?|hair|raised|side|pop-(?:bg|line)|comp-line(?:-hi)?)$/;
t("the palette lives in tokens.css alone", () => {
  const all = [];
  for (const { context, property, value } of componentDeclarations) {
    const selector = context.at(-1)?.selector;
    if (context.some((scope) => scope.selector?.includes("[data-flavour="))) continue;
    const to = /^var\((--[\w-]+)\)$/.exec(value);
    if (!(to && ROLE.test(property) && ROLE.test(to[1])) && (ROLE.test(property) || /^--g[0-9A-F]{2}$/.test(property))) {
      all.push(`${selector}: ${property}`);
    }
    for (const match of value.matchAll(/var\(--g[0-9A-F]{2}\)/g)) all.push(`${selector}: ${match[0]}`);
  }
  assert.deepEqual(all, [], `palette defined outside tokens.css:\n    ${all.slice(0, 8).join("\n    ")}`);
});

// Motion: every transition and animation reads the motion tokens. A literal under a second (a hover, a press,
// an arrival) is off the scale; ambient loops of a second or more keep their period. The keyword curves
// (ease, ease-in, ease-out, ease-in-out) are a second motion system; linear stays for progress and spin.
t("motion timings come from the tokens", () => {
  const bad = D.filter((d) => /^(?:transition|animation)(?:-duration|-delay|-timing-function)?$/.test(d.prop) &&
    ([...d.value.matchAll(/(?:^|[\s,(])(\d*\.?\d+)(ms|s)\b/g)].some((m) => { const ms = m[2] === "s" ? +m[1] * 1000 : +m[1]; return ms > 0.02 && ms < 1000; }) ||
     /(?:^|[\s,])ease(?:-in|-out|-in-out)?(?=[\s,]|$)/.test(d.value)));
  assert.equal(bad.length, 0, `literal timings:\n    ${where((d) => bad.includes(d))}`);
});

// A curve set from script escapes the stylesheet's budget: the scripts may name only the two curves.
t("scripts use the one curve and the loop curve", () => {
  const curves = new Set();
  for (const f of sourcePaths(".js")) for (const m of readSource(f).matchAll(/cubic-bezier\(([^)]*)\)/g)) curves.add(m[1].replace(/\s/g, ""));
  const odd = [...curves].filter((c) => c !== ".2,.8,.2,1" && c !== ".45,0,.55,1");
  assert.deepEqual(odd, [], `curves in js/: ${odd.join(" | ")}`);
});

// The lightbox uses a white ring and Back to chat uses its link colour.
t("one focus ring", () => {
  const bad = D.filter((d) => d.prop === "outline" && /^2px solid/.test(d.value) && !/var\(--focus\)|rgb\(255 255 255|var\(--ret-ink\)/.test(d.value));
  assert.equal(bad.length, 0, `other rings:\n    ${where((d) => bad.includes(d))}`);
});

// What ships in @keyframes is motion too, and the curve rule can't see it: nothing grows past its own size
// (no scale above 1 — a pop or a bounce) and nothing shakes (a translate that reverses direction in one animation).
t("keyframes neither overshoot nor shake", () => {
  const bad = [];
  const animations = new Map();
  for (const row of stylesheetRows) {
    const keyframes = row.context.find((scope) => scope.at === "keyframes");
    if (!keyframes || row.property !== "transform") continue;
    if (!animations.has(keyframes)) animations.set(keyframes, []);
    animations.get(keyframes).push(row.value);
  }
  for (const [keyframes, frames] of animations) {
    const body = frames.join(" ");
    const scales = [...body.matchAll(/scale[XY]?\(\s*([\d.]+)/g)].map((x) => +x[1]);
    if (scales.some((v) => v > 1)) bad.push(`@keyframes ${keyframes.params} scales to ${Math.max(...scales)}`);
    for (const axis of ["X", "Y"]) {
      const tr = [...body.matchAll(new RegExp(`translate${axis}\\(\\s*(-?[\\d.]+)`, "g"))].map((x) => +x[1]);
      const tr2 = axis === "X" ? [...body.matchAll(/translate\(\s*(-?[\d.]+)px/g)].map((x) => +x[1]) : [];
      const seq = [...tr, ...tr2];
      const d = seq.slice(1).map((v, i) => Math.sign(v - seq[i])).filter(Boolean);
      if (d.some((x, i) => i && x !== d[i - 1])) bad.push(`@keyframes ${keyframes.params} swings both ways on ${axis}`);
    }
  }
  assert.deepEqual(bad, [], bad.join("\n    "));
});

console.log(`\n${passed} passed`);
