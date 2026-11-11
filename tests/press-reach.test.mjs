// Every control shows it's held, a step past hovered, where a person can see it (the controls grader on 03e9b44): a
// phone's long-press menu items (S170 Copy, S171 Select text) held as hovered, the shared press layer named out for
// them; a picture's tile (S090) hovered and pressed under its own picture, 0.5–3.6% of its pixels.
//   node tests/press-reach.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const fnd = read("foundation.css"), media = read("media.css");
const all = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map(read).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the long-press menu's items take the shared press layer over their focus fill (S170, S171)", () => {
  const press = /:where\(button,a\[href\]\[class\],[^)]*\):where\(:not\(([^{]*)\)\):where\(:active\)\{background-image:linear-gradient\(var\(--press-fill\)/.exec(fnd);
  assert.ok(press, "the press layer");
  assert.doesNotMatch(press[1], /\.lp-menu button/, "not named out of it");
});
t("a picture's tile says hover and press over its picture: a veil, deeper held (S090)", () => {
  assert.match(media, /\.mx-one::before,\.mx-tile::before\{content:"";position:absolute;inset:0;z-index:2;/);
  const hov = /\.mx-one:hover::before,\.mx-tile:hover::before\{background-color:color-mix\(in srgb,var\(--veil\) (\d+)%/.exec(media), act = /\.mx-one:active::before,\.mx-tile:active::before\{background-color:color-mix\(in srgb,var\(--veil\) (\d+)%/.exec(media);
  assert.ok(hov && act && +act[1] > +hov[1], "held deeper than hovered");
});
t("a chosen control held goes three veils deep, past its own fill and its hover's layer (C084: Follow on, held vs hovered 18–20 RGB-sum)", () => {
  assert.match(fnd, /\.is-on\):where\(:active:not\([^)]*\)\)\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important\}/);
  const one = fnd.search(/\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important/), three = fnd.search(/\.is-on\):where\(:active/);
  assert.ok(one >= 0 && three > one, "after the shared press, so it wins on a chosen control");
});
// a control whose face is a picture: the press layer's fill lies under the picture, so it needs a veil over it, deeper
// held (S090 a message's pictures; S233 an attachment's Preview, held as hovered 0.0% in all four cells). Every button
// drawn with a picture for its face (an <img>, imgHtml(), or .is-img) is found in the scripts and needs one
t("every button whose face is a picture has a veil over it for hover and press, deeper held (S090, S233)", () => {
  const js = readdirSync(new URL("../js/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8")).join("\n");
  const faces = new Set();
  for (const line of js.split("\n")) for (const m of line.matchAll(/<button[^>]*class="([\w-]+)[^"]*"[^>]*>(?:\$\{(?:imgHtml\(|ic\})|<img)/g)) faces.add(m[1]);
  for (const m of js.matchAll(/<button[^>]*class="([\w-]+) is-img"/g)) faces.add(m[1]);
  assert.ok(faces.has("mx-one") && faces.has("mx-tile") && faces.has("att-ic"), `found: ${[...faces]}`);
  const veil = (c, st) => new RegExp(`\\.${c}(?:\\.is-img)?:${st}::(?:before|after)[^{]*\\{background-color:color-mix\\(in srgb,var\\(--veil\\) (\\d+)%`).exec(all);
  const bad = [...faces].filter((c) => { const h = veil(c, "hover"), a = veil(c, "active"); return !(h && a && +a[1] > +h[1]); });
  assert.deepEqual(bad, [], "a picture-faced button without a veil, deeper held");
});
// the veil is chosen against the picture: in the theme's ink it vanished over a picture of the ink's tone (the
// controls grader on aba434f, S233: light, a black picture, hover and held identical to rest)
t("a picture's veil is chosen against the picture: light over a dark one, dark over a light one, read before the hover draws", () => {
  assert.match(media, /:where\(\.mx-one,\.mx-tile,button\.att-ic\.is-img\)\[data-tone="dark"\]\{--veil:#FFFFFF\}/);
  assert.match(media, /:where\(\.mx-one,\.mx-tile,button\.att-ic\.is-img\)\[data-tone="light"\]\{--veil:#000000\}/);
  const mjs = readFileSync(new URL("../js/media.js", import.meta.url), "utf8");
  assert.match(mjs, /export const PICTURE_FACE = "\.mx-one, \.mx-tile, button\.att-ic\.is-img";/);
  assert.match(mjs, /document\.addEventListener\("pointerover", \(e\) => \{\s*const face = e\.target && e\.target\.closest && e\.target\.closest\(PICTURE_FACE\);/);
  assert.match(mjs, /sum \+= d\[i\] \+ d\[i \+ 1\] \+ d\[i \+ 2\]; n\+\+;/, "by the mean of R+G+B, the graders' measure");
  assert.match(mjs, /if \(n\) t = sum \/ n < 382\.5 \? "dark" : "light";/);
  // at least 12% hovered: 12% of 382 is 46 RGB-sum for a pixel of the mean's colour, past the bar of 30 with room
  const hv = /\.mx-one:hover::before,\.mx-tile:hover::before\{background-color:color-mix\(in srgb,var\(--veil\) (\d+)%/.exec(media);
  assert.ok(hv && +hv[1] >= 12, `hover veil ${hv && hv[1]}%`);
});
// The shared press layer names out the controls with a press of their own. Their own has to be one a person sees by
// grader A's bar (a pixel past 30 RGB-sum over ≥10% of the box, or ≥50% of the glyphs for words alone): a give alone
// (a scale moves the edges, 5–9%) or a fill one step past the hover fill (6% to 9%: 21 RGB-sum) isn't one. The state
// sweep by that bar on 7137115 found Create and the runtime chip held 0%, the theme switch 9.1%. Each control named
// out is listed here with the press it has instead; a new one named out without one fails.
const pressOut = () => {
  const m = /:where\(button,a\[href\]\[class\],[^)]*\):where\(:not\(([^{]*)\)\):where\(:active\)\{background-image:linear-gradient\(var\(--press-fill\)/.exec(fnd);
  assert.ok(m, "the press layer"); const out = []; let depth = 0, cur = "";
  for (const ch of m[1]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out.map((s) => s.trim()).filter((s) => s && s !== ":disabled" && s !== '[aria-disabled="true"]');
};
const ACCENT = /^:where\((.*?)\):where\(:active:not\([^{]*\)\)\{background-color:var\(--accent-press\)!important/m.exec(fnd)?.[1] || "";
const INK = /^:where\((.*?)\):where\(:active:not\([^{]*\)\)\{background-color:color-mix\(in srgb,var\(--ink\) \d+%,var\(--canvas\)\)!important/m.exec(fnd)?.[1] || "";
const DIM = /:is\(([^)]*)\):where\(:active:not\([^)]*\)\)\{opacity:\.7\}/.exec(fnd)?.[1] || "";
const OWN = {
  ".send": () => ACCENT.includes(".send:not(.is-stop)") && INK.includes(".send.is-stop"),
  ".btn-pri": () => ACCENT.includes(".btn-pri"), ".xd-btn.is-pri": () => ACCENT.includes(".xd-btn.is-pri"), ".xd-send": () => ACCENT.includes(".xd-send"),
  ".iq-done": () => INK.includes(".iq-done"),
  ".theme": () => /:where\(\.theme,\.switch\):where\(:active:not\([^)]*\)\) \.th-track\{background-image:linear-gradient\(color-mix\(in srgb,var\(--ink\) 28%/.test(fnd),
  ".switch": () => /:where\(\.theme,\.switch\):where\(:active:not\([^)]*\)\) \.th-track\{background-image/.test(fnd),
  ".lp-go": () => /\.lp-go:active\{[^}]*background:var\(--lit-press\)/.test(all),
  ".tw-act.lp-btn": () => /\.tw-act\.lp-btn:active,\.tw-act\.lp-btn\.is-on\{background:color-mix\(in srgb,var\(--accent-fill\) 20%/.test(all),
  ".lk:not(.lk-in)": () => /\.lk-out:active\{opacity:\.7\}/.test(all), // the links in text: .lk-out (.lk-in, a token, takes the layer)
  ":is(.vw-cut-dl,.wsh-home,.cp-link,.tg-ch,.fl-link,.lp-ln,.shl-all,.tp-done-u)": () => DIM === ".vw-cut-dl,.wsh-home,.cp-link,.tg-ch,.fl-link,.lp-ln,.shl-all,.tp-done-u",
  // the sidebar's rows: the press fill over the hover fill over their wash, a chosen one two press veils deep (side.css)
  ".prow": () => /:root:root \.side :is\(\.nrow,\.prow\):active\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--hover-fill\)/.test(all) && /:root:root \.side :is\(\.nrow,\.prow\):hover\{background-image:linear-gradient\(var\(--hover-fill\)/.test(all),
  ".nrow": () => /:root:root \.side :is\(\.prow\.busy,\.prow\.needs,\.prow\.is-on,\.nrow\.is-on\):active\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\),linear-gradient\(var\(--press-fill\)/.test(all),
};
// none: the sidebar's rows were, until the owner chose their look (11 Nov 05:42Z)
const KNOWN_MISSES = [];
t("every control named out of the press layer has a press a person sees of its own; a give alone is never one", () => {
  const out = pressOut();
  const unlisted = out.filter((s) => !(s in OWN) && !KNOWN_MISSES.includes(s));
  assert.deepEqual(unlisted, [], "named out with no press of its own listed here: take the layer, or give it one a person sees");
  const missing = out.filter((s) => s in OWN && !OWN[s]());
  assert.deepEqual(missing, [], "named out, but its own press isn't there");
});
t("the controls whose own press was a give or a step past the hover take the layer over it: Create, .btn, the picker's chip and rows, the decision kit and its hold, the gear and +", () => {
  const out = pressOut();
  for (const c of [".create", ".btn", ".iq", ".iq-row", ".b", ".b-hold", ".gear", ".side-plus"]) assert.ok(!out.includes(c), `${c} named out`);
  // and a give alone on a control named out is caught: every :active rule that only transforms names no control named out but the owner's rows
  const giveOnly = [...all.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel, body]) => /:active/.test(sel) && body.split(";").every((d) => !d.trim() || /^\s*(transform|scale|transition[\w-]*|--[\w-]+)\s*:/.test(d)));
  const hits = [];
  for (const [, sel] of giveOnly) for (const s of sel.split(",")) {
    const m = /\.([\w-]+)(?:\.[\w-]+)*:active/.exec(s); if (!m) continue;
    const named = out.find((o) => o === "." + m[1]);
    if (named && !KNOWN_MISSES.includes(named) && !(named in OWN)) hits.push(s.trim());
  }
  assert.deepEqual(hits, [], "a give alone on a control named out of the press layer");
});
t("a switch's track says hover and press under its knob: 14% and 28% of the ink", () => {
  assert.match(fnd, /:where\(\.theme,\.switch\):where\(:hover:not\([^)]*\)\) \.th-track\{background-image:linear-gradient\(color-mix\(in srgb,var\(--ink\) 14%/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
