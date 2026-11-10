// The notices' line never lies on a control (the controls grader on f93345a, S007: on a phone "Can't reach XO" covered
// the bottom of the put-away file's × ring). On a phone the line is placed 14 px into the composer bar and rises 18
// above it; the put-away file's chip sits 8 above the bar, 32 tall. With the chip there (and no decision card between
// them), the line lies above the chip and its ring's room. A notice drawn out over Files keeps its own place.
//   node tests/notice-clear.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = read("css/app.css"), fv = read("css/fileview.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("on a phone, with the chip above the bar, the line clears the chip and its ring's room", () => {
  const into = +app.match(/\.herald\{left:10px;right:10px;bottom:calc\(100% - (\d+)px\)\}/)[1];
  const gap = +fv.match(/\.fdock:not\(:empty\)\{display:flex;[^}]*margin:0 0 (\d+)px/)[1];
  const chip = +fv.match(/\.fdock \.fchip\{max-width:100%;height:(\d+)px;/)[1];
  assert.equal(into, 14); assert.equal(gap, 8); assert.equal(chip, 32);
  assert.match(app, /\.dock:has\(> \.fdock:not\(:empty\)\):not\(:has\(> \.tdock:not\(:empty\)\)\) \.herald:not\(\.is-out\)\{bottom:calc\(100% \+ 8px \+ 32px \+ var\(--ring-room\)\)\}/);
});
t("a notice drawn out over Files keeps its own place (not moved by this)", () => {
  assert.match(fv, /\.herald\.is-out\{position:fixed;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
