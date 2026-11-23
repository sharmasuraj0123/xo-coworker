// A text field shows it is active by its accent caret and a thin accent edge with a soft glow, never the ring; keyboard focus elsewhere is a soft ring hugging the control.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { readSource } from "./lib/sources.mjs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]);
const css = (f) => sheets.find(([n]) => n === f)[1];
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("every text field drops the ring and takes the accent caret", () => {
  const f = css("foundation.css");
  assert.match(f, /\n:is\(input:not\(\[type=checkbox\],\[type=radio\],\[type=range\],\[type=button\],\[type=submit\],\[type=reset\],\[type=file\],\[type=color\],\[type=image\]\),textarea,\[contenteditable\]\):focus-visible\{outline:none\}/);
  assert.match(f, /\n:is\(input,textarea,\[contenteditable\]\)\{caret-color:var\(--accent\)\}/);
});
t("a bordered field typed in takes the accent edge and the soft glow outside it, both tokens", () => {
  assert.match(css("foundation.css"), /\n:is\(\.field input,\.field textarea,\.lp-in,\.shd-in,\.c-note textarea,\.tw-in,\.c-q-in,\.c-name-in\):focus\{border-color:var\(--field-line-focus\);box-shadow:0 0 0 3px var\(--focus-halo\)\}/);
  const tok = readSource("core/ui/tokens.css");
  assert.equal((tok.match(/--field-line-focus:rgba\(var\(--accent-rgb\),\.8\);/g) || []).length, 2);
  assert.equal((tok.match(/--focus-halo:rgba\(var\(--accent-rgb\),\.2\);/g) || []).length, 2);
});
t("no field draws its own ring, and no focus rule writes a colour of its own", () => {
  const bad = [];
  for (const [f, s] of sheets) {
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/(textarea|\.field input|\.(tw|c-q|c-name|lp|shd|lq)-in)[^,{]*:focus\b/.test(m[1]) && /outline:\s*\d/.test(m[2])) bad.push(`${f}: ${m[1].trim().slice(0, 60)}`);
      if (/:focus/.test(m[1]) && /(outline|box-shadow)[^;]*(--accent\b|accent-rgb)/.test(m[2])) bad.push(`${f}: ${m[1].trim().slice(0, 60)}`);
    }
  }
  assert.deepEqual(bad, []);
});
console.log(`\n${passed} passed`);
