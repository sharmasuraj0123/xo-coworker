// The toast is dark in both themes, so in light everything on it takes the dark palette's roles (the controls grader
// on d79d37e, S138: the Saved notice's × took light's --ink-3, #575757, on the dark toast: faint at rest and on focus
// in 1440-light and 390-light). Checked from the tokens: the inverse block restates the dark block's values for every
// role it sets, it covers every role the toast's own rules use, nothing patches the toast's colours by hex any more,
// and what's on it reads: words 4.5:1, its icons and rings 3:1. The drawn result is the flows case S138 (paint).
//   node tests/inverse-toast.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = css("tokens.css");
const block = (sel) => { const i = tokens.indexOf(sel + "{"); if (i < 0) return null; const j = tokens.indexOf("}", i); return Object.fromEntries([...tokens.slice(i + sel.length + 1, j).matchAll(/(--[\w-]+):([^;]+);/g)].map((m) => [m[1], m[2].trim()])); };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const dark = block(":root"), light = block(':root[data-theme="light"]'), inv = block(':root[data-theme="light"] :is(.toast,.lbx)'); // the toast and the lightbox: dark in both themes (S080/S201)

t("in light the toast takes the dark palette's roles, the dark block's own values", () => {
  assert.ok(inv, 'tokens.css :root[data-theme="light"] :is(.toast,.lbx){…}');
  const roles = Object.keys(inv);
  for (const r of ["--ink", "--ink-2", "--ink-3", "--fill-2", "--fill-4", "--line", "--hover-fill", "--press-fill", "--accent-rgb", "--focus"]) assert.ok(roles.includes(r), `it sets ${r}`);
  for (const r of roles) if (r !== "--focus") assert.equal(inv[r], dark[r], `${r} is dark's`);
  assert.equal(inv["--focus"], dark["--focus"], "the focus ring, worked out again from the toast's accent");
});
// the toast's own rules: .toast and what's in it (.t-*, the viewer's .xd-t*), in every stylesheet
const all = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => [f, css(f)]);
// the toast's own classes (js/app.js toasts, js/viewer.js's Saved notice)
const isToast = (sel) => sel.split(",").some((x) => /\.(toast|t-ic|t-m|t-undo|t-ring|t-back|xd-toast|xd-tacts|xd-tx)(?![\w-])/.test(x.replace(/\.toast-wrap\b/g, "")));
const toastRules = all.flatMap(([f, s]) => [...s.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => isToast(m[1])).map((m) => ({ f, sel: m[1].trim(), body: m[2] })));
t("every colour role the toast's own rules use is one the inverse sets (or the same in both themes)", () => {
  const COLOUR = /^--(ink|fill|line|hover|press|accent|err|focus|on-ink)/;
  const used = new Set(toastRules.flatMap((r) => [...r.body.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])).filter((v) => COLOUR.test(v)));
  const missing = [...used].filter((v) => !(v in inv) && light[v] !== undefined && light[v] !== dark[v]);
  assert.deepEqual(missing, [], `roles the toast uses that would still be light's on it: ${missing.join(", ")}`);
  assert.ok(used.has("--ink-3") && used.has("--fill-4"), "it found the toast's rules (its × and Undo)");
});
t("nothing patches the toast's colours by hex in light any more", () => {
  const patches = all.flatMap(([f, s]) => [...s.matchAll(/(:root\[data-theme="light"\][^{]*\.(?:toast|t-ic|t-m|t-undo|t-ring|t-back|xd-toast|xd-tx)(?![\w-])[^{]*)\{([^}]*)\}/g)].filter((m) => /#[0-9a-f]{3,8}\b/i.test(m[2]) && !/^:root\[data-theme="light"\] (?:\.toast|:is\(\.toast,\.lbx\))$/.test(m[1].trim())).map((m) => `${f}: ${m[1].trim()}`));
  assert.deepEqual(patches, [], "the toast's light-theme hex patches (app.css) are gone: the roles do it");
});
// contrast on the toast: its background over light's canvas, then each role over it
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => { const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(s.replace(/\s/g, "")); return m ? { c: [+m[1], +m[2], +m[3]], a: +m[4] } : { c: hex(s), a: 1 }; };
const over = (top, base) => top.c.map((v, i) => v * top.a + base[i] * (1 - top.a));
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
t("on the light theme's toast: its words 4.5:1, Undo's and Tell's words on their fill 4.5:1, the × and the ring 3:1", () => {
  const bg = over(rgba(light["--toast-bg"]), hex(light["--canvas"]));
  const ink = (r) => hex(inv[r]);
  assert.ok(ratio(ink("--ink"), bg) >= 4.5, "the title");
  assert.ok(ratio(ink("--ink-3"), bg) >= 4.5, `the words (meta) ${ratio(ink("--ink-3"), bg).toFixed(2)}`);
  assert.ok(ratio(ink("--ink"), over(rgba(inv["--fill-4"]), bg)) >= 4.5, "Undo and Tell on their fill");
  assert.ok(ratio(ink("--ink-3"), bg) >= 3, "the × at rest (an icon: 3:1)");
  const ring = over({ c: inv["--accent-rgb"].split(",").map(Number), a: 0.75 }, bg);
  assert.ok(ratio(ring, bg) >= 3, `the focus ring ${ratio(ring, bg).toFixed(2)}`);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
