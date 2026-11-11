// A resize grip the keyboard is on shows the one ring (the controls grader on 9d1f71b, desktop, C034 Files' divider and
// C035 the chat's: the only cue was a 1 px line brightening, 2.44:1 / 1.65:1 and 2.51:1 / 1.48:1). Checked from the
// source: every focusable separator the templates make has the ring on its grab area, the base ring's 2 px of the
// focus colour. The drawn ring is the flows case "C034/C035".
//   node tests/grip-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const R = new URL("../", import.meta.url);
const css = readdirSync(new URL("css/", R)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`css/${f}`, R), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
const src = readdirSync(new URL("js/", R)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/${f}`, R), "utf8")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("every focusable separator has the ring on its grab area", () => {
  const grips = [...src.matchAll(/class="([\w-]+)" role="separator"[^>]*tabindex="0"/g)].map((m) => m[1]).sort();
  assert.deepEqual(grips, ["fl-split", "fr-gut", "fv-cgrip", "stg-grip"], "the grips the templates make");
  assert.ok(/\.stage \.fr-gut:focus-visible\{outline:2px solid var\(--ring-in,var\(--focus\)\)/.test(css), "the panel's frames' gutter: its ring already");
  assert.ok(/body\.chat-docked \.fv-cgrip:focus-visible,\.stg-grip:focus-visible\{outline:2px solid var\(--ring-in,var\(--focus\)\);outline-offset:-2px;border-radius:3px\}/.test(css), "the chat's grip and the panel's: on themselves");
  // as specific as the rules that take their outline away (the browser pass found body.chat-docked .fv-cgrip's won)
  assert.ok(/body\.chat-docked \.fv-cgrip\{[^}]*outline:none/.test(css) && /\.stg-grip\{[^}]*outline:none/.test(css), "the rules it must outweigh");
  assert.ok(/\.fv \.fl\.is-wide \.fl-split:focus-visible::after\{box-shadow:inset 0 0 0 2px var\(--focus\);border-radius:3px\}/.test(css), "Files' divider: on its 9 px grab area");
  assert.ok(/\.fv \.fl\.is-wide \.fl-split::after\{content:"";position:absolute;top:0;bottom:0;left:-4px;width:9px\}/.test(css), "which is there, 9 px wide");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
