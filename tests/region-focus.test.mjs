// When the viewer draws a file's or a change's region anew, focus that was on something in it stays in it (the controls
// grader on aa2e4f9, S139, all four cells: a busy "Trying again…" pressed, then the file drew over its notice, and focus
// fell to BODY). Checked from the source: one inRegion() keeps it (the same control drawn again, by its hook, else the
// region); every place drawFile and drawDiff replace a region's content goes through it. The walk is the flows case
// "S139 (waiting)".
//   node tests/region-focus.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
const body = (name) => { const i = src.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(j, k + 1); } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("one inRegion(): focus in what goes stays in the region (the same control, else the region)", () => {
  const b = body("inRegion");
  assert.ok(b, "inRegion(host, change)");
  assert.ok(/inside = !!a && a !== host && host\.contains\(a\)/.test(b));
  assert.ok(/\(same && same\.getClientRects\(\)\.length && !same\.matches\('\[aria-busy="true"\]'\) \? same : host\)\.focus\(\{ preventScroll: true \}\)/.test(b));
});
t("every region replacement in drawFile and drawDiff goes through it", () => {
  for (const fn of ["drawFile", "drawDiff"]) {
    const b = body(fn);
    assert.ok(b, fn);
    const raw = [...b.matchAll(/(host\.innerHTML = |host\.replaceChildren\(|x\.remove\(\))/g)].filter((m) => !b.slice(Math.max(0, m.index - 120), m.index).includes("inRegion(host, () =>"));
    assert.deepEqual(raw.map((m) => m[1]), [], `${fn}: a replacement outside inRegion`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
