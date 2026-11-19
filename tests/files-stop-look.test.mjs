// The owner's 19 Nov 08:57Z message: Files' Back to chat was too big and overwhelming ("make it something normal"),
// and Stop was "a big white circle with a very small square inside it" ("i don't want harsh corners anywhere").
// Back to chat is a quiet control on the scale; Stop is a stone disc with a rounded square, concentric with the composer.
//   node tests/files-stop-look.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const nc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("Back to chat is a quiet control: 32 tall, the head's 8 px corner, no fill or hairline at rest", () => {
  const fv = nc(read("css/fileview.css"));
  const r = /\.fv-ret\{([^}]*)\}/.exec(fv)[1];
  assert.match(r, /height:32px/);
  assert.match(r, /border-radius:var\(--r\)/);
  assert.doesNotMatch(r, /(^|;)(background|box-shadow|border):/);
  assert.doesNotMatch(fv, /--ret-(ink|fill|line|hover)/, "no plum left");
});
t("Stop: a stone disc with a 14 px square of 4 px corners, its radius concentric with the composer's", () => {
  const app = nc(read("css/app.css")), js = read("js/app.js"), tok = read("css/tokens.css");
  assert.match(js, /const STOP_ICON = `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="4" fill="currentColor"\/><\/svg>`;/);
  assert.match(app, /\.send\.is-stop\{--stop:var\(--fill-4\);--ring-in:var\(--focus\);background:var\(--stop\);color:var\(--ink\)\}/);
  assert.match(app, /\.send\.is-stop svg\{width:14px;height:14px\}/);
  // the disc's radius is the composer's corner less its inset: 28 − (1 border + 9 padding − 2 margin) = 20 = 40 / 2
  const comp = /\.composer\{[^}]*padding:12px 9px 9px 9px;border:1px solid[^}]*border-radius:var\(--r-3xl\)/.test(app);
  assert.ok(comp, "the composer's corner and inset as measured");
  assert.match(tok, /--r-3xl:28px/);
  assert.match(app, /\.send\{[^}]*width:var\(--h-lg\);height:var\(--h-lg\);margin:-2px -2px -2px 0;border-radius:50%/);
  assert.match(tok, /--h-lg:40px/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
