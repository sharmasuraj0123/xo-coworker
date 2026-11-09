// Icon and segment controls stay on the branch's size scale wherever a stylesheet sizes them: never under 24 px (a
// later sheet once shrank Files' "back to the projects" button to 20 × 20: Astra S062 on 2354917), and on a phone
// the size of the other icon controls (36 px, the phone's floor). No browser.
//   node tests/targets-css.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const SHEETS = ["app.css", "panel.css", "fileview.css"].map((f) => [f, read(f)]);
const tokens = Object.fromEntries([...read("tokens.css").matchAll(/(--[\w-]+):\s*(\d+)px/g)].map((m) => [m[1], +m[2]]));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** every declaration block whose selector list includes `sel` (a whole selector, any prefix like :root:root .fv) */
const blocks = (sel) => SHEETS.flatMap(([f, css]) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].split(",").some((x) => new RegExp(`(^|\\s)${esc(sel)}$`).test(x.trim())))
  .map((m) => ({ f, sel: m[1].trim(), d: m[2], phone: /max-width:\s*760px/.test(css.slice(Math.max(0, css.lastIndexOf("@media", m.index)), m.index)) && !/\}\s*\}/.test(css.slice(css.lastIndexOf("@media", m.index), m.index)) })));
const size = (d, p) => { const m = new RegExp(`(?:^|;)\\s*${p}:\\s*(?:(\\d+(?:\\.\\d+)?)px|var\\((--[\\w-]+)\\))`).exec(d); return m ? (m[1] != null ? +m[1] : tokens[m[2]]) : null; };

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

for (const sel of [".fl-up", ".vw-seg button", ".st-x", ".stg-x", ".fv-ib", ".vw-x", ".x"]) {
  t(`${sel}: no sheet sizes it under 24 px`, () => {
    const bs = blocks(sel);
    assert.ok(bs.length, `${sel} is declared`);
    for (const b of bs) for (const p of ["width", "height"]) {
      const v = size(b.d, p);
      if (v != null) assert.ok(v >= 24, `${b.f}: ${b.sel} { ${p}: ${v}px }`);
    }
  });
}
t("S062: Files' back to the projects is on the scale (24) and, on a phone, the phone's icon size (36 × 36)", () => {
  const bs = blocks(".fl-up");
  assert.ok(bs.some((b) => !b.phone && size(b.d, "width") === 24 && size(b.d, "height") === 24), "24 × 24 beside the chat");
  assert.ok(bs.some((b) => b.phone && size(b.d, "width") >= 36 && size(b.d, "height") >= 36), "at least 36 × 36 on a phone");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
