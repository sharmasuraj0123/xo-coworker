// Escape in the sidebar's empty "Find a project" leaves it for a place, never the page (the create-project grader on
// c8f4c45, C007, artifacts-family project-find, 1440 dark and light, 390 dark: a second Escape blurred the field and
// focus fell to BODY). A first Escape clears what's typed and stays; an empty one goes back to where you are: on a
// phone with the drawer open, it closes the drawer (focus to what opened it); otherwise to the place's own region.
//   node tests/project-find-escape.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const h = (() => { const i = src.indexOf('const inp = $("#pf-in");'); assert.ok(i > 0); return src.slice(i, src.indexOf("\n}\n", i)); })();

t("a typed filter: Escape clears it and stays", () => {
  assert.match(h, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); if \(inp\.value\) \{ inp\.value = ""; set\(""\); \}/);
});
t("an empty one: the drawer closes on a phone, else the place's region takes focus; never a bare blur", () => {
  assert.match(h, /else if \(PHONE\.matches && \$\("#app"\)\.classList\.contains\("drawer"\)\) setDrawer\(false\); else placeRegion\(\)\.focus\(\{ preventScroll: true \}\);/);
  assert.doesNotMatch(h, /inp\.blur\(\)/, "blur drops focus to the page");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
