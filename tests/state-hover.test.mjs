// A chosen control answers the pointer, whatever its state draws, by one census of every state the CSS styles. The
// controls grader found three states that silenced hover, one at a time: the Artifacts pin, the sidebar's stateful
// rows (C008), and on 414de0f the chosen filter chip in All threads, "All 5", the same at rest and hovered in both
// desktop themes (S020), while "Waiting 1" brightened. The cause was one pattern: a hover drawn as a fill or an ink,
// which a state's own fill and inks matched or outranked. The fix is one rule (foundation.css): hovered, any chosen
// state takes one layer of its own ink over whatever it draws, !important on a zero-specificity selector.
//
// The census reads every rule that styles a chosen state (checked, selected, pressed, current, on, here, …) on a
// desktop, and places the element it styles: a control or a stateful wrapper the shared layer reaches, a written
// other way (the sidebar's rows, lists whose selection the pointer moves), or not a control at all (nothing to hover:
// a mark, a card). A state on something hoverable that's none of these fails, and so does a state token the shared
// layer doesn't list: a new state can't silence hover.
//   node tests/state-hover.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { rules, context, decls } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), "utf8");
const src = [read("index.html"), ...readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => read(`js/${f}`)), ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => read(`js/shells/${f}`))].join("\n");
const found = read("css/foundation.css").replace(/\/\*[\s\S]*?\*\//g, "");
const all = rules(new URL("tests/lib/x.mjs", ROOT));

// the shared layer, as written
const LAYER = /:where\(([^)]*)\):where\(((?:[^()]|\([^()]*\))*)\):where\(:hover:not\(((?:[^()]|\([^()]*\))*)\)\)\{background-image:linear-gradient\(color-mix\(in srgb,currentColor 8%,transparent\),color-mix\(in srgb,currentColor 8%,transparent\)\)!important\}/;
const layer = LAYER.exec(found);
const [hosts, states, off] = layer ? [layer[1].split(","), layer[2].match(/\[[^\]]*\](?::not\([^)]*\))?|\.[\w-]+/g), layer[3]] : [[], [], ""];

// a chosen state: aria-checked/selected/pressed true, aria-current, and the class names the app gives one
const CHOSEN = /\[aria-(?:checked|selected|pressed)="?true"?\]|\[aria-current(?:="?(?!false)[\w-]+"?)?\]|\.(?:is-(?:on|cur|here|sel|active|pinned|current|chosen|picked|selected)|on|active|current|selected|pinned|chosen)(?![\w-])/g;
const VIS = /^(background|background-color|background-image|color|border|border-color|box-shadow|opacity|outline-color|text-decoration-color)$/;
const norm = (k) => k.replace(/="?true"?/, '="true"').replace(/^\[aria-current.*$/, '[aria-current]:not([aria-current="false"])');

// what the templates draw: each class with the tags and roles it's drawn on
const drawnOn = new Map();
const on = (k, tag) => { if (!drawnOn.has(k)) drawnOn.set(k, new Set()); drawnOn.get(k).add(tag); };
// a class list in markup, written out or through a variable (map.js: class="${cls}", const cls = `dg-n …`); only the
// classes before the first ${…} are the element's own
// the variable's own definition: the nearest one before the markup that uses it
const varAt = (name, at) => { let v = null; for (const m of src.slice(0, at).matchAll(new RegExp(`const ${name} = \`([^\`]*)\``, "g"))) v = m[1]; return v; };
const own = (v) => v.split("${")[0].split(/\s+/).filter((k) => /^[\w-]+$/.test(k));
for (const m of src.matchAll(/<(\w+)\b([^>]*)>/g)) {
  const c = /class="([^"]*)/.exec(m[2]); if (!c) continue;
  const role = /role="(\w+)"/.exec(m[2]), tag = m[1].toLowerCase() + (role ? `[role=${role[1]}]` : "");
  const v = /^\$\{(\w+)\}/.exec(c[1]), def = v && varAt(v[1], m.index);
  for (const k of own(def != null ? def : c[1])) on(k, tag);
}
// one made by createElement and given its class (msgx.js: the Back to the latest button)
for (const m of src.matchAll(/const (\w+) = document\.createElement\("(\w+)"\);[^]{0,120}?\1\.className = "([^"]+)"/g)) for (const k of own(m[3])) on(k, m[2]);
const drawn = (k) => drawnOn.has(k) || new RegExp(`["'\\s.]${k}["'\\s]`).test(src);
const CONTROL_TAG = /^(button|a|summary)\b|\[role=(button|tab|radio|switch|checkbox|option|menuitem|menuitemradio)\]/;
const hosted = (subject) => { const tags = [...subject.classes].flatMap((k) => [...(drawnOn.get(k) || [])]); return CONTROL_TAG.test(subject.tag) || /\[role=/.test(subject.tag) || tags.some((t) => CONTROL_TAG.test(t)) || subject.classes.has("shd-tabw"); };

// those the shared layer names out, each with how it answers instead
const OTHER = [
  [/\.(prow|nrow)\b/, /:root:root \.side :is\(\.prow\.busy,\.prow\.needs,\.prow\.is-on,\.nrow\.is-on\):hover\{background-image:linear-gradient\(color-mix\(in srgb,var\(--ink\) 6%,transparent\)/, "css/side.css", "the sidebar's rows: their own layer over each state's wash (C008), the sidebar's frozen look"],
  [/\.dd-row\b/, /addEventListener\("pointermove", \(e\) => \{ const r = e\.target\.closest\?\.\("\.dd-row"\); if \(r && !r\.hasAttribute\("aria-disabled"\)\) this\._activate\(/, "js/dropdown.js", "a dropdown's rows: the pointer moves its one active row (C058)"],
  [/\.at-list li\b/, /atList\.addEventListener\("pointermove", \(e\) => \{[^]*?li\.setAttribute\("aria-selected", "true"\)|atList\.addEventListener\("pointermove"/, "js/app.js", "Find a project's rows: the pointer moves the selection (C058)"],
  [/\.jump-list li\b/, /jl\.addEventListener\("pointermove", \(e\) => \{[^]*?li\.setAttribute\("aria-selected", "true"\)/, "js/app.js", "Jump's rows: the pointer moves the selection"],
  [/\.shd-tab(?![\w-])/, /\.shd-tabw\)/, "css/foundation.css", "a shell's tab: its wrapper draws the state, and the wrapper takes the layer"],
  [/\.shd-tabw\.is-edit/, /\.shd-tabw\.is-edit\{|\.shd-tabw\.is-edit,/, "css/app.css", "a shell's tab being renamed: a field, not a tab to hover"],
];
const other = (sel) => OTHER.find(([re]) => re.test(sel));

// the census
const placed = { layer: [], other: [], inert: [], undrawn: [], fails: [], tokens: new Set() };
for (const r of all) {
  const c = context(r, 1440);
  if (!c.active) continue;
  const parts = r.sel.split(/[\s>+~]+/), last = parts[parts.length - 1];
  if (/::?(before|after|placeholder|marker)|:(hover|active|focus|focus-visible|focus-within)\b/.test(last)) continue;
  const toks = last.match(CHOSEN); if (!toks) continue;
  if (!decls(r.d).some((d) => VIS.test(d.p))) continue;
  const name = `${r.f}: ${r.sel}`;
  for (const k of toks) placed.tokens.add(norm(k));
  const classes = new Set((last.replace(CHOSEN, "").match(/\.[\w-]+/g) || []).map((x) => x.slice(1)));
  const subject = { tag: last.replace(/[.#:[].*$/, "") + (/\[role=[\w"]+\]/.exec(last)?.[0].replace(/"/g, "") || ""), classes };
  const o = other(r.sel);
  if (o) { placed.other.push(name); continue; }
  if (classes.size && ![...classes].some(drawn) && !subject.tag) { placed.undrawn.push(name); continue; }
  if (hosted(subject)) { placed.layer.push(name); continue; }
  // not a control: hoverable only if some :hover rule names it
  const hoverable = all.some((h) => { if (!/:hover/.test(h.sel)) return false; const hl = h.sel.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "").split(/[\s>+~]+/).filter((x) => /:hover/.test(x)).join(" "); return [...classes].some((k) => new RegExp(`\\.${k}(?![\\w-])`).test(hl)); });
  if (hoverable) placed.fails.push(name); else placed.inert.push(name);
}

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one layer for every chosen control: its own ink, over whatever it draws, before the press", () => {
  assert.ok(layer, "the shared layer is in foundation.css");
  for (const h of ["button", "a[href]", "summary", "[role=button]", "[role=tab]", "[role=radio]", "[role=switch]", "[role=option]", ".shd-tabw"]) assert.ok(hosts.includes(h), `it reaches ${h}`);
  assert.ok(found.indexOf(layer[0]) < found.search(/\{background-image:linear-gradient\(var\(--press-fill\),var\(--press-fill\)\)!important/), "it comes before the press, so a press shows the press fill");
  assert.match(off, /^:disabled,\[aria-disabled="true"\],/, "never on a control that can't be used");
});
t("the census reads the states, the grader's chip and C008's rows among them", () => {
  const n = placed.layer.length + placed.other.length + placed.inert.length + placed.undrawn.length + placed.fails.length;
  assert.ok(n > 60, `${n} state rules`);
  assert.ok(placed.layer.includes('app.css: .all-f button[aria-checked="true"]'), "S020's chip reached by the layer");
  assert.ok(placed.other.some((x) => /side\.css: \.prow\.is-on/.test(x)), "C008's rows placed with their own layer");
});
t("every state the CSS styles on a control is a state the layer lists: a new one can't silence hover", () => {
  const missing = [...placed.tokens].filter((k) => !states.includes(k)).sort();
  assert.deepEqual(missing, [], `states styled but not in the shared layer: ${missing.join(", ")}`);
});
t("every chosen state on something hoverable is reached by the layer or answers another way, written", () => {
  assert.deepEqual(placed.fails, [], `chosen states on hoverable things the layer doesn't reach:\n  ${placed.fails.join("\n  ")}`);
});
t("each other way still holds, and each is named out of the layer", () => {
  for (const [re, proof, file, why] of OTHER) {
    assert.match(read(file), proof, `${re}: ${why}`);
  }
  for (const x of [".prow", ".nrow", ".dd-row", ".at-list li", ".jump-list li", ".shd-tabw > *", ".shd-tabw.is-edit"]) assert.ok(off.split(",").includes(x), `${x} named out of the layer`);
});
t("no state's own background is !important: nothing outranks the layer but the press", () => {
  const loud = all.filter((r) => (r.sel.match(CHOSEN) || []).length && !/:active|:hover/.test(r.sel) && decls(r.d).some((d) => /^background(-image)?$/.test(d.p) && d.imp)).map((r) => `${r.f}: ${r.sel}`);
  assert.deepEqual(loud, []);
});
t("no control's background is the shorthand marked !important: it would take the press layer away (S002: Ran the tests held as hovered)", () => {
  // background: … !important sets background-image too, above the press layer's zero-specificity !important
  const ctlAll = new Set([...drawnOn].filter(([, tags]) => [...tags].some((x) => CONTROL_TAG.test(x))).map(([k]) => k));
  const loud = all.filter((r) => { const last = r.sel.split(/[\s>+~]+/).pop(); return /^button\b/.test(last) || (last.match(/\.[\w-]+/g) || []).some((k) => ctlAll.has(k.slice(1))); })
    .filter((r) => decls(r.d).some((d) => d.p === "background" && d.imp)).map((r) => `${r.f}: ${r.sel}`);
  assert.deepEqual(loud, [], "controls whose background shorthand is !important");
});
console.log(`  (placed: ${placed.layer.length} by the layer, ${placed.other.length} another way, ${placed.inert.length} not controls, ${placed.undrawn.length} not drawn)`);
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
