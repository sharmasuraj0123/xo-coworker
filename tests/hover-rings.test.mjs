// Hover never draws a ring (the owner's pick D, 21 Nov): a hovered control changes its fill, never its border,
// outline or a ring shadow. A border that follows the fill (a filled button's) and a disabled control's rest are fine.
//   node tests/hover-rings.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "flavours.css").map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const rings = (body) => {
  const d = Object.fromEntries(body.split(";").map((x) => x.split(/:(.*)/s).map((y) => (y || "").trim())).filter(([k]) => k));
  const out = [];
  for (const [k, v] of Object.entries(d)) {
    if (/^border(-\w+)?-color$/.test(k) && !/transparent/.test(v) && v !== d.background && v !== d["background-color"]) out.push(`${k}:${v}`);
    if (/^outline(-color)?$/.test(k) && !/^(none|0)$/.test(v)) out.push(`${k}:${v}`);
    if (k === "box-shadow" && v !== "none" && (/inset/.test(v) || /(^|,)\s*0 0 0 \d/.test(v))) out.push(`${k}:${v}`);
  }
  return out;
};

t("no hover rule draws a ring: border, outline or ring shadow", () => {
  const bad = [];
  for (const [f, css] of sheets) for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().split("\n").pop().trim();
    if (sel.startsWith("@") || !sel.includes(":hover")) continue;
    if (/:disabled|\[aria-disabled="true"\]/.test(sel.replace(/:not\([^)]*\)/g, "").replace(/:where\(:not\([^)]*\)\)/g, ""))) continue;
    const r = rings(m[2]);
    if (r.length) bad.push(`${f}  ${sel}  ${r.join("; ")}`);
  }
  assert.deepEqual(bad, [], `hover rings:\n  ${bad.join("\n  ")}`);
});
t("the herald's hover is its fill alone: the lines' hover over its glass", () => {
  const app = sheets.find(([f]) => f === "app.css")[1];
  assert.match(app, /\nbutton\.hr:hover\{background:linear-gradient\(var\(--hover-fill\),var\(--hover-fill\)\),var\(--glass\)\}/);
});
t("keyboard focus keeps the soft ring, on :focus-visible", () => {
  assert.match(sheets.find(([f]) => f === "base.css")[1], /:focus-visible\{outline:3px solid var\(--focus\);outline-offset:1px\}/);
});
console.log(`\n${passed} passed`);
