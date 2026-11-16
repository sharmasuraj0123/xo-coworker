// Icon and segment controls stay on the branch's size scale wherever a stylesheet sizes them: never under 24 px (a
// later sheet once shrank Files' "back to the projects" button to 20 × 20: Astra S062 on 2354917), and on a phone
// at least the phone's floor, 36 px (the file's segment kept 22, then 26, under it). A segment's buttons sit in it
// concentrically: their radius is its radius less its border and padding. No browser.
//   node tests/targets-css.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
// the sheets in the order index.html loads them (a later one wins at equal specificity)
const ORDER = ["app.css", "panel.css", "fileview.css", "phone.css"];
const tokens = Object.fromEntries([...read("tokens.css").matchAll(/(--[\w-]+):\s*(\d+)px/g)].map((m) => [m[1], +m[2]]));
/** every rule as {f, sel, d, at: [enclosing @-preludes]}, by walking the braces */
function rulesOf(f, css) {
  const out = [], stack = [];
  let i = 0, start = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === "{") {
      const pre = css.slice(start, i).trim();
      if (pre.startsWith("@")) { stack.push(pre); start = i + 1; }
      else { const end = css.indexOf("}", i); out.push({ f, sel: pre, d: css.slice(i + 1, end), at: [...stack] }); i = end; start = end + 1; }
    } else if (c === "}") { stack.pop(); start = i + 1; }
    i++;
  }
  return out;
}
const RULES = ORDER.flatMap((f) => rulesOf(f, read(f)));
const phone = (r) => r.at.some((a) => /max-width:\s*760px/.test(a));
const named = (sel) => RULES.filter((r) => r.sel.split(",").some((x) => new RegExp(`(^|\\s)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).test(x.trim())));
const val = (d, p) => {
  const m = new RegExp(`(?:^|;)\\s*${p}:\\s*([^;]+)`).exec(d);
  if (!m) return null;
  const v = m[1].trim().replace(/var\((--[\w-]+)\)/g, (_, t) => `${tokens[t]}px`);
  const c = /^calc\((\d+)px\s*-\s*(\d+)px\)$/.exec(v);
  if (c) return +c[1] - +c[2];
  const n = /^(\d+(?:\.\d+)?)px$/.exec(v);
  return n ? +n[1] : v;
};
/** what a selector ends up with for a property, desktop or phone: the last rule that sets it (outside container queries) */
const final = (sel, p, onPhone) => { let v = null; for (const r of named(sel)) { if (r.at.some((a) => a.startsWith("@container"))) continue; if (phone(r) && !onPhone) continue; const x = val(r.d, p); if (x != null) v = x; } return v; };

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

for (const sel of [".fl-up", ".vw-seg button", ".st-x", ".stg-x", ".fv-ib", ".vw-x", ".x"]) {
  t(`${sel}: no sheet sizes it under 24 px`, () => {
    const bs = named(sel);
    assert.ok(bs.length, `${sel} is declared`);
    for (const b of bs) for (const p of ["width", "height", "min-height"]) {
      const v = val(b.d, p);
      if (typeof v === "number") assert.ok(v >= 24 || (p === "min-height" && v === 0 && false), `${b.f}: ${b.sel} { ${p}: ${v}px }`);
    }
  });
}
t("S062: Files' back to the projects is on the scale (24) and, on a phone, the phone's icon size (36 × 36)", () => {
  assert.deepEqual([final(".fl-up", "width", false), final(".fl-up", "height", false)], [24, 24], "24 × 24 beside the chat");
  assert.ok(final(".fl-up", "width", true) >= 36 && final(".fl-up", "height", true) >= 36, "at least 36 × 36 on a phone");
});
t("The file's segment on a phone: its buttons at least 36 tall (the phone's floor), and nothing sets them shorter", () => {
  assert.ok(final(".vw-seg button", "height", true) >= 36, `phone height ${final(".vw-seg button", "height", true)}`);
  for (const r of named(".vw-seg button")) assert.notEqual(val(r.d, "min-height"), 0, `${r.f}: ${r.sel} sets min-height:0`);
  for (const r of RULES.filter((r) => /\.vw-seg button/.test(r.sel) && phone(r))) { const mh = val(r.d, "min-height"); if (typeof mh === "number") assert.ok(mh >= 36 || mh <= final(".vw-seg button", "height", true), `${r.f}: ${r.sel} min-height ${mh}`); }
});
for (const onPhone of [false, true]) {
  t(`The file's segment ${onPhone ? "on a phone" : "beside the chat"}: its buttons fit it exactly and sit in it concentrically`, () => {
    const H = final(".vw-seg", "height", onPhone), pad = final(".vw-seg", "padding", onPhone), b = final(".vw-seg button", "height", onPhone);
    const R = final(".vw-seg", "border-radius", onPhone), r = final(".vw-seg button", "border-radius", onPhone);
    assert.equal(H, b + 2 * pad + 2, `segment ${H} = button ${b} + padding ${pad} × 2 + border 1 × 2`);
    assert.equal(r, R - pad - 1, `button radius ${r} = segment radius ${R} − padding ${pad} − border 1`);
  });
}

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
