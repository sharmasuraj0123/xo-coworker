// Gaps take the spacing scale (4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48, or a 1–2 px hairline); one-line buttons and bars are --h-ctl.
//   node tests/space-scale.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
const app = sheets.find(([f]) => f === "app.css")[1];
const SCALE = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const rule = (sel) => { const i = app.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel); return app.slice(i, app.indexOf("}", i)); };

t("every gap is on the spacing scale", () => {
  const bad = [];
  for (const [f, css] of sheets) for (const m of css.matchAll(/(?:^|[;{\s])((?:row-|column-)?gap)\s*:([^;{}]*)/g)) {
    const flat = m[2].replace(/\w*\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
    for (const n of flat.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)) if (!SCALE.has(+n[1])) bad.push(`${f}: ${m[1]}:${m[2].trim()}`);
  }
  assert.deepEqual(bad, []);
});
t("one-line buttons and bars are --h-ctl: the shared button, the checklist bar, the done line, Details, the state badge", () => {
  assert.match(rule(".badge"), /;align-self:center;gap:8px;height:var\(--h-ctl\)/);
  assert.doesNotMatch(app, /\.rn-st \.badge\{[^}]*height:/, "the run's badge is the shared one, beside its 32 px Stop");
  assert.match(rule(".b"), /;height:var\(--h-ctl\)/);
  assert.match(rule(".ck-tog"), /;height:var\(--h-ctl\)/);
  assert.match(rule(".tp-done"), /;min-height:var\(--dock-bar\)/);
  assert.match(readFileSync(new URL("../css/tokens.css", import.meta.url), "utf8"), /--dock-bar:var\(--h-row-act\); --dock-btn:var\(--h-ctl\);/);
  assert.match(rule(".dis-h"), /;min-height:var\(--h-ctl\)/);
});
t("the top bar is --h-bar with --s-3 above and below; a thread's head keeps its back line over the title", () => {
  assert.match(rule(".top"), /min-height:var\(--h-bar\);padding:var\(--s-3\) var\(--col-x\)/);
  assert.match(app, /\.top\[data-kind="thread"\]\{flex-direction:column;align-items:stretch;gap:0;padding:var\(--s-2\) var\(--hg\) var\(--s-1\)\}/);
});
t("the sub-agents line is a 24 control for its 12 px words", () => {
  assert.match(rule(".rn-log"), /;height:var\(--h-sm\);margin-top:var\(--s-1\)/);
});
console.log(`\n${passed} passed`);
