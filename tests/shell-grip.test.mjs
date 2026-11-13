// The Shells dock's separator is a 24 px band to take hold of, centred on the dock's line, which stays thin (the
// owner's decision, 10 Nov 18:30, S269: the 8 px band was hard to find). Its pill and its ring keep their place on the
// line; the band never takes a click from the controls beside it: the shell bar's below (they stand above it) and the
// composer above (18 px clear of the band's 12). A phone hides it, by design.
//   node tests/shell-grip.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const px = (re) => { const m = re.exec(app); assert.ok(m, String(re)); return m.slice(1).map(Number); };

t("the band is 24 px, centred on the line (12 above, 12 below)", () => {
  const [top, h] = px(/\.shd-grip\{position:absolute;left:0;right:0;top:-(\d+)px;height:(\d+)px;z-index:2;/);
  assert.equal(h, 24); assert.equal(top, h / 2);
});
t("its pill sits on the line, and its ring is the 12 px it was, drawn 8 px inside the band", () => {
  const [pt, ph] = px(/\.shd-grip::after\{[^}]*top:(\d+)px;width:36px;height:(\d+)px;/);
  assert.equal(pt + ph / 2, 12, "the pill's middle on the line");
  assert.match(app, /\.shd-grip:focus-visible\{outline-offset:-8px\}/);
});
t("the band never takes a click from what's beside it", () => {
  const [z] = px(/\.shd-bar :is\(button,\[role=tab\],a,input\)\{position:relative;z-index:(\d+)\}/);
  assert.ok(z > 2, "the shell bar's controls stand above the band (z 2)");
  const [, bottom] = px(/\.cbar\{position:relative;padding:(\d+)px 0 (\d+)px;/);
  assert.ok(bottom >= 12, `the composer sits ${bottom} px above the dock's line, clear of the band's 12`);
});
t("a phone hides it, by design", () => assert.match(app, /@media \(max-width:760px\)\{[\s\S]*?\.shd-grip\{display:none\}/));
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
