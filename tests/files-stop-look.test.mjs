// The owner's 19 Nov 08:57Z message: Stop was "a big white circle with a very small square inside it" ("i don't want harsh corners anywhere").
// (Files' Back to chat, the other half of it, went with the Files place: Files is a page of the panel.) Stop is a stone disc with a rounded square, concentric with the composer.
//   node tests/files-stop-look.test.mjs
import assert from "node:assert/strict";
import { resolveTokens, NEW_SIZES } from "./lib/tokens.mjs";
import { readFileSync } from "node:fs";

const read = (f) => { const s = readFileSync(new URL(`../${f}`, import.meta.url), "utf8"); return f.endsWith(".css") ? resolveTokens(s, [...NEW_SIZES, "--h-ctl"]) : s; };
const nc = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("Stop: a stone disc with the owner's stop square, its radius concentric with the composer's", () => {
  const app = nc(read("css/app.css")), js = read("js/app.js");
  // the owner's stop (assets/icons/xo/c-actions/stop.svg: a 12 square, 3.5 corners, on the 24 grid), at --ic-lg
  assert.match(js, /const STOP_ICON = ICON\.stop;/);
  assert.match(app, /\.send\.is-stop\{--stop:var\(--fill-4\);--ring-in:var\(--focus\);background:var\(--stop\);color:var\(--ink\)\}/);
  assert.match(app, /\.send\.is-stop svg\{width:var\(--ic-lg\);height:var\(--ic-lg\)\}/);
  // the disc is Send itself, so its corner sits on the composer's: tests/card-family.test.mjs
  assert.match(app, /\.send\{[^}]*width:var\(--comp-ctl\);height:var\(--comp-ctl\);border-radius:50%/);
  assert.doesNotMatch(app, /\.send\.is-stop\{[^}]*(?:width|height|margin|border-radius):/, "Stop keeps Send's size and place");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
