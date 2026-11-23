// A hover never darkens what it's on: it's the translucent hover veil over the control's own fill, not a solid fill
// (--fill-1 sits under the surface in dark, so a row painted with it looked like something else was hovered). More
// opens a menu, so it shows a chevron, and lists places, not Settings' pages. Launchpad's Prepare and Deploy share
// one width: the widest button's column.
//   node tests/hover-veil.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const ROOT = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("no hover paints a solid --fill-1 or --fill-2", () => {
  const bad = [];
  for (const f of readdirSync(new URL("css/", ROOT)).filter((x) => x.endsWith(".css"))) {
    const css = read(`css/${f}`).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) if (m[1].includes(":hover") && /background(-color)?:var\(--fill-[12]\)/.test(m[2])) bad.push(`${f}: ${m[1].trim()}`);
  }
  assert.deepEqual(bad, []);
});
t("Launchpad's row hover is the veil", () => {
  assert.match(read("css/launchpad.css"), /button\.lqp-app:hover\{background-image:linear-gradient\(var\(--hover-fill\),var\(--hover-fill\)\)\}/);
});
t("More shows a chevron, hidden on the folded rail", () => {
  assert.match(read("index.html"), /id="nv-more"[^>]*>.*<span class="nr-name">More<\/span><span class="nr-chev" aria-hidden="true"><\/span><\/button>/);
  assert.match(read("js/app.js"), /\$\("#nv-more \.nr-chev"\)\.innerHTML = ICON\.right;/);
  assert.match(read("css/side.css"), /\.side-folded :is\([^)]*\.nr-chev[^)]*\)\{display:none\}/);
});
t("More lists places, not Settings' pages; the editor still lists every place", () => {
  const app = read("js/app.js");
  for (const id of ["routing", "rules", "worktrees", "keys"]) assert.match(app, new RegExp(`\\{ set: true, id: "${id}"`));
  for (const id of ["launchpad", "runtimes"]) assert.match(app, new RegExp(`\\{ id: "${id}"`));
  assert.ok(app.indexOf('{ id: "launchpad"') < app.indexOf('{ id: "runtimes"'), "Launchpad first");
  assert.match(app, /const rest = b\.order\.filter\(\(id\) => !b\.shown\.includes\(id\)\)\.map\(\(id\) => SIDE\.byId\(id\)\)\.filter\(\(p\) => !p\.set\);/);
  assert.match(app, /b\.order\.map\(\(id\) => \{ const p = SIDE\.byId\(id\), on = b\.shown\.includes\(id\);/, "the editor maps every place");
});
t("Launchpad's not-yet list shares one button column across its rows", () => {
  const css = read("css/launchpad.css");
  assert.match(css, /\.lqp-off\{display:grid;grid-template-columns:var\(--tile-xl\) minmax\(0,1fr\) auto;/);
  assert.match(css, /\.lqp-off \.lqp-app\{grid-column:1\/-1;grid-template-columns:subgrid\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
