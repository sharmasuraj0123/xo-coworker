// Every control at least 36 px tall on a phone, by one rule (the owner's choice, 9 Nov 2026): phone.css holds a
// weightless floor (:where) for every control; a control's own height still shapes it (min-height outranks height),
// and a control's own smaller min-height (or a max-height) is answered for that control in phone.css. Written
// exceptions, each with its reason, are the only ones. No browser (the rendered sizes are measured at 320 and 390 by
// the browser pass).
//   node tests/phone-floor.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rules, context, decls, px, spec, cmp, covers } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const tokens = Object.fromEntries([...readFileSync(new URL("css/tokens.css", ROOT), "utf8").matchAll(/(--[\w-]+):\s*(\d+(?:\.\d+)?)px/g)].map((m) => [m[1], +m[2]]));
// what's a control: the classes the templates put on button, summary and select, and on the button/tab/option/menu
// item/switch roles
const src = [readFileSync(new URL("index.html", ROOT), "utf8"), ...readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/${f}`, ROOT), "utf8")), ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`js/shells/${f}`, ROOT), "utf8"))].join("\n");
const ctl = new Set();
for (const m of src.matchAll(/<(button|summary|select)\b([^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[2]); if (c) for (const k of c[1].trim().split(/\s+/)) if (k && !/^(is|st|k|m|t|r|e)-/.test(k)) ctl.add("." + k); }
for (const m of src.matchAll(/<(div|span|li|a)\b([^>]*role="(button|tab|option|menuitem|menuitemradio|switch)"[^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[2]); if (c) for (const k of c[1].trim().split(/\s+/)) if (k && !/^is-/.test(k)) ctl.add("." + k); }
// the written exceptions, each with its reason
const EXCEPT = [
  [/\.ar-grid \.md-open$/, "an Artifacts row on a phone: the 108 px row is its target (its own min-height 0 lets the row decide)"],
  [/\.pj-s (:is\(button,\.pj-home\))?$|\.pj-s>\.pj-need$/, "the project head's quiet path line (the phone bar the owner chose, 5 Nov): kept at 16 px, put to the owner with the floor"],
  [/\.tw-rt$/, "the thread head's quiet line (the same phone bar): kept, put to the owner with the floor"],
];
const all = rules(ROOT.href.endsWith("/") ? new URL("tests/lib/x.mjs", ROOT) : ROOT);
const live = all.map((r) => ({ r, c: context(r, 390), s: spec(r.sel) })).filter((x) => x.c.active && !x.c.cond);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("phone.css holds one weightless floor: every control at least 36 px tall on a phone", () => {
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(phone, /@media \(max-width:760px\)\{\s*:where\(button,\[role=button\],\[role=tab\],\[role=option\],\[role=menuitem\],\[role=menuitemradio\],\[role=menuitemcheckbox\],\[role=switch\],summary,select\)[^{]*\{min-height:36px\}/);
});
t("no control's own min-height or max-height holds it under 36 px on a phone, unless a phone rule answers it or it's a written exception", () => {
  const bad = [];
  for (const A of live) {
    const last = A.r.sel.split(/[\s>+~]+/).pop();
    if (/::?(before|after)|:(hover|active|focus)/.test(last)) continue;
    if (!(last.match(/\.[\w-]+/g) || []).some((k) => ctl.has(k)) && !/^(button|summary|select)\b/.test(last)) continue;
    for (const d of decls(A.r.d)) {
      if (d.p !== "min-height" && d.p !== "max-height") continue;
      const v = px(d.v, tokens);
      if (v == null || v >= 36) continue;
      if (EXCEPT.some(([re]) => re.test(A.r.sel))) continue;
      // answered: a later or stronger rule reaching these elements sets min-height ≥ 36 (and no max-height under it)
      const lifted = live.some((X) => X !== A && covers(X.r.sel, A.r.sel) && (cmp(X.s, A.s) > 0 || (cmp(X.s, A.s) === 0 && X.r.n > A.r.n)) && decls(X.r.d).some((dx) => dx.p === d.p && (d.p === "min-height" ? (px(dx.v, tokens) || 0) >= 36 : px(dx.v, tokens) == null || px(dx.v, tokens) >= 36)));
      if (!lifted) bad.push(`${A.r.f}: ${A.r.sel} { ${d.p}: ${d.v} }`);
    }
  }
  assert.deepEqual(bad, [], `controls held under 36 px on a phone:\n  ${bad.join("\n  ")}`);
});
t("a control whose words hide to leave its icon is 36 px wide on a phone too (the browser pass at 320/390 found Edit 28)", () => {
  // the controls whose label (a span) is hidden somewhere: on a phone they're icon buttons
  const css = readdirSync(new URL("css/", ROOT)).filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(`css/${f}`, ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
  const iconed = new Set();
  for (const m of css.matchAll(/([^{}]+)\{display:none\}/g)) for (const sel of m[1].split(",")) {
    const k = /\.([\w-]+)(?:[.:][\w-]+(?:\([^)]*\))?)*(?: |>)span$/.exec(sel.trim());
    if (k) iconed.add(k[1]);
  }
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const wide = /:where\(([^)]*)\)\{min-width:36px\}/.exec(phone);
  assert.ok(wide, "phone.css's square-at-the-floor list");
  const listed = new Set(wide[1].split(",").map((x) => x.trim().replace(/^\./, "")));
  // the ones that are 36 or more wide on a phone by their own rule
  const OWN = {
    "top-back": [/\.top-back\{[^}]*width:40px/, phone, "40 square in the phone's bar"],
    "dock-hide": [/\.dock-hide\{height:36px;min-width:36px\}/, css, "its own 36 at the phone"],
    "shd-act": [/\.shd-act\{width:var\(--h-lg\);height:var\(--h-lg\)/, css, "40 square at the phone"],
  };
  const short = [];
  for (const k of [...iconed].sort()) {
    if (listed.has(k)) continue;
    if (OWN[k]) { assert.match(OWN[k][1], OWN[k][0], `${k}: ${OWN[k][2]}`); continue; }
    short.push(k);
  }
  assert.deepEqual(short, [], `icon buttons on a phone without the 36 px width: ${short.join(", ")}`);
  for (const k of ["xd-edit", "xd-runs", "tw-act", "map-btn", "lbx-btn", "vw-btn"]) assert.ok(iconed.has(k), `found: ${k}`);
});
t("the icon buttons the browser pass found narrow are on the list: Open in Files (28), New file (32)", () => {
  const phone = readFileSync(new URL("css/phone.css", ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const listed = /:where\(([^)]*)\)\{min-width:36px\}/.exec(phone)[1].split(",").map((x) => x.trim());
  for (const k of [".cx-ofi", ".fl-add"]) assert.ok(listed.includes(k), `${k} is 36 wide on a phone`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
