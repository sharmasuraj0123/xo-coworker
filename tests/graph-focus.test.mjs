// A Graph dot the keyboard is on shows the ring, whatever else the dot is (the map grader on 65e84b7, S082, all four
// cells: focus-visible was true but the dot's paint didn't change, because the folded folder's rule and the panel's
// rule each set the whole box-shadow, and outweighed the focus rule). By design, not by weight: the dot's paint is one
// shadow of four named layers, and every state sets only its own layer, so none can take the focus ring away.
// Checked from the source; the drawn ring is the grader's case graph-focus-paint (closed folder, open folder, file).
//   node tests/graph-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const R = new URL("../", import.meta.url);
const css = readdirSync(new URL("css/", R)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`css/${f}`, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
// every rule whose selector paints the dot, with its declarations
const rules = [...css.matchAll(/([^{}]*\.gn-d[^{}]*)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const LAYERS = "box-shadow:var(--gn-in,inset 0 0 #0000),0 0 0 2px var(--gn-gap),var(--gn-focus,0 0 #0000),var(--gn-halo,0 0 #0000)";

t("the dot's paint is one shadow of four named layers", () => {
  const base = rules.filter((r) => r.sel === ".gn-d");
  assert.equal(base.length, 1, "one base rule");
  assert.ok(base[0].body.includes(LAYERS), `the base composes the layers: ${base[0].body}`);
  assert.ok(base[0].body.includes("--gn-gap:var(--canvas)"), "the gap is the canvas by default");
});
t("no state sets the whole shadow: each sets its own layer", () => {
  const whole = rules.filter((r) => r.sel !== ".gn-d" && /(^|;)\s*box-shadow:/.test(r.body)).map((r) => r.sel);
  assert.deepEqual(whole, [], "rules that would replace every layer, the focus ring with them");
});
t("focus sets the focus layer: the one ring, 2 px of the focus colour under the 2 px gap", () => {
  const f = rules.filter((r) => /\.gn:focus-visible \.gn-d$/.test(r.sel));
  assert.equal(f.length, 1, "one focus rule");
  assert.equal(f[0].body.trim(), "--gn-focus:0 0 0 4px var(--focus)");
  assert.ok(!rules.some((r) => !/focus-visible/.test(r.sel) && r.body.includes("--gn-focus:")), "and nothing else touches it");
});
t("the states keep their looks, each in its own layer", () => {
  const has = (sel, decl) => assert.ok(rules.some((r) => r.sel === sel && r.body.includes(decl)), `${sel} { ${decl} }`);
  has(".gn.k-dir:not(.is-open) .gn-d", "--gn-in:inset 0 0 0 1.5px var(--ink-3)");
  has(".gn.is-here .gn-d", "--gn-halo:0 0 0 5px color-mix(in srgb,var(--c) 25%,transparent)");
  has(".stage .map-host .gn-d", "--gn-gap:var(--panel-canvas)");
  has(':root[data-theme="light"] .gn-d', "--gn-gap:#FAFAFA");
  has(':root[data-theme="light"] .stage .map-host .gn.is-here .gn-d', "--gn-in:inset 0 0 0 1px color-mix(in srgb,var(--c) 70%,#000)");
});
t("the hit pulse keeps the layers too (an animation outweighs every rule while it runs)", () => {
  const k = css.match(/@keyframes gn-hit\{([\s\S]*?\})\}/);
  assert.ok(k, "the pulse");
  const frames = [...k[1].matchAll(/box-shadow:([^}]*)\}/g)].map((m) => m[1]);
  assert.equal(frames.length, 2);
  for (const f of frames) assert.ok(f.startsWith("var(--gn-in,inset 0 0 #0000),0 0 0 2px var(--gn-gap),var(--gn-focus,0 0 #0000),"), `a frame keeps the gap and the ring: ${f}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
